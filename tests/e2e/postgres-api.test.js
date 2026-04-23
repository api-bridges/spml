// tests/e2e/postgres-api.test.js
// End-to-end test: compiles examples/postgres-api.tri with the PostgreSQL
// backend and verifies that Prisma client code and schema.prisma are generated
// correctly for all product CRUD routes.

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { compileAst } from '../../src/cli/index.js';
import { resolveImports } from '../../src/compiler/resolve.js';
import { tokenize } from '../../src/lexer/lexer.js';
import { parse } from '../../src/parser/parser.js';
import { generatePrismaSchema } from '../../src/codegen/backends/prisma.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = join(__dirname, '../../examples');
const TMP_DIR = join('/tmp', 'trionary-e2e-postgres');

describe('postgres-api.tri — end-to-end compilation with PostgreSQL backend', () => {
  let output;
  let prismaSchema;
  let resolvedAst;

  beforeAll(() => {
    if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

    const filePath = join(EXAMPLES_DIR, 'postgres-api.tri');
    const source = readFileSync(filePath, 'utf8');
    resolvedAst = resolveImports(parse(tokenize(source)), filePath);
    output = compileAst(resolvedAst, 'postgres');
    prismaSchema = generatePrismaSchema(resolvedAst);

    writeFileSync(join(TMP_DIR, 'postgres-api.js'), output, 'utf8');
    writeFileSync(join(TMP_DIR, 'schema.prisma'), prismaSchema, 'utf8');
  });

  afterAll(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  // ── Compilation succeeds ───────────────────────────────────────────────────

  it('compiles without throwing', () => {
    expect(output).toBeTruthy();
    expect(typeof output).toBe('string');
  });

  it('writes compiled JS to temp directory', () => {
    expect(existsSync(join(TMP_DIR, 'postgres-api.js'))).toBe(true);
  });

  it('writes schema.prisma to temp directory', () => {
    expect(existsSync(join(TMP_DIR, 'schema.prisma'))).toBe(true);
  });

  // ── Prisma client usage ────────────────────────────────────────────────────

  it('imports PrismaClient instead of Mongoose', () => {
    expect(output).toContain("from '@prisma/client'");
    expect(output).not.toContain("from 'mongoose'");
  });

  it('instantiates a PrismaClient', () => {
    expect(output).toContain('new PrismaClient()');
    expect(output).toContain('const prisma');
  });

  it('does not call mongoose.connect', () => {
    expect(output).not.toContain('mongoose.connect');
  });

  it('uses Prisma lazy-connection comment', () => {
    expect(output).toContain('Prisma connects automatically');
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

  // ── Product routes ─────────────────────────────────────────────────────────

  it('defines GET /products route', () => {
    expect(output).toContain("app.get('/products'");
  });

  it('defines POST /products route guarded by authRequired', () => {
    expect(output).toContain("app.post('/products'");
    expect(output).toContain('authRequired');
  });

  it('defines GET /products/:id route', () => {
    expect(output).toContain("app.get('/products/:id'");
  });

  it('defines PUT /products/:id route', () => {
    expect(output).toContain("app.put('/products/:id'");
  });

  it('defines PATCH /products/:id route', () => {
    expect(output).toContain("app.patch('/products/:id'");
  });

  it('defines DELETE /products/:id route', () => {
    expect(output).toContain("app.delete('/products/:id'");
  });

  // ── Prisma CRUD calls ──────────────────────────────────────────────────────

  it('GET /products uses prisma.product.findMany', () => {
    expect(output).toContain('prisma.product.findMany');
  });

  it('POST /products uses prisma.product.create', () => {
    expect(output).toContain('prisma.product.create');
  });

  it('GET /products/:id uses prisma.product.findUnique', () => {
    expect(output).toContain('prisma.product.findUnique');
  });

  it('PUT /products/:id uses prisma.product.update', () => {
    expect(output).toContain('prisma.product.update');
  });

  it('DELETE /products/:id uses prisma.product.delete', () => {
    expect(output).toContain('prisma.product.delete');
  });

  it('product not-found returns 404', () => {
    expect(output).toContain('404');
    expect(output).toContain('Not found');
  });

  // ── Auth middleware ────────────────────────────────────────────────────────

  it('generates authRequired middleware', () => {
    expect(output).toContain('authRequired');
    expect(output).toContain('jwt.verify');
  });

  // ── schema.prisma content ──────────────────────────────────────────────────

  it('schema.prisma declares postgresql provider', () => {
    expect(prismaSchema).toContain('provider = "postgresql"');
  });

  it('schema.prisma references DATABASE_URL env var', () => {
    expect(prismaSchema).toContain('DATABASE_URL');
  });

  it('schema.prisma defines a Product model', () => {
    expect(prismaSchema).toContain('model Product {');
  });

  it('schema.prisma Product model has auto-increment id', () => {
    expect(prismaSchema).toContain('@id @default(autoincrement())');
  });

  it('schema.prisma Product model includes name and price fields', () => {
    expect(prismaSchema).toContain('name');
    expect(prismaSchema).toContain('price');
  });

  it('schema.prisma generates a prisma-client-js client', () => {
    expect(prismaSchema).toContain('provider = "prisma-client-js"');
  });
});
