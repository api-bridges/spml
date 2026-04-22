import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateCrudStatements } from '../../src/codegen/crud.js';
import { resetImports } from '../../src/codegen/imports.js';

beforeEach(() => resetImports());

describe('generateCrudStatements()', () => {
  // ── find all with paginate ──────────────────────────────────────────────────

  describe('Paginate node', () => {
    it('contains .skip( and .limit( for paginated find', () => {
      const output = generateCrudStatements(
        [{ type: 'Paginate', target: 'post', limit: 20 }],
        'post',
      );
      expect(output).toContain('.skip(');
      expect(output).toContain('.limit(');
    });

    it('uses the provided limit value', () => {
      const output = generateCrudStatements(
        [{ type: 'Paginate', target: 'post', limit: 20 }],
        'post',
      );
      expect(output).toContain('.limit(20)');
    });

    it('defaults to limit 10 when no limit is specified', () => {
      const output = generateCrudStatements([{ type: 'Paginate', target: 'post' }], 'post');
      expect(output).toContain('.limit(10)');
    });

    it('matches snapshot', () => {
      const output = generateCrudStatements(
        [{ type: 'Paginate', target: 'post', limit: 20 }],
        'post',
      );
      expect(output).toMatchSnapshot();
    });
  });

  // ── find all ────────────────────────────────────────────────────────────────

  describe('Find node — all', () => {
    it('generates Post.find({}) for find-all', () => {
      const output = generateCrudStatements(
        [{ type: 'Find', target: 'post', filter: 'all', options: { all: true } }],
        'post',
      );
      expect(output).toContain('Post.find({})');
    });
  });

  // ── find by id ──────────────────────────────────────────────────────────────

  describe('Find node — by id', () => {
    it('generates findById for filter "id"', () => {
      const output = generateCrudStatements(
        [{ type: 'Find', target: 'post', filter: 'id', options: {} }],
        'post',
      );
      expect(output).toContain('findById(req.params.id)');
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────

  describe('Create node', () => {
    it('generates Post.create for a create-post node', () => {
      const output = generateCrudStatements(
        [{ type: 'Create', model: 'post', fields: ['title', 'body'] }],
        'post',
      );
      expect(output).toContain('Post.create');
    });
  });

  // ── update (PUT — full replace) ──────────────────────────────────────────────

  describe('Update node — PUT (full replace)', () => {
    it('generates updateOne for an update-post node', () => {
      const output = generateCrudStatements(
        [{ type: 'Update', model: 'post', fields: ['title', 'body'] }],
        'post',
      );
      expect(output).toContain('Post.updateOne');
    });
  });

  // ── update (PATCH — selective $set) ─────────────────────────────────────────

  describe('Update node — PATCH (selective $set)', () => {
    it('emits findByIdAndUpdate with $set for a PATCH route', () => {
      const output = generateCrudStatements(
        [{ type: 'Update', model: 'post', fields: ['title', 'body'] }],
        'post',
        'PATCH',
      );
      expect(output).toContain('findByIdAndUpdate');
      expect(output).toContain('$set: updates');
      expect(output).toContain('{ new: true }');
    });

    it('emits a per-field undefined guard for each field', () => {
      const output = generateCrudStatements(
        [{ type: 'Update', model: 'post', fields: ['title', 'body'] }],
        'post',
        'PATCH',
      );
      expect(output).toContain('req.body.title !== undefined');
      expect(output).toContain('req.body.body !== undefined');
    });

    it('does NOT emit updateOne for a PATCH route', () => {
      const output = generateCrudStatements(
        [{ type: 'Update', model: 'post', fields: ['title', 'body'] }],
        'post',
        'PATCH',
      );
      expect(output).not.toContain('updateOne');
    });

    it('handles FieldNode objects (typed fields) for PATCH routes', () => {
      const output = generateCrudStatements(
        [
          {
            type: 'Update',
            model: 'post',
            fields: [
              { type: 'Field', name: 'title', fieldType: 'String', ref: null },
              { type: 'Field', name: 'views', fieldType: 'Number', ref: null },
            ],
          },
        ],
        'post',
        'PATCH',
      );
      expect(output).toContain('req.body.title !== undefined');
      expect(output).toContain('req.body.views !== undefined');
    });

    it('matches PATCH update snapshot', () => {
      const output = generateCrudStatements(
        [{ type: 'Update', model: 'post', fields: ['title', 'body'] }],
        'post',
        'PATCH',
      );
      expect(output).toMatchSnapshot();
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────────

  describe('Delete node', () => {
    it('generates findByIdAndDelete for a delete-post node', () => {
      const output = generateCrudStatements(
        [{ type: 'Delete', model: 'post', filter: 'id' }],
        'post',
      );
      expect(output).toContain('Post.findByIdAndDelete(req.params.id)');
    });
  });

  // ── take ────────────────────────────────────────────────────────────────────

  describe('Take node', () => {
    it('generates destructuring from req.body', () => {
      const output = generateCrudStatements(
        [{ type: 'Take', fields: ['title', 'body'] }],
        'post',
      );
      expect(output).toContain('const { title, body } = req.body;');
    });
  });

  // ── require ─────────────────────────────────────────────────────────────────

  describe('Require node', () => {
    it('generates a 400 guard for missing required fields', () => {
      const output = generateCrudStatements(
        [{ type: 'Require', fields: ['title', 'body'] }],
        'post',
      );
      expect(output).toContain("res.status(400).json({ error: 'Missing required fields:");
    });
  });

  // ── return ──────────────────────────────────────────────────────────────────

  describe('Return node', () => {
    it('wraps a plain identifier in object shorthand', () => {
      const output = generateCrudStatements([{ type: 'Return', value: 'post' }], 'post');
      expect(output).toContain('return res.json({ post })');
    });

    it('returns a message for "return ok"', () => {
      const output = generateCrudStatements([{ type: 'Return', value: 'ok' }], 'post');
      expect(output).toContain("res.json({ message: 'Success' })");
    });
  });

  // ── if not found guard ───────────────────────────────────────────────────────

  describe('If node — not found', () => {
    it('generates a 404 guard for "not found" condition', () => {
      const output = generateCrudStatements(
        [{ type: 'If', condition: 'not found', body: 'Not found' }],
        'post',
      );
      expect(output).toContain("res.status(404).json({ error: 'Not found' })");
    });
  });

  // ── escape hatch ─────────────────────────────────────────────────────────────

  describe('EscapeHatch node', () => {
    it('emits the raw JS verbatim', () => {
      const rawJs = 'console.log("escape from crud");';
      const output = generateCrudStatements([{ type: 'EscapeHatch', rawJs }], 'post');
      expect(output).toContain(rawJs);
    });

    it('includes the trionary escape hatch comment', () => {
      const output = generateCrudStatements(
        [{ type: 'EscapeHatch', rawJs: 'const x = 2;' }],
        'post',
      );
      expect(output).toContain('trionary escape hatch');
    });
  });

  // ── populate ─────────────────────────────────────────────────────────────────

  describe('Populate node — find → populate → return', () => {
    it('chains .populate() onto a findById query', () => {
      const output = generateCrudStatements(
        [
          { type: 'Find', target: 'post', filter: 'id', options: {} },
          { type: 'Populate', model: 'post', field: 'author' },
          { type: 'Return', value: 'post' },
        ],
        'post',
      );
      expect(output).toContain(".populate('author')");
      expect(output).toContain('findById(req.params.id)');
    });

    it('chains .populate() onto a find-all query', () => {
      const output = generateCrudStatements(
        [
          { type: 'Find', target: 'post', filter: 'all', options: { all: true } },
          { type: 'Populate', model: 'post', field: 'author' },
        ],
        'post',
      );
      expect(output).toContain(".populate('author')");
      expect(output).toContain('Post.find({})');
    });

    it('chains .populate() onto a findOne query', () => {
      const output = generateCrudStatements(
        [
          { type: 'Find', target: 'post', filter: 'slug', options: {} },
          { type: 'Populate', model: 'post', field: 'author' },
        ],
        'post',
      );
      expect(output).toContain(".populate('author')");
      expect(output).toContain('findOne');
    });

    it('does not emit populate when no Populate node follows Find', () => {
      const output = generateCrudStatements(
        [{ type: 'Find', target: 'post', filter: 'id', options: {} }],
        'post',
      );
      expect(output).not.toContain('.populate(');
    });

    it('matches find → populate → return snapshot', () => {
      const output = generateCrudStatements(
        [
          { type: 'Find', target: 'post', filter: 'id', options: {} },
          { type: 'Populate', model: 'post', field: 'author' },
          { type: 'Return', value: 'post' },
        ],
        'post',
      );
      expect(output).toMatchSnapshot();
    });
  });

  // ── combined snapshot ────────────────────────────────────────────────────────

  it('matches combined CRUD flow snapshot', () => {
    const nodes = [
      { type: 'Take', fields: ['title', 'body'] },
      { type: 'Require', fields: ['title'] },
      { type: 'Create', model: 'post', fields: ['title', 'body'] },
      { type: 'Return', value: 'post' },
    ];
    expect(generateCrudStatements(nodes, 'post')).toMatchSnapshot();
  });
});
