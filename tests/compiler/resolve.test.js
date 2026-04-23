import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { resolveImports } from '../../src/compiler/resolve.js';
import { parse } from '../../src/parser/parser.js';
import { tokenize } from '../../src/lexer/lexer.js';
import { TrinaryError } from '../../src/errors/TrinaryError.js';

// ── Test fixture helpers ──────────────────────────────────────────────────────

const TMP = join('/tmp', 'trionary-resolve-tests');

function setup() {
  if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });
}

function teardown() {
  rmSync(TMP, { recursive: true, force: true });
}

function write(filename, content) {
  writeFileSync(join(TMP, filename), content, 'utf8');
}

function parseSource(source) {
  return parse(tokenize(source));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveImports()', () => {
  beforeEach(setup);
  afterEach(teardown);

  // ── Single import ──────────────────────────────────────────────────────────

  describe('single import', () => {
    it('merges routes from an imported file into the parent program body', () => {
      write('routes.tri', [
        'route GET /items',
        '  return ok',
      ].join('\n'));

      const source = 'import routes from "routes"\nserver port 3000\n';
      const ast = parseSource(source);
      const resolved = resolveImports(ast, join(TMP, 'index.tri'));

      const routeNodes = resolved.body.filter((n) => n.type === 'Route');
      expect(routeNodes).toHaveLength(1);
      expect(routeNodes[0]).toMatchObject({ type: 'Route', method: 'GET', path: '/items' });
    });

    it('removes the ImportNode from the body after resolution', () => {
      write('routes.tri', 'route GET /ping\n  return ok\n');

      const source = 'import routes from "routes"\n';
      const ast = parseSource(source);
      const resolved = resolveImports(ast, join(TMP, 'index.tri'));

      const importNodes = resolved.body.filter((n) => n.type === 'Import');
      expect(importNodes).toHaveLength(0);
    });

    it('resolves paths with the .tri extension already present', () => {
      write('items.tri', 'route DELETE /items/:id\n  return ok\n');

      const source = 'import routes from "items.tri"\n';
      const ast = parseSource(source);
      const resolved = resolveImports(ast, join(TMP, 'index.tri'));

      const routeNodes = resolved.body.filter((n) => n.type === 'Route');
      expect(routeNodes).toHaveLength(1);
      expect(routeNodes[0].method).toBe('DELETE');
    });
  });

  // ── Multi import ───────────────────────────────────────────────────────────

  describe('multi import', () => {
    it('merges routes from multiple imported files in order', () => {
      write('posts.tri', [
        'route GET /posts',
        '  return ok',
        'route POST /posts',
        '  return ok',
      ].join('\n'));

      write('users.tri', [
        'route GET /users',
        '  return ok',
      ].join('\n'));

      const source = [
        'server port 3000',
        'import routes from "posts"',
        'import routes from "users"',
      ].join('\n');

      const ast = parseSource(source);
      const resolved = resolveImports(ast, join(TMP, 'index.tri'));

      const routeNodes = resolved.body.filter((n) => n.type === 'Route');
      expect(routeNodes).toHaveLength(3);
      expect(routeNodes[0].path).toBe('/posts');
      expect(routeNodes[1].path).toBe('/posts');
      expect(routeNodes[2].path).toBe('/users');
    });
  });

  // ── Circular import detection ──────────────────────────────────────────────

  describe('circular import detection', () => {
    it('throws a TrinaryError when a file imports itself', () => {
      // index.tri imports itself
      write('index.tri', 'import routes from "index"\n');

      const source = 'import routes from "index"\n';
      const ast = parseSource(source);

      expect(() => resolveImports(ast, join(TMP, 'index.tri'))).toThrow(TrinaryError);
    });

    it('throws a TrinaryError with a descriptive message on circular import', () => {
      write('a.tri', 'import routes from "b"\n');
      write('b.tri', 'import routes from "a"\n');

      const source = 'import routes from "a"\n';
      const ast = parseSource(source);

      expect(() => resolveImports(ast, join(TMP, 'index.tri'))).toThrow(/[Cc]ircular import/);
    });
  });

  // ── Missing file ───────────────────────────────────────────────────────────

  describe('missing file', () => {
    it('throws a TrinaryError when the imported file does not exist', () => {
      const source = 'import routes from "nonexistent"\n';
      const ast = parseSource(source);

      expect(() => resolveImports(ast, join(TMP, 'index.tri'))).toThrow(TrinaryError);
    });
  });

  // ── Non-route nodes in imported file are ignored ───────────────────────────

  describe('non-route nodes in imported file', () => {
    it('does not merge server declarations from imported files', () => {
      write('partial.tri', [
        'server port 4000',
        'route GET /health',
        '  return ok',
      ].join('\n'));

      const source = 'server port 3000\nimport routes from "partial"\n';
      const ast = parseSource(source);
      const resolved = resolveImports(ast, join(TMP, 'index.tri'));

      const serverNodes = resolved.body.filter((n) => n.type === 'ServerDeclaration');
      expect(serverNodes).toHaveLength(1);
      expect(serverNodes[0].port).toBe(3000);
    });
  });
});
