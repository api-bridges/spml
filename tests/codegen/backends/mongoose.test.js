import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateModels, generateCrudStatements, generateDatabase } from '../../../src/codegen/backends/mongoose.js';
import { resetImports } from '../../../src/codegen/imports.js';

beforeEach(() => resetImports());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAST(routeBody) {
  return {
    type: 'Program',
    dbType: 'mongodb',
    body: [
      { type: 'Route', method: 'POST', path: '/test', body: routeBody },
    ],
  };
}

function field(name, fieldType = 'String') {
  return { type: 'Field', name, fieldType };
}

// ---------------------------------------------------------------------------
// generateModels
// ---------------------------------------------------------------------------

describe('mongoose backend — generateModels()', () => {
  it('returns empty string when AST has no CRUD nodes', () => {
    const ast = { type: 'Program', dbType: 'mongodb', body: [] };
    expect(generateModels(ast)).toBe('');
  });

  it('emits a mongoose schema for a created model', () => {
    const ast = makeAST([
      { type: 'Create', model: 'post', fields: [field('title'), field('body')] },
    ]);
    const output = generateModels(ast);
    expect(output).toContain('mongoose.Schema');
    expect(output).toContain("mongoose.model('Post'");
    expect(output).toContain('title: String,');
    expect(output).toContain('body: String,');
  });
});

// ---------------------------------------------------------------------------
// generateDatabase
// ---------------------------------------------------------------------------

describe('mongoose backend — generateDatabase()', () => {
  it('emits mongoose.connect with a literal URI', () => {
    const node = { type: 'DatabaseDeclaration', uri: 'mongodb://localhost/test', envVar: null };
    const output = generateDatabase(node);
    expect(output).toContain("mongoose.connect('mongodb://localhost/test'");
  });

  it('emits mongoose.connect with an env var', () => {
    const node = { type: 'DatabaseDeclaration', uri: null, envVar: 'MONGO_URI' };
    const output = generateDatabase(node);
    expect(output).toContain('process.env.MONGO_URI');
  });
});

// ---------------------------------------------------------------------------
// generateCrudStatements — find
// ---------------------------------------------------------------------------

describe('mongoose backend — generateCrudStatements() find', () => {
  it('emits find all with sort', () => {
    const stmts = [{ type: 'Find', target: 'post', filter: 'all', options: {} }];
    const output = generateCrudStatements(stmts, 'post', 'GET');
    expect(output).toContain('Post.find({})');
    expect(output).toContain('.sort(');
  });

  it('emits findById for find by id', () => {
    const stmts = [{ type: 'Find', target: 'post', filter: { by: 'id' }, options: {} }];
    const output = generateCrudStatements(stmts, 'post', 'GET');
    expect(output).toContain('Post.findById(req.params.id)');
  });
});

// ---------------------------------------------------------------------------
// generateCrudStatements — create
// ---------------------------------------------------------------------------

describe('mongoose backend — generateCrudStatements() create', () => {
  it('emits Model.create({ ...req.body })', () => {
    const stmts = [{ type: 'Create', model: 'post', fields: [field('title')] }];
    const output = generateCrudStatements(stmts, 'post', 'POST');
    expect(output).toContain('Post.create({ ...req.body })');
  });
});

// ---------------------------------------------------------------------------
// generateCrudStatements — update
// ---------------------------------------------------------------------------

describe('mongoose backend — generateCrudStatements() update', () => {
  it('emits updateOne for PUT', () => {
    const stmts = [{ type: 'Update', model: 'post', fields: [field('title')] }];
    const output = generateCrudStatements(stmts, 'post', 'PUT');
    expect(output).toContain('Post.updateOne(');
  });

  it('emits $set logic for PATCH', () => {
    const stmts = [{ type: 'Update', model: 'post', fields: [field('title')] }];
    const output = generateCrudStatements(stmts, 'post', 'PATCH');
    expect(output).toContain('$set');
    expect(output).toContain('updates.title');
  });
});

// ---------------------------------------------------------------------------
// generateCrudStatements — delete
// ---------------------------------------------------------------------------

describe('mongoose backend — generateCrudStatements() delete', () => {
  it('emits findByIdAndDelete', () => {
    const stmts = [{ type: 'Delete', model: 'post', filter: 'id' }];
    const output = generateCrudStatements(stmts, 'post', 'DELETE');
    expect(output).toContain('Post.findByIdAndDelete(req.params.id)');
  });
});
