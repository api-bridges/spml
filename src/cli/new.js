// src/cli/new.js
// Implements the `trionary new <project-name>` command.
// Interactively prompts for database type, authentication, and starter routes,
// then scaffolds a ready-to-run Trionary project directory.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { select, confirm, input } from '@inquirer/prompts';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the bundled templates directory. */
const TEMPLATES_DIR = resolve(__dirname, '../templates');

/**
 * Derive the template filename from the answers.
 *
 * @param {string} db       - 'mongodb' | 'postgres' | 'sqlite'
 * @param {string} routes   - 'blank' | 'blog' | 'ecommerce'
 * @param {boolean} auth
 * @returns {string} Template file name (without directory).
 */
function templateName(db, routes, auth) {
  const suffix = auth ? `-${db}-auth` : `-${db}`;
  return `${routes}${suffix}.tri`;
}

/**
 * Replace all occurrences of `{{PROJECT_NAME}}` with the actual project name.
 *
 * @param {string} content
 * @param {string} projectName
 * @returns {string}
 */
function substituteProjectName(content, projectName) {
  return content.replaceAll('{{PROJECT_NAME}}', projectName);
}

/**
 * Run `npm install` inside the given directory, printing live output.
 *
 * @param {string} cwd - Directory to run `npm install` in.
 * @returns {Promise<void>}
 */
function npmInstall(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install'],
      { cwd, stdio: 'inherit' },
    );
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`npm install exited with code ${code}`));
      }
    });
  });
}

/**
 * `trionary new [projectName]`
 * Interactively scaffold a new Trionary project.
 *
 * @param {string|undefined} nameArg - Optional project name from CLI argument.
 */
export async function cmdNew(nameArg) {
  // ── 1. Project name ─────────────────────────────────────────────────────────
  let projectName = nameArg;
  if (!projectName) {
    projectName = await input({
      message: 'Project name:',
      default: 'my-api',
      validate: (v) => (v.trim().length > 0 ? true : 'Project name cannot be empty'),
    });
  }
  projectName = projectName.trim();

  const targetDir = resolve(process.cwd(), projectName);

  if (existsSync(targetDir)) {
    process.stderr.write(`Error: directory "${projectName}" already exists.\n`);
    process.exit(1);
  }

  // ── 2. Database type ─────────────────────────────────────────────────────────
  const db = await select({
    message: 'Database type:',
    choices: [
      { name: 'MongoDB  (Mongoose)', value: 'mongodb' },
      { name: 'PostgreSQL  (Prisma)', value: 'postgres' },
      { name: 'SQLite  (Prisma — great for local dev)', value: 'sqlite' },
    ],
  });

  // ── 3. Authentication ────────────────────────────────────────────────────────
  const auth = await confirm({
    message: 'Include authentication routes (register / login / /me)?',
    default: true,
  });

  // ── 4. Starter routes ────────────────────────────────────────────────────────
  const routes = await select({
    message: 'Starter routes:',
    choices: [
      { name: 'Blog  (posts + users)', value: 'blog' },
      { name: 'E-commerce  (products + orders)', value: 'ecommerce' },
      { name: 'Blank  (health check only)', value: 'blank' },
    ],
  });

  // ── 5. Read template files ───────────────────────────────────────────────────
  const triTemplateName = templateName(db, routes, auth);
  const triTemplatePath = resolve(TEMPLATES_DIR, triTemplateName);

  if (!existsSync(triTemplatePath)) {
    process.stderr.write(`Internal error: template "${triTemplateName}" not found.\n`);
    process.exit(1);
  }

  const triContent = substituteProjectName(
    await readFile(triTemplatePath, 'utf8'),
    projectName,
  );

  const envTemplatePath = resolve(TEMPLATES_DIR, `env-${db}`);
  const envContent = substituteProjectName(
    await readFile(envTemplatePath, 'utf8'),
    projectName,
  );

  // ── 6. Write project files ───────────────────────────────────────────────────
  await mkdir(targetDir, { recursive: true });

  const triFile = resolve(targetDir, 'app.tri');
  const envFile = resolve(targetDir, '.env');

  await writeFile(triFile, triContent, 'utf8');
  await writeFile(envFile, envContent, 'utf8');

  // Minimal package.json so `npm install` resolves the runtime deps
  const pkgJson = JSON.stringify(
    {
      name: projectName,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'trionary dev app.tri',
        build: 'trionary build app.tri',
      },
      dependencies: {},
    },
    null,
    2,
  ) + '\n';
  await writeFile(resolve(targetDir, 'package.json'), pkgJson, 'utf8');

  console.log(`\n✅  Created ${projectName}/`);
  console.log(`   ${projectName}/app.tri`);
  console.log(`   ${projectName}/.env`);
  console.log(`   ${projectName}/package.json`);

  // ── 7. Run npm install ───────────────────────────────────────────────────────
  console.log('\n📦  Installing dependencies…');
  try {
    await npmInstall(targetDir);
  } catch (err) {
    process.stderr.write(
      `\n⚠  npm install failed: ${err.message}\n` +
        `   Run "npm install" manually inside the ${projectName}/ directory.\n`,
    );
  }

  // ── 8. Next steps ────────────────────────────────────────────────────────────
  console.log(`\n🎉  Your project is ready!`);
  console.log(`\n   Next steps:\n`);
  console.log(`     cd ${projectName}`);
  console.log(`     trionary dev app.tri\n`);
  if (db === 'postgres' || db === 'sqlite') {
    console.log(`   After building, initialise Prisma:\n`);
    console.log(`     npx prisma generate`);
    if (db === 'sqlite') {
      console.log(`     npx prisma db push\n`);
    } else {
      console.log(`     npx prisma migrate dev\n`);
    }
  }
}
