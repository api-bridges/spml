import { describe, it, expect } from '@jest/globals';
import {
  generateModels,
  generateDatabase,
  generateCrudStatements,
  generatePrismaSchema,
} from '../../../src/codegen/backends/prisma.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAST(routeBody) {
  return {
    type: 'Program',
    dbType: 'postgres',
    body: [
      { type: 'Route', method: 'POST', path: '/items', body: routeBody },
    ],
  };
}

function field(name, fieldType = 'String') {
  return { type: 'Field', name, fieldType };
}

// ---------------------------------------------------------------------------
// generateModels (Prisma client initialisation)
// ---------------------------------------------------------------------------

describe('prisma backend — generateModels()', () => {
  it('emits PrismaClient import and instantiation', () => {
    const output = generateModels();
    expect(output).toContain("from '@prisma/client'");
    expect(output).toContain('new PrismaClient()');
  });
});

// ---------------------------------------------------------------------------
// generateDatabase
// ---------------------------------------------------------------------------

describe('prisma backend — generateDatabase()', () => {
  it('emits a no-op comment', () => {
    const output = generateDatabase();
    expect(output).toContain('Prisma connects automatically');
  });
});

// ---------------------------------------------------------------------------
// generatePrismaSchema
// ---------------------------------------------------------------------------

describe('prisma backend — generatePrismaSchema()', () => {
  it('emits datasource postgresql block', () => {
    const ast = makeAST([
      { type: 'Create', model: 'product', fields: [field('name'), field('price', 'Number')] },
    ]);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('provider = "postgresql"');
    expect(schema).toContain('DATABASE_URL');
  });

  it('emits model block with id and createdAt', () => {
    const ast = makeAST([
      { type: 'Create', model: 'product', fields: [field('name')] },
    ]);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('model Product {');
    expect(schema).toContain('@id @default(autoincrement())');
    expect(schema).toContain('@default(now())');
  });

  it('maps Trionary Number type to Prisma Int', () => {
    const ast = makeAST([
      { type: 'Create', model: 'product', fields: [field('price', 'Number')] },
    ]);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('Int');
  });

  it('maps Trionary Boolean type to Prisma Boolean', () => {
    const ast = makeAST([
      { type: 'Create', model: 'item', fields: [field('active', 'Boolean')] },
    ]);
    const schema = generatePrismaSchema(ast);
    expect(schema).toContain('Boolean');
  });
});

// ---------------------------------------------------------------------------
// generateCrudStatements — find
// ---------------------------------------------------------------------------

describe('prisma backend — generateCrudStatements() find', () => {
  it('emits prisma.model.findMany for find all', () => {
    const stmts = [{ type: 'Find', target: 'product', filter: 'all', options: {} }];
    const output = generateCrudStatements(stmts, 'product', 'GET');
    expect(output).toContain('prisma.product.findMany(');
  });

  it('emits prisma.model.findUnique for find by id', () => {
    const stmts = [{ type: 'Find', target: 'product', filter: { by: 'id' }, options: {} }];
    const output = generateCrudStatements(stmts, 'product', 'GET');
    expect(output).toContain('prisma.product.findUnique(');
    expect(output).toContain('req.params.id');
  });
});

// ---------------------------------------------------------------------------
// generateCrudStatements — create
// ---------------------------------------------------------------------------

describe('prisma backend — generateCrudStatements() create', () => {
  it('emits prisma.model.create', () => {
    const stmts = [{ type: 'Create', model: 'product', fields: [field('name')] }];
    const output = generateCrudStatements(stmts, 'product', 'POST');
    expect(output).toContain('prisma.product.create(');
    expect(output).toContain('req.body');
  });
});

// ---------------------------------------------------------------------------
// generateCrudStatements — update
// ---------------------------------------------------------------------------

describe('prisma backend — generateCrudStatements() update', () => {
  it('emits prisma.model.update for PUT', () => {
    const stmts = [{ type: 'Update', model: 'product', fields: [field('name')] }];
    const output = generateCrudStatements(stmts, 'product', 'PUT');
    expect(output).toContain('prisma.product.update(');
  });

  it('emits selective update logic for PATCH', () => {
    const stmts = [{ type: 'Update', model: 'product', fields: [field('name'), field('price', 'Number')] }];
    const output = generateCrudStatements(stmts, 'product', 'PATCH');
    expect(output).toContain('updates.name');
    expect(output).toContain('updates.price');
    expect(output).toContain('prisma.product.update(');
  });
});

// ---------------------------------------------------------------------------
// generateCrudStatements — delete
// ---------------------------------------------------------------------------

describe('prisma backend — generateCrudStatements() delete', () => {
  it('emits prisma.model.delete', () => {
    const stmts = [{ type: 'Delete', model: 'product', filter: 'id' }];
    const output = generateCrudStatements(stmts, 'product', 'DELETE');
    expect(output).toContain('prisma.product.delete(');
    expect(output).toContain('req.params.id');
  });
});
