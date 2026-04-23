// tests/cli/new.test.js
// Unit tests for the `trionary new` command (src/cli/new.js).
// Inquirer prompts are replaced with a mock module; filesystem operations use
// a temporary directory so the tests are fully isolated.

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdtemp, rm, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Change the current working directory for the duration of a test and restore
 * it afterwards, regardless of how the test ends.
 */
function useCwd(dir) {
  const original = process.cwd();
  process.chdir(dir);
  return () => process.chdir(original);
}

// ── mock @inquirer/prompts ────────────────────────────────────────────────────
// We intercept the real interactive prompts with synchronous mocks that return
// whatever the test has configured.

let _answers = {};

jest.unstable_mockModule('@inquirer/prompts', () => ({
  input: jest.fn(async ({ default: def }) => _answers.name ?? def ?? 'my-api'),
  select: jest.fn(async ({ message }) => {
    if (/database/i.test(message)) return _answers.db ?? 'mongodb';
    if (/starter/i.test(message)) return _answers.routes ?? 'blank';
    return undefined;
  }),
  confirm: jest.fn(async () => _answers.auth ?? false),
}));

// Mock child_process.spawn to avoid actually running npm install.
let spawnMock;
jest.unstable_mockModule('child_process', () => {
  spawnMock = jest.fn(() => {
    const emitter = { on: jest.fn() };
    // Simulate successful npm install
    emitter.on.mockImplementation((event, cb) => {
      if (event === 'close') setTimeout(() => cb(0), 0);
      return emitter;
    });
    return emitter;
  });
  return { spawn: spawnMock };
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('cmdNew', () => {
  let tmpDir;
  let restoreCwd;
  let cmdNew;

  beforeEach(async () => {
    // Create a fresh temp directory and cd into it for each test.
    tmpDir = await mkdtemp(resolve(tmpdir(), 'trionary-test-'));
    restoreCwd = useCwd(tmpDir);
    _answers = {};

    // Dynamic import AFTER mocks are installed so the mocks apply.
    ({ cmdNew } = await import('../../src/cli/new.js'));
  });

  afterEach(async () => {
    restoreCwd();
    await rm(tmpDir, { recursive: true, force: true });
    // Reset module cache so mocks are re-applied on the next import.
    jest.resetModules();
  });

  it('scaffolds a blank MongoDB project when name is supplied as argument', async () => {
    _answers = { db: 'mongodb', auth: false, routes: 'blank' };

    await cmdNew('test-api');

    const projectDir = resolve(tmpDir, 'test-api');
    expect(existsSync(projectDir)).toBe(true);

    const triContent = await readFile(resolve(projectDir, 'app.tri'), 'utf8');
    expect(triContent).toContain('server port env PORT');
    expect(triContent).toContain('database connect env MONGODB_URI');
    // Blank template has no register route
    expect(triContent).not.toContain('route POST /register');

    const envContent = await readFile(resolve(projectDir, '.env'), 'utf8');
    expect(envContent).toContain('MONGODB_URI=mongodb://localhost/test-api');

    const pkgContent = await readFile(resolve(projectDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(pkgContent);
    expect(pkg.name).toBe('test-api');
    expect(pkg.type).toBe('module');
  });

  it('scaffolds a blog MongoDB project with auth', async () => {
    _answers = { db: 'mongodb', auth: true, routes: 'blog' };

    await cmdNew('blog-api');

    const projectDir = resolve(tmpDir, 'blog-api');
    const triContent = await readFile(resolve(projectDir, 'app.tri'), 'utf8');

    expect(triContent).toContain('route POST /register');
    expect(triContent).toContain('route GET /posts');
    expect(triContent).toContain('route POST /posts');
  });

  it('scaffolds a blog PostgreSQL project with auth', async () => {
    _answers = { db: 'postgres', auth: true, routes: 'blog' };

    await cmdNew('pg-blog');

    const projectDir = resolve(tmpDir, 'pg-blog');
    const triContent = await readFile(resolve(projectDir, 'app.tri'), 'utf8');

    expect(triContent).toContain('database type postgres');
    expect(triContent).toContain('database connect env DATABASE_URL');
    expect(triContent).toContain('route POST /register');
    expect(triContent).toContain('route GET /posts');

    const envContent = await readFile(resolve(projectDir, '.env'), 'utf8');
    expect(envContent).toContain('DATABASE_URL=postgresql://');
  });

  it('scaffolds a blank SQLite project without auth', async () => {
    _answers = { db: 'sqlite', auth: false, routes: 'blank' };

    await cmdNew('lite-api');

    const projectDir = resolve(tmpDir, 'lite-api');
    const triContent = await readFile(resolve(projectDir, 'app.tri'), 'utf8');

    expect(triContent).toContain('database type sqlite');
    expect(triContent).not.toContain('route POST /register');

    const envContent = await readFile(resolve(projectDir, '.env'), 'utf8');
    // SQLite does not need MONGODB_URI or DATABASE_URL
    expect(envContent).not.toContain('MONGODB_URI');
    expect(envContent).not.toContain('DATABASE_URL');
  });

  it('scaffolds an e-commerce SQLite project with auth', async () => {
    _answers = { db: 'sqlite', auth: true, routes: 'ecommerce' };

    await cmdNew('shop');

    const projectDir = resolve(tmpDir, 'shop');
    const triContent = await readFile(resolve(projectDir, 'app.tri'), 'utf8');

    expect(triContent).toContain('route GET /products');
    expect(triContent).toContain('route GET /orders');
    expect(triContent).toContain('route POST /register');
  });

  it('uses the default project name from prompt when no argument is given', async () => {
    _answers = { name: 'prompted-name', db: 'mongodb', auth: false, routes: 'blank' };

    await cmdNew(undefined);

    const projectDir = resolve(tmpDir, 'prompted-name');
    expect(existsSync(projectDir)).toBe(true);
  });

  it('exits with an error if the target directory already exists', async () => {
    _answers = { db: 'mongodb', auth: false, routes: 'blank' };

    // Create the directory first to simulate the conflict.
    const { mkdir } = await import('fs/promises');
    await mkdir(resolve(tmpDir, 'conflict-api'));

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(cmdNew('conflict-api')).rejects.toThrow('process.exit called');

    exitSpy.mockRestore();
  });
});
