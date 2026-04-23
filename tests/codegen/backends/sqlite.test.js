import { describe, it, expect } from '@jest/globals';
import {
  generateModels,
  generateDatabase,
  generateCrudStatements,
  generatePrismaSchema,
} from '../../../src/codegen/backends/sqlite.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAST(routeBody) {
  return {
    type: 'Program',
    dbType: 'sqlite',
    body: [
      { type: 'Route', method: 'POST', path: '/items', body: routeBody },
    ],
  };
}

function field(name, fieldType = 'String') {
  return { type: 'Field', name, fieldType };
}

// ---------------------------------------------------------------------------
// generateModels (Prisma client initialisation — shared with postgres backend)
// ---------------------------------------------------------------------------

describe('sqlite backend — generateModels()', () => {
  it('emits PrismaClient import and instantiation', () => {
    const output = generateModels();
    expect(output).toContain("from '@prisma/client'");
    expect(output).toContain('new PrismaClient()');
  });
});

// ---------------------------------------------------------------------------
// generateDatabase
// ---------------------------------------------------------------------------

describe('sqlite backend — generateDatabase()', () => {
  it('emits a no-op comment', () => {
    const output = generateDatabase();
    expect(output).toContain('Prisma connects automatically');
  });
});

// ---------------------------------------------------------------------------
// generatePrismaSchema — SQLite-specific overrides
// ---------------------------------------------------------------------------

describe('sqlite backend — generatePrismaSchema()', () => {
  it('emits provider = "sqlite" (not postgresql)', () => {
    const ast = makeAST([
      { type: 'Create', model: 'note', fields: [field('title')] },
    ]);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('provider = "sqlite"');
    expect(schema).not.toContain('provider = "postgresql"');
  });

  it('emits file:./dev.db as the datasource url', () => {
    const ast = makeAST([
      { type: 'Create', model: 'note', fields: [field('title')] },
    ]);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('file:./dev.db');
  });

  it('does NOT reference DATABASE_URL', () => {
    const ast = makeAST([
      { type: 'Create', model: 'note', fields: [field('title')] },
    ]);
    const schema = generatePrismaSchema(ast);
    expect(schema).not.toContain('DATABASE_URL');
  });

  it('emits model block with id and createdAt', () => {
    const ast = makeAST([
      { type: 'Create', model: 'note', fields: [field('title')] },
    ]);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('model Note {');
    expect(schema).toContain('@id @default(autoincrement())');
    expect(schema).toContain('@default(now())');
  });

  it('maps Trionary Number type to Prisma Int', () => {
    const ast = makeAST([
      { type: 'Create', model: 'item', fields: [field('count', 'Number')] },
    ]);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('Int');
  });
});

// ---------------------------------------------------------------------------
// generateCrudStatements — delegates to Prisma backend
// ---------------------------------------------------------------------------

describe('sqlite backend — generateCrudStatements() find', () => {
  it('emits prisma.model.findMany for find all', () => {
    const stmts = [{ type: 'Find', target: 'note', filter: 'all', options: {} }];
    const output = generateCrudStatements(stmts, 'note', 'GET');
    expect(output).toContain('prisma.note.findMany(');
  });

  it('emits prisma.model.findUnique for find by id', () => {
    const stmts = [{ type: 'Find', target: 'note', filter: { by: 'id' }, options: {} }];
    const output = generateCrudStatements(stmts, 'note', 'GET');
    expect(output).toContain('prisma.note.findUnique(');
    expect(output).toContain('req.params.id');
  });
});

describe('sqlite backend — generateCrudStatements() create', () => {
  it('emits prisma.model.create', () => {
    const stmts = [{ type: 'Create', model: 'note', fields: [field('title')] }];
    const output = generateCrudStatements(stmts, 'note', 'POST');
    expect(output).toContain('prisma.note.create(');
    expect(output).toContain('req.body');
  });
});

describe('sqlite backend — generateCrudStatements() delete', () => {
  it('emits prisma.model.delete', () => {
    const stmts = [{ type: 'Delete', model: 'note', filter: 'id' }];
    const output = generateCrudStatements(stmts, 'note', 'DELETE');
    expect(output).toContain('prisma.note.delete(');
    expect(output).toContain('req.params.id');
  });
});
