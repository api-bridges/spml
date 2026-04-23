// tests/e2e/multi-file-api.test.js
// End-to-end test: compiles examples/multi-file-api/index.tri (which imports
// routes from posts.tri and users.tri) and verifies all routes are resolved
// and present in the generated output.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compileAst } from '../../src/cli/index.js';
import { resolveImports } from '../../src/compiler/resolve.js';
import { tokenize } from '../../src/lexer/lexer.js';
import { parse } from '../../src/parser/parser.js';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MULTI_FILE_DIR = join(__dirname, '../../examples/multi-file-api');
const TMP_DIR = join('/tmp', 'trionary-e2e-multi-file');

describe('multi-file-api — end-to-end compilation with import resolution', () => {
  let output;
  let resolvedAst;

  beforeAll(() => {
    if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

    const indexPath = join(MULTI_FILE_DIR, 'index.tri');
    const source = readFileSync(indexPath, 'utf8');
    const ast = parse(tokenize(source));
    resolvedAst = resolveImports(ast, indexPath);
    output = compileAst(resolvedAst);
    writeFileSync(join(TMP_DIR, 'index.js'), output, 'utf8');
  });

  afterAll(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  // ── Import resolution ──────────────────────────────────────────────────────

  it('compiles without throwing', () => {
    expect(output).toBeTruthy();
    expect(typeof output).toBe('string');
  });

  it('resolves all import nodes (no ImportNode left in AST)', () => {
    const importNodes = resolvedAst.body.filter((n) => n.type === 'Import');
    expect(importNodes).toHaveLength(0);
  });

  it('merges routes from both imported files', () => {
    const routeNodes = resolvedAst.body.filter((n) => n.type === 'Route');
    // 5 routes from posts.tri + 3 routes from users.tri = 8 total
    expect(routeNodes).toHaveLength(8);
  });

  it('retains exactly one ServerDeclaration from the root file', () => {
    const serverNodes = resolvedAst.body.filter((n) => n.type === 'ServerDeclaration');
    expect(serverNodes).toHaveLength(1);
    expect(serverNodes[0].port).toBe(3000);
  });

  // ── Users routes (from users.tri) ─────────────────────────────────────────

  it('includes POST /register from users.tri', () => {
    expect(output).toContain("app.post('/register'");
  });

  it('includes POST /login from users.tri', () => {
    expect(output).toContain("app.post('/login'");
  });

  it('includes GET /me from users.tri', () => {
    expect(output).toContain("app.get('/me'");
  });

  // ── Posts routes (from posts.tri) ─────────────────────────────────────────

  it('includes GET /posts from posts.tri', () => {
    expect(output).toContain("app.get('/posts'");
  });

  it('includes POST /posts from posts.tri', () => {
    expect(output).toContain("app.post('/posts'");
  });

  it('includes GET /posts/:id from posts.tri', () => {
    expect(output).toContain("app.get('/posts/:id'");
  });

  it('includes PUT /posts/:id from posts.tri', () => {
    expect(output).toContain("app.put('/posts/:id'");
  });

  it('includes DELETE /posts/:id from posts.tri', () => {
    expect(output).toContain("app.delete('/posts/:id'");
  });

  // ── Auth from users.tri is fully compiled ─────────────────────────────────

  it('auth register flow: bcrypt.hash, User.create, jwt.sign all present', () => {
    expect(output).toContain('bcrypt.hash');
    expect(output).toContain('User.create');
    expect(output).toContain('jwt.sign');
  });

  it('auth login flow: bcrypt.compare present', () => {
    expect(output).toContain('bcrypt.compare');
  });

  it('generates authRequired middleware from imported auth routes', () => {
    expect(output).toContain('authRequired');
  });

  // ── Posts CRUD from posts.tri is fully compiled ───────────────────────────

  it('post creation calls Post.create', () => {
    expect(output).toContain('Post.create');
  });

  it('post listing uses pagination (skip/limit)', () => {
    expect(output).toContain('skip');
    expect(output).toContain('limit');
  });

  it('post update calls updateOne', () => {
    expect(output).toContain('updateOne');
  });

  it('post delete calls findByIdAndDelete', () => {
    expect(output).toContain('findByIdAndDelete');
  });

  it('post not-found returns 404', () => {
    expect(output).toContain('404');
    expect(output).toContain('Post not found');
  });

  // ── Root middleware ────────────────────────────────────────────────────────

  it('applies cors and morgan middleware from root index.tri', () => {
    expect(output).toContain('cors');
    expect(output).toContain('morgan');
  });

  // ── Compiled output is written to disk ────────────────────────────────────

  it('writes compiled output to temp directory', () => {
    expect(existsSync(join(TMP_DIR, 'index.js'))).toBe(true);
  });
});
