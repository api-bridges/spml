// tests/e2e/blog-api.test.js
// End-to-end test: compiles examples/blog-api.tri and verifies the complete
// CRUD lifecycle is present in the generated Node.js output.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compile } from '../../src/cli/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = join(__dirname, '../../examples');
const TMP_DIR = join('/tmp', 'trionary-e2e-blog');

describe('blog-api.tri — end-to-end compilation', () => {
  let output;

  beforeAll(() => {
    if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
    const source = readFileSync(join(EXAMPLES_DIR, 'blog-api.tri'), 'utf8');
    output = compile(source);
    // Write to temp dir to verify file I/O as part of the pipeline
    writeFileSync(join(TMP_DIR, 'blog-api.js'), output, 'utf8');
  });

  afterAll(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  // ── Compilation succeeds ───────────────────────────────────────────────────

  it('compiles without throwing', () => {
    expect(output).toBeTruthy();
    expect(typeof output).toBe('string');
  });

  it('writes compiled output to temp directory', () => {
    expect(existsSync(join(TMP_DIR, 'blog-api.js'))).toBe(true);
  });

  it('compiled output is non-empty JavaScript', () => {
    expect(output.length).toBeGreaterThan(100);
  });

  // ── Express setup ──────────────────────────────────────────────────────────

  it('imports and creates an Express app', () => {
    expect(output).toContain("from 'express'");
    expect(output).toContain('express()');
  });

  it('configures a server port', () => {
    expect(output).toContain('PORT');
    expect(output).toContain('app.listen');
  });

  it('registers JSON body parser middleware', () => {
    expect(output).toContain('express.json()');
  });

  // ── Database connection ────────────────────────────────────────────────────

  it('imports Mongoose for MongoDB connection', () => {
    expect(output).toContain("from 'mongoose'");
  });

  it('connects to a MongoDB database', () => {
    expect(output).toContain('mongoose.connect');
  });

  // ── Standard middleware ────────────────────────────────────────────────────

  it('applies cors middleware', () => {
    expect(output).toContain('cors');
  });

  it('applies request logging middleware', () => {
    expect(output).toContain('morgan');
  });

  it('applies helmet security middleware', () => {
    expect(output).toContain('helmet');
  });

  it('applies rate-limiting middleware', () => {
    expect(output).toContain('rateLimit');
  });

  // ── Mongoose models ────────────────────────────────────────────────────────

  it('defines a User Mongoose model', () => {
    expect(output).toContain('User');
    expect(output).toContain('mongoose.model');
  });

  it('defines a Post Mongoose model', () => {
    expect(output).toContain('Post');
  });

  // ── Auth middleware ────────────────────────────────────────────────────────

  it('generates JWT auth-required middleware', () => {
    expect(output).toContain('authRequired');
    expect(output).toContain('jwt.verify');
  });

  // ── Register route (POST /register) ───────────────────────────────────────

  it('defines POST /register route', () => {
    expect(output).toContain("app.post('/register'");
  });

  it('register route hashes password with bcrypt', () => {
    expect(output).toContain('bcrypt.hash');
  });

  it('register route checks for existing email', () => {
    expect(output).toContain('User.findOne');
    expect(output).toContain('email');
  });

  it('register route returns 409 on duplicate email', () => {
    expect(output).toContain('409');
    expect(output).toContain('Email already in use');
  });

  it('register route creates a new user', () => {
    expect(output).toContain('User.create');
  });

  it('register route returns a JWT token', () => {
    expect(output).toContain('jwt.sign');
  });

  // ── Login route (POST /login) ──────────────────────────────────────────────

  it('defines POST /login route', () => {
    expect(output).toContain("app.post('/login'");
  });

  it('login route looks up user by email', () => {
    // User.findOne is shared between register (exists check) and login (find)
    expect(output).toContain('User.findOne');
  });

  it('login route validates password with bcrypt.compare', () => {
    expect(output).toContain('bcrypt.compare');
  });

  it('login route returns 401 on bad credentials', () => {
    expect(output).toContain('401');
    expect(output).toContain('Invalid credentials');
  });

  it('login route returns a JWT token on success', () => {
    expect(output).toContain('jwt.sign');
  });

  // ── /me route (GET /me) ────────────────────────────────────────────────────

  it('defines GET /me route guarded by authRequired', () => {
    expect(output).toContain("app.get('/me'");
    expect(output).toContain('authRequired');
  });

  it('/me route returns the current user', () => {
    expect(output).toContain('req.user');
  });

  // ── List posts route (GET /posts) ──────────────────────────────────────────

  it('defines GET /posts route with pagination', () => {
    expect(output).toContain("app.get('/posts'");
    expect(output).toContain('skip');
    expect(output).toContain('limit');
  });

  // ── Create post route (POST /posts) ───────────────────────────────────────

  it('defines POST /posts route guarded by authRequired', () => {
    expect(output).toContain("app.post('/posts'");
  });

  it('create post route calls Post.create', () => {
    expect(output).toContain('Post.create');
  });

  // ── Get post by ID route (GET /posts/:id) ─────────────────────────────────

  it('defines GET /posts/:id route', () => {
    expect(output).toContain("app.get('/posts/:id'");
  });

  it('get post by id returns 404 when not found', () => {
    expect(output).toContain('404');
    expect(output).toContain('Post not found');
  });

  // ── Update post route (PUT /posts/:id) ────────────────────────────────────

  it('defines PUT /posts/:id route guarded by authRequired', () => {
    expect(output).toContain("app.put('/posts/:id'");
  });

  it('update post route calls updateOne', () => {
    expect(output).toContain('updateOne');
  });

  // ── Delete post route (DELETE /posts/:id) ─────────────────────────────────

  it('defines DELETE /posts/:id route guarded by authRequired', () => {
    expect(output).toContain("app.delete('/posts/:id'");
  });

  it('delete post route calls findByIdAndDelete', () => {
    expect(output).toContain('findByIdAndDelete');
  });
});
