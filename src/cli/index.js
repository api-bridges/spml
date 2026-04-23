#!/usr/bin/env node
// src/cli/index.js
// Trionary CLI entry point.
// Commands:
//   trionary init            — scaffold a new Trionary project
//   trionary build <file>    — compile a .tri file to Node.js
//   trionary dev <file>      — build, run, and watch for changes

import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { TrinaryError } from '../errors/TrinaryError.js';
import { generateServer, generateEnvExample } from '../codegen/server.js';
import { generateMiddleware, generateCustomMiddleware, getCustomPackages, resetCustomPackages } from '../codegen/middleware.js';
import { generateAuthStatements } from '../codegen/auth.js';
import { generateAuthMiddleware, generateRouteWithAuth } from '../codegen/authMiddleware.js';
import { generateImports, resetImports, addImport } from '../codegen/imports.js';
import { generateSocketHandler } from '../codegen/socket.js';
import { resolveImports } from '../compiler/resolve.js';

// Codegen backends
import * as mongooseBackend from '../codegen/backends/mongoose.js';
import * as prismaBackend from '../codegen/backends/prisma.js';

// ---------------------------------------------------------------------------
// Compiler — tokenize → parse → codegen
// ---------------------------------------------------------------------------

/**
 * Determine whether a route body contains auth-specific nodes (Hash, ExistsCheck).
 *
 * @param {object[]} body - Array of AST statement nodes.
 * @returns {boolean}
 */
function isAuthRoute(body) {
  return body.some(
    (n) =>
      n.type === 'Hash' ||
      n.type === 'ExistsCheck' ||
      (n.type === 'Return' && n.value === 'token') ||
      (n.type === 'Return' && n.value === 'current user') ||
      (n.type === 'Validate' && n.rule === 'matches'),
  );
}

/**
 * Determine whether a route body requires JWT auth middleware.
 *
 * @param {object[]} body
 * @returns {boolean}
 */
function requiresAuthMiddleware(body) {
  return body.some((n) => n.type === 'Auth' && n.required);
}

/**
 * Infer a singular model name from a route path.
 * e.g. '/posts' → 'post', '/users/me' → 'user'
 *
 * @param {string} routePath
 * @returns {string}
 */
function inferModelName(routePath) {
  const segments = routePath.split('/').filter(Boolean);
  if (!segments.length) return 'item';
  // Strip a leading ':param' segment or param suffix from the first segment
  const first = segments[0];
  const colonIdx = first.indexOf(':');
  const base = colonIdx !== -1 ? first.slice(0, colonIdx) : first;
  // Strip trailing 's' to get singular form
  return base.endsWith('s') ? base.slice(0, -1) : base;
}

/**
 * Compile a Trionary source string to a Node.js source string.
 *
 * @param {string} source - Raw .tri file contents.
 * @returns {string} Generated Node.js source code.
 */
/**
 * Compile a Trionary AST to a Node.js source string.
 *
 * @param {object} ast - Pre-parsed ProgramNode from the Trionary parser.
 * @param {string|null} [dbOverride] - Optional CLI --db flag value ('mongodb'|'postgres').
 * @returns {string} Generated Node.js source code.
 */
export function compileAst(ast, dbOverride = null) {
  resetImports();
  resetCustomPackages();

  // Select backend: CLI flag overrides source declaration
  const dbType = dbOverride || ast.dbType || 'mongodb';
  const backend = dbType === 'postgres' ? prismaBackend : mongooseBackend;

  const serverSection = [];
  const listenSection = [];
  const dbSection = [];
  const middlewareSection = [];
  const routeSection = [];
  const socketSection = [];
  let needsAuthMiddleware = false;

  // Pre-scan: detect whether any SocketNodes are present so we can adjust
  // the server startup to use http.createServer instead of app.listen directly.
  const hasSocket = ast.body.some((n) => n.type === 'Socket');

  for (const node of ast.body) {
    switch (node.type) {
      case 'ServerDeclaration': {
        addImport('express', 'express');
        serverSection.push(`const app = express();`);
        const portExpr = node.envVar
          ? `process.env.${node.envVar} || 3000`
          : node.port;
        serverSection.push(`const PORT = ${portExpr};`);
        if (hasSocket) {
          addImport('http', 'http');
          addImport('ws', '{ WebSocket, WebSocketServer }');
          serverSection.push(`const _server = http.createServer(app);`);
          serverSection.push(`const _wss = new WebSocketServer({ server: _server });`);
          listenSection.push(
            `_server.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});`,
          );
        } else {
          listenSection.push(
            `app.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});`,
          );
        }
        break;
      }

      case 'DatabaseDeclaration': {
        if (dbType !== 'postgres') {
          addImport('mongoose', 'mongoose');
        }
        dbSection.push(backend.generateDatabase(node));
        break;
      }

      case 'MiddlewareDeclaration': {
        middlewareSection.push(generateMiddleware(node));
        break;
      }

      case 'Middleware': {
        middlewareSection.push(generateCustomMiddleware(node));
        break;
      }

      case 'Route': {
        const authRequired = requiresAuthMiddleware(node.body);
        if (authRequired) needsAuthMiddleware = true;

        let handlerBody;
        if (isAuthRoute(node.body)) {
          handlerBody = generateAuthStatements(node.body);
        } else {
          const modelName = inferModelName(node.path);
          handlerBody = backend.generateCrudStatements(node.body, modelName, node.method);
        }

        routeSection.push(
          generateRouteWithAuth(node.method.toLowerCase(), node.path, handlerBody, authRequired),
        );
        break;
      }

      case 'Socket': {
        socketSection.push(generateSocketHandler(node));
        break;
      }

      default:
        break;
    }
  }

  // If any route registered express.json is still needed for body parsing
  if (routeSection.length > 0 || middlewareSection.length > 0) {
    addImport('express', 'express');
  }

  // Build final output
  const sections = [];

  const importBlock = generateImports();
  if (importBlock) sections.push(importBlock);

  // For Prisma, prepend the prisma client import + instantiation
  if (dbType === 'postgres') {
    sections.push(prismaBackend.generateModels());
  }

  if (serverSection.length) sections.push(serverSection.join('\n'));

  // Body parser middleware — always inject when express is used
  sections.push(`app.use(express.json());\napp.use(express.urlencoded({ extended: true }));`);

  if (dbSection.length) sections.push(dbSection.join('\n'));
  if (middlewareSection.length) sections.push(middlewareSection.join('\n'));

  // Emit model definitions between the database connection and route handlers.
  if (dbType !== 'postgres') {
    const modelsBlock = backend.generateModels(ast);
    if (modelsBlock) sections.push(modelsBlock);
  }

  if (needsAuthMiddleware) sections.push(generateAuthMiddleware());

  if (routeSection.length) sections.push(routeSection.join('\n\n'));

  if (socketSection.length) sections.push(socketSection.join('\n\n'));

  if (listenSection.length) sections.push(listenSection.join('\n'));

  return sections.join('\n\n');
}

/**
 * Compile a Trionary source string to a Node.js source string.
 *
 * @param {string} source - Raw .tri file contents.
 * @param {string|null} [dbOverride] - Optional database backend override ('mongodb'|'postgres').
 * @returns {string} Generated Node.js source code.
 */
export function compile(source, dbOverride = null) {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  return compileAst(ast, dbOverride);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * trionary init
 * Creates a starter app.tri and .env file in the current directory.
 */
async function cmdInit() {
  const triContent = [
    'server port 3000',
    '',
    'database connect "mongodb://localhost/myapp"',
    '',
    'middleware cors',
    'middleware logs',
    '',
    'route GET /health',
    '  return ok',
  ].join('\n');

  const envContent = ['JWT_SECRET=changeme', 'PORT=3000', ''].join('\n');

  if (existsSync('app.tri')) {
    console.error('⚠ app.tri already exists. Remove it first to re-initialise.');
    process.exit(1);
  }

  await writeFile('app.tri', triContent, 'utf8');
  await writeFile('.env', envContent, 'utf8');

  console.log('✅ Trionary project initialised. Edit app.tri then run: trionary dev');
}

/**
 * Resolve a .tri file path, ensuring the .tri extension.
 *
 * @param {string} filePath
 * @returns {string} Absolute resolved path.
 */
function resolveTriFile(filePath) {
  const ext = extname(filePath);
  const withExt = ext === '.tri' ? filePath : `${filePath}.tri`;
  return resolve(process.cwd(), withExt);
}

/**
 * Derive the output .js path from a .tri path.
 *
 * @param {string} triPath - Absolute .tri path.
 * @returns {string} Absolute .js path.
 */
function outputPath(triPath) {
  const base = basename(triPath, '.tri');
  return resolve(dirname(triPath), `${base}.js`);
}

/**
 * trionary build <file> [--db <mongodb|postgres>]
 * Compiles a .tri file and writes the output .js next to it.
 * If the source references any env vars (via `env` keyword), a `.env.example`
 * file is written alongside the compiled output.
 * For PostgreSQL targets a `schema.prisma` file is emitted.
 *
 * @param {string} filePath
 * @param {string|null} [dbOverride]
 * @returns {Promise<string>} The resolved output path.
 */
async function cmdBuild(filePath, dbOverride = null) {
  const triPath = resolveTriFile(filePath);

  if (!existsSync(triPath)) {
    throw new TrinaryError(`File not found: ${triPath}`, { source: 'cli' });
  }

  const source = await readFile(triPath, 'utf8');

  // Parse once; run the import resolver; reuse the AST for both compilation and env-var collection
  const ast = resolveImports(parse(tokenize(source)), triPath);
  const output = compileAst(ast, dbOverride);
  const outPath = outputPath(triPath);

  await writeFile(outPath, output, 'utf8');
  console.log(`✅ Compiled to ${outPath}`);

  // Determine effective db type
  const dbType = dbOverride || ast.dbType || 'mongodb';

  // Emit schema.prisma for PostgreSQL targets
  if (dbType === 'postgres') {
    const schemaPath = resolve(dirname(outPath), 'schema.prisma');
    await writeFile(schemaPath, prismaBackend.generatePrismaSchema(ast), 'utf8');
    console.log(`✅ Written ${schemaPath}`);
  }

  // Collect env var names referenced in the source
  const envVars = [];
  for (const node of ast.body) {
    if (node.type === 'ServerDeclaration' && node.envVar) {
      envVars.push(node.envVar);
    }
    if (node.type === 'DatabaseDeclaration' && node.envVar) {
      envVars.push(node.envVar);
    }
  }
  // Always include DATABASE_URL for postgres targets
  if (dbType === 'postgres' && !envVars.includes('DATABASE_URL')) {
    envVars.push('DATABASE_URL');
  }

  if (envVars.length > 0) {
    const envExamplePath = resolve(dirname(outPath), '.env.example');
    await writeFile(envExamplePath, generateEnvExample(envVars), 'utf8');
    console.log(`✅ Written ${envExamplePath}`);
  }

  // Generate package.json with custom middleware package dependencies
  const customPkgs = getCustomPackages();
  if (customPkgs.length > 0) {
    const pkgJsonPath = resolve(dirname(outPath), 'package.json');
    if (existsSync(pkgJsonPath)) {
      console.warn(`⚠ ${pkgJsonPath} already exists — skipping package.json generation. Add these packages manually: ${customPkgs.join(', ')}`);
    } else {
      const dependencies = {};
      for (const pkg of customPkgs) {
        dependencies[pkg] = '*';
      }
      const pkgJson = JSON.stringify({ dependencies }, null, 2) + '\n';
      await writeFile(pkgJsonPath, pkgJson, 'utf8');
      console.log(`✅ Written ${pkgJsonPath} — pin dependency versions before deploying to production.`);
    }
  }

  return outPath;
}

/**
 * Start the compiled server with node, returning the child process.
 *
 * @param {string} jsPath - Absolute path to the compiled .js file.
 * @returns {import('child_process').ChildProcess}
 */
function startServer(jsPath) {
  const child = spawn(process.execPath, [jsPath], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  child.on('error', (err) => {
    process.stderr.write(`[trionary] server error: ${err.message}\n`);
  });
  return child;
}

/**
 * trionary dev <file> [--db <mongodb|postgres>]
 * Builds the .tri file, starts the compiled server, then watches for changes.
 * On each change the server is stopped, the file is rebuilt, and the server
 * is restarted.
 *
 * @param {string} filePath
 * @param {string|null} [dbOverride]
 */
async function cmdDev(filePath, dbOverride = null) {
  const triPath = resolveTriFile(filePath);

  // Dynamic import of chokidar (ESM-only package)
  const { watch } = await import('chokidar');

  let jsPath;
  try {
    jsPath = await cmdBuild(filePath, dbOverride);
  } catch (err) {
    handleError(err);
    process.exit(1);
  }

  let serverProcess = startServer(jsPath);

  console.log(`🔄 Watching ${triPath} for changes...`);

  const watcher = watch(triPath, { persistent: true });

  watcher.on('change', async () => {
    console.log(`\n🔄 Change detected — rebuilding...`);

    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill();
    }

    try {
      jsPath = await cmdBuild(filePath, dbOverride);
      serverProcess = startServer(jsPath);
    } catch (err) {
      handleError(err);
      // Don't exit — keep watching for the next save
    }
  });
}

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

/**
 * Print a TrinaryError (or generic Error) to stderr.
 *
 * @param {unknown} err
 */
function handleError(err) {
  if (err instanceof TrinaryError) {
    process.stderr.write(err.toString() + '\n');
  } else if (err instanceof Error) {
    process.stderr.write(`Error: ${err.message}\n`);
  } else {
    process.stderr.write(`Unknown error: ${String(err)}\n`);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const [, , command, ...args] = process.argv;

  // Extract optional --db flag from args
  let dbOverride = null;
  const dbFlagIndex = args.indexOf('--db');
  if (dbFlagIndex !== -1 && args[dbFlagIndex + 1]) {
    dbOverride = args[dbFlagIndex + 1];
    args.splice(dbFlagIndex, 2);
    if (dbOverride !== 'mongodb' && dbOverride !== 'postgres') {
      process.stderr.write(`Error: --db must be 'mongodb' or 'postgres'\n`);
      process.exit(1);
    }
  }

  try {
    switch (command) {
      case 'init':
        await cmdInit();
        break;

      case 'build': {
        const file = args[0];
        if (!file) {
          process.stderr.write('Usage: trionary build <file> [--db <mongodb|postgres>]\n');
          process.exit(1);
        }
        await cmdBuild(file, dbOverride);
        break;
      }

      case 'dev': {
        const file = args[0];
        if (!file) {
          process.stderr.write('Usage: trionary dev <file> [--db <mongodb|postgres>]\n');
          process.exit(1);
        }
        await cmdDev(file, dbOverride);
        break;
      }

      default:
        process.stderr.write(
          'Usage:\n  trionary init\n  trionary build <file> [--db <mongodb|postgres>]\n  trionary dev <file> [--db <mongodb|postgres>]\n',
        );
        process.exit(1);
    }
  } catch (err) {
    handleError(err);
    process.exit(1);
  }
}

// Only run the CLI when this file is executed directly (not when imported as a module in tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
