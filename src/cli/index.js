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
import { spawn } from 'child_process';

import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { TrinaryError } from '../errors/TrinaryError.js';
import { generateServer } from '../codegen/server.js';
import { generateDatabase } from '../codegen/database.js';
import { generateMiddleware } from '../codegen/middleware.js';
import { generateAuthStatements } from '../codegen/auth.js';
import { generateAuthMiddleware, generateRouteWithAuth } from '../codegen/authMiddleware.js';
import { generateCrudStatements } from '../codegen/crud.js';
import { generateImports, resetImports, addImport } from '../codegen/imports.js';

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
  return body.some((n) => n.type === 'Hash' || n.type === 'ExistsCheck');
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
  const first = segments[0].replace(/:[^/]+$/, '');
  // Strip trailing 's' to get singular form
  return first.endsWith('s') ? first.slice(0, -1) : first;
}

/**
 * Compile a Trionary source string to a Node.js source string.
 *
 * @param {string} source - Raw .tri file contents.
 * @returns {string} Generated Node.js source code.
 */
export function compile(source) {
  resetImports();

  const tokens = tokenize(source);
  const ast = parse(tokens);

  const serverSection = [];
  const listenSection = [];
  const dbSection = [];
  const middlewareSection = [];
  const routeSection = [];
  let needsAuthMiddleware = false;

  for (const node of ast.body) {
    switch (node.type) {
      case 'ServerDeclaration': {
        addImport('express', 'express');
        serverSection.push(`const app = express();`);
        serverSection.push(`const PORT = ${node.port};`);
        listenSection.push(
          `app.listen(PORT, () => {\n  console.log(\`Server running on port \${PORT}\`);\n});`,
        );
        break;
      }

      case 'DatabaseDeclaration': {
        addImport('mongoose', 'mongoose');
        dbSection.push(generateDatabase(node));
        break;
      }

      case 'MiddlewareDeclaration': {
        middlewareSection.push(generateMiddleware(node));
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
          handlerBody = generateCrudStatements(node.body, modelName);
        }

        routeSection.push(
          generateRouteWithAuth(node.method.toLowerCase(), node.path, handlerBody, authRequired),
        );
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

  if (serverSection.length) sections.push(serverSection.join('\n'));

  // Body parser middleware — always inject when express is used
  sections.push(`app.use(express.json());\napp.use(express.urlencoded({ extended: true }));`);

  if (dbSection.length) sections.push(dbSection.join('\n'));
  if (middlewareSection.length) sections.push(middlewareSection.join('\n'));

  if (needsAuthMiddleware) sections.push(generateAuthMiddleware());

  if (routeSection.length) sections.push(routeSection.join('\n\n'));

  if (listenSection.length) sections.push(listenSection.join('\n'));

  return sections.join('\n\n');
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
 * trionary build <file>
 * Compiles a .tri file and writes the output .js next to it.
 *
 * @param {string} filePath
 * @returns {Promise<string>} The resolved output path.
 */
async function cmdBuild(filePath) {
  const triPath = resolveTriFile(filePath);

  if (!existsSync(triPath)) {
    throw new TrinaryError(`File not found: ${triPath}`, { source: 'cli' });
  }

  const source = await readFile(triPath, 'utf8');
  const output = compile(source);
  const outPath = outputPath(triPath);

  await writeFile(outPath, output, 'utf8');
  console.log(`✅ Compiled to ${outPath}`);

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
 * trionary dev <file>
 * Builds the .tri file, starts the compiled server, then watches for changes.
 * On each change the server is stopped, the file is rebuilt, and the server
 * is restarted.
 *
 * @param {string} filePath
 */
async function cmdDev(filePath) {
  const triPath = resolveTriFile(filePath);

  // Dynamic import of chokidar (ESM-only package)
  const { watch } = await import('chokidar');

  let jsPath;
  try {
    jsPath = await cmdBuild(filePath);
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
      jsPath = await cmdBuild(filePath);
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

  try {
    switch (command) {
      case 'init':
        await cmdInit();
        break;

      case 'build': {
        const file = args[0];
        if (!file) {
          process.stderr.write('Usage: trionary build <file>\n');
          process.exit(1);
        }
        await cmdBuild(file);
        break;
      }

      case 'dev': {
        const file = args[0];
        if (!file) {
          process.stderr.write('Usage: trionary dev <file>\n');
          process.exit(1);
        }
        await cmdDev(file);
        break;
      }

      default:
        process.stderr.write(
          'Usage:\n  trionary init\n  trionary build <file>\n  trionary dev <file>\n',
        );
        process.exit(1);
    }
  } catch (err) {
    handleError(err);
    process.exit(1);
  }
}

main();
