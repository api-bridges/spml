import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateModels } from '../../src/codegen/models.js';
import { resetImports } from '../../src/codegen/imports.js';

beforeEach(() => resetImports());

// Helper to build a minimal ProgramNode with a single route
function makeAST(routeBody) {
  return {
    type: 'Program',
    body: [
      {
        type: 'Route',
        method: 'POST',
        path: '/test',
        body: routeBody,
      },
    ],
  };
}

// Helper: build a FieldNode object (typed field)
function field(name, fieldType = 'String') {
  return { type: 'Field', name, fieldType };
}

describe('generateModels()', () => {
  // ── No models ───────────────────────────────────────────────────────────────

  it('returns empty string when AST has no CRUD nodes', () => {
    const ast = { type: 'Program', body: [] };
    expect(generateModels(ast)).toBe('');
  });

  // ── Default String type ─────────────────────────────────────────────────────

  it('emits String type when no explicit type is declared', () => {
    const ast = makeAST([
      { type: 'Create', model: 'post', fields: [field('title'), field('body')] },
    ]);
    const output = generateModels(ast);
    expect(output).toContain('title: String,');
    expect(output).toContain('body: String,');
  });

  // ── Explicit Number type ─────────────────────────────────────────────────────

  it('emits Number type for an explicitly typed Number field', () => {
    const ast = makeAST([
      { type: 'Create', model: 'product', fields: [field('name'), field('price', 'Number')] },
    ]);
    const output = generateModels(ast);
    expect(output).toContain('price: Number,');
    expect(output).toContain('name: String,');
  });

  // ── Explicit Boolean type ────────────────────────────────────────────────────

  it('emits Boolean type for an explicitly typed Boolean field', () => {
    const ast = makeAST([
      {
        type: 'Create',
        model: 'post',
        fields: [field('title'), field('published', 'Boolean')],
      },
    ]);
    const output = generateModels(ast);
    expect(output).toContain('published: Boolean,');
  });

  // ── Explicit Date type ───────────────────────────────────────────────────────

  it('emits Date type for an explicitly typed Date field', () => {
    const ast = makeAST([
      {
        type: 'Create',
        model: 'event',
        fields: [field('name'), field('startsAt', 'Date')],
      },
    ]);
    const output = generateModels(ast);
    expect(output).toContain('startsAt: Date,');
  });

  // ── All four scalar types in one model ───────────────────────────────────────

  it('emits correct types when all four scalar types are present', () => {
    const ast = makeAST([
      {
        type: 'Create',
        model: 'item',
        fields: [
          field('label', 'String'),
          field('quantity', 'Number'),
          field('active', 'Boolean'),
          field('expiresAt', 'Date'),
        ],
      },
    ]);
    const output = generateModels(ast);
    expect(output).toContain('label: String,');
    expect(output).toContain('quantity: Number,');
    expect(output).toContain('active: Boolean,');
    expect(output).toContain('expiresAt: Date,');
  });

  // ── Name-based inference still applies when no explicit type ─────────────────

  it('still applies email inference for email fields without explicit type', () => {
    const ast = makeAST([
      {
        type: 'Create',
        model: 'user',
        fields: [field('email'), field('name')],
      },
    ]);
    const output = generateModels(ast);
    expect(output).toContain('email: { type: String, unique: true },');
  });

  it('still applies ObjectId inference for *Id fields without explicit type', () => {
    const ast = makeAST([
      {
        type: 'Create',
        model: 'comment',
        fields: [field('content'), field('authorId')],
      },
    ]);
    const output = generateModels(ast);
    expect(output).toContain('authorId: mongoose.Schema.Types.ObjectId,');
  });

  // ── Model/schema structure ────────────────────────────────────────────────────

  it('wraps schema in mongoose.Schema() with timestamps', () => {
    const ast = makeAST([
      { type: 'Create', model: 'post', fields: [field('title')] },
    ]);
    const output = generateModels(ast);
    expect(output).toContain('new mongoose.Schema(');
    expect(output).toContain('{ timestamps: true }');
  });

  it('emits a mongoose.model() call with capitalised name', () => {
    const ast = makeAST([
      { type: 'Create', model: 'product', fields: [field('name')] },
    ]);
    const output = generateModels(ast);
    expect(output).toContain("mongoose.model('Product', ProductSchema)");
  });

  // ── Snapshot tests ────────────────────────────────────────────────────────────

  it('matches snapshot — product with Number price', () => {
    const ast = makeAST([
      {
        type: 'Create',
        model: 'product',
        fields: [field('name'), field('price', 'Number'), field('sku')],
      },
    ]);
    expect(generateModels(ast)).toMatchSnapshot();
  });

  it('matches snapshot — article with Boolean published', () => {
    const ast = makeAST([
      {
        type: 'Create',
        model: 'article',
        fields: [field('title'), field('content'), field('published', 'Boolean')],
      },
    ]);
    expect(generateModels(ast)).toMatchSnapshot();
  });

  it('matches snapshot — event with Date field', () => {
    const ast = makeAST([
      {
        type: 'Create',
        model: 'event',
        fields: [field('name'), field('startsAt', 'Date'), field('capacity', 'Number')],
      },
    ]);
    expect(generateModels(ast)).toMatchSnapshot();
  });

  it('matches snapshot — all four scalar types', () => {
    const ast = makeAST([
      {
        type: 'Create',
        model: 'item',
        fields: [
          field('label', 'String'),
          field('quantity', 'Number'),
          field('active', 'Boolean'),
          field('expiresAt', 'Date'),
        ],
      },
    ]);
    expect(generateModels(ast)).toMatchSnapshot();
  });
});
