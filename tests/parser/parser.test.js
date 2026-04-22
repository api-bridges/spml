import { describe, it, expect } from '@jest/globals';
import { parse } from '../../src/parser/parser.js';
import { tokenize } from '../../src/lexer/lexer.js';
import { TrinaryError } from '../../src/errors/TrinaryError.js';

// Helper: tokenize source then parse it into an AST
function parseSource(source) {
  return parse(tokenize(source));
}

describe('parse()', () => {
  // ── server port <n> ─────────────────────────────────────────────────────────

  describe('server declaration', () => {
    it('produces a ProgramNode containing a ServerDeclarationNode with the correct port', () => {
      const ast = parseSource('server port 3000');
      expect(ast).toMatchObject({
        type: 'Program',
        body: [{ type: 'ServerDeclaration', port: 3000 }],
      });
    });

    it('accepts any valid port number', () => {
      const ast = parseSource('server port 8080');
      expect(ast.body[0]).toMatchObject({ type: 'ServerDeclaration', port: 8080 });
    });
  });

  // ── route METHOD /path + block ───────────────────────────────────────────────

  describe('route declaration', () => {
    it('produces a RouteNode with the correct method and path', () => {
      const source = 'route GET /users\n  return ok';
      const ast = parseSource(source);
      expect(ast.body[0]).toMatchObject({ type: 'Route', method: 'GET', path: '/users' });
    });

    it('includes body children in the RouteNode', () => {
      const source = 'route GET /users\n  return ok';
      const ast = parseSource(source);
      const route = ast.body[0];
      expect(route.body).toHaveLength(1);
      expect(route.body[0]).toMatchObject({ type: 'Return', value: 'ok' });
    });

    it('parses a route with auth required and return ok', () => {
      const source = 'route POST /login\n  auth required\n  return ok';
      const ast = parseSource(source);
      const route = ast.body[0];
      expect(route).toMatchObject({ type: 'Route', method: 'POST', path: '/login' });
      expect(route.body[0]).toMatchObject({ type: 'Auth', required: true });
      expect(route.body[1]).toMatchObject({ type: 'Return', value: 'ok' });
    });

    it('produces an empty body array when the route has no indented block', () => {
      const source = 'route DELETE /item\n';
      const ast = parseSource(source);
      expect(ast.body[0]).toMatchObject({ type: 'Route', body: [] });
    });
  });

  // ── take ─────────────────────────────────────────────────────────────────────

  describe('take statement', () => {
    it('parses "take name, email, password" into TakeNode with three fields', () => {
      const source = 'route POST /reg\n  take name, email, password';
      const ast = parseSource(source);
      const take = ast.body[0].body[0];
      expect(take).toMatchObject({ type: 'Take', fields: ['name', 'email', 'password'] });
    });

    it('parses a single-field take', () => {
      const source = 'route POST /x\n  take id';
      const ast = parseSource(source);
      expect(ast.body[0].body[0]).toMatchObject({ type: 'Take', fields: ['id'] });
    });
  });

  // ── validate ─────────────────────────────────────────────────────────────────

  describe('validate statement', () => {
    it('parses "validate email is email" into ValidateNode', () => {
      const source = 'route POST /reg\n  validate email is email';
      const ast = parseSource(source);
      const vNode = ast.body[0].body[0];
      // validate <field> is <rule> [<value>]
      // field='email', rule='email' (word after 'is'), value=null (nothing follows)
      expect(vNode).toMatchObject({ type: 'Validate', field: 'email', rule: 'email', value: null });
    });

    it('parses "validate password is minlength 8" with numeric value', () => {
      const source = 'route POST /reg\n  validate password is minlength 8';
      const ast = parseSource(source);
      const vNode = ast.body[0].body[0];
      // field='password', rule='minlength', value=8
      expect(vNode).toMatchObject({ type: 'Validate', field: 'password', rule: 'minlength', value: 8 });
    });
  });

  // ── auth required ────────────────────────────────────────────────────────────

  describe('auth statement', () => {
    it('parses "auth required" into AuthNode({ required: true })', () => {
      const source = 'route GET /me\n  auth required';
      const ast = parseSource(source);
      expect(ast.body[0].body[0]).toMatchObject({ type: 'Auth', required: true });
    });

    it('parses bare "auth" into AuthNode({ required: false })', () => {
      const source = 'route GET /pub\n  auth';
      const ast = parseSource(source);
      expect(ast.body[0].body[0]).toMatchObject({ type: 'Auth', required: false });
    });
  });

  // ── if + return ───────────────────────────────────────────────────────────────

  describe('if statement', () => {
    it('parses "if not found return error \\"Not found\\" status 404"', () => {
      const source = 'route GET /x\n  if not found return error "Not found" status 404';
      const ast = parseSource(source);
      const ifNode = ast.body[0].body[0];
      expect(ifNode).toMatchObject({ type: 'If', condition: 'not found' });
      expect(ifNode.body).toHaveLength(1);
      expect(ifNode.body[0]).toMatchObject({
        type: 'Return',
        value: { error: 'Not found' },
        statusCode: 404,
      });
    });

    it('parses an if block with an indented body', () => {
      const source = [
        'route GET /x',
        '  if not found',
        '    return error "Not found" status 404',
      ].join('\n');
      const ast = parseSource(source);
      const ifNode = ast.body[0].body[0];
      expect(ifNode).toMatchObject({ type: 'If', condition: 'not found' });
      expect(ifNode.body[0]).toMatchObject({
        type: 'Return',
        value: { error: 'Not found' },
        statusCode: 404,
      });
    });
  });

  // ── escape hatch ─────────────────────────────────────────────────────────────

  describe('escape hatch', () => {
    it('parses a js: block into EscapeHatchNode with the raw JS', () => {
      const source = [
        'route GET /raw',
        '  js:',
        '    const x = 1',
      ].join('\n');
      const ast = parseSource(source);
      const esc = ast.body[0].body[0];
      expect(esc).toMatchObject({ type: 'EscapeHatch' });
      expect(esc.rawJs).toContain('const');
    });

    it('records the source line number on EscapeHatchNode', () => {
      const source = [
        'route GET /raw',
        '  js:',
        '    const x = 1',
      ].join('\n');
      const ast = parseSource(source);
      const esc = ast.body[0].body[0];
      expect(typeof esc.line).toBe('number');
      expect(esc.line).toBeGreaterThan(0);
    });
  });

  // ── return statement ─────────────────────────────────────────────────────────

  describe('return statement', () => {
    it('parses "return ok" into ReturnNode({ value: "ok", statusCode: null })', () => {
      const source = 'route GET /x\n  return ok';
      const ast = parseSource(source);
      expect(ast.body[0].body[0]).toMatchObject({ type: 'Return', value: 'ok', statusCode: null });
    });

    it('parses "return error \\"msg\\" status 400"', () => {
      const source = 'route GET /x\n  return error "Bad Request" status 400';
      const ast = parseSource(source);
      expect(ast.body[0].body[0]).toMatchObject({
        type: 'Return',
        value: { error: 'Bad Request' },
        statusCode: 400,
      });
    });
  });

  // ── error cases ──────────────────────────────────────────────────────────────

  describe('error cases', () => {
    it('throws TrinaryError with a line number for an unrecognised top-level keyword', () => {
      expect(() => parseSource('foobar')).toThrow(TrinaryError);
    });

    it('includes the line number on the thrown TrinaryError', () => {
      let err;
      try {
        parseSource('foobar');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(TrinaryError);
      expect(typeof err.line).toBe('number');
    });

    it('throws TrinaryError for an unrecognised statement keyword inside a route', () => {
      const source = 'route GET /x\n  badkeyword';
      expect(() => parseSource(source)).toThrow(TrinaryError);
    });

    it('throws TrinaryError when "server" is missing the port number', () => {
      expect(() => parseSource('server port')).toThrow(TrinaryError);
    });
  });

  // ── complete snippet ──────────────────────────────────────────────────────────

  describe('complete Trionary snippet', () => {
    const source = [
      'server port 3000',
      'database connect "mongodb://localhost/myapp"',
      'route GET /users',
      '  auth required',
      '  find all User',
      '  return ok',
    ].join('\n');

    it('produces a Program with three top-level nodes', () => {
      const ast = parseSource(source);
      expect(ast.type).toBe('Program');
      expect(ast.body).toHaveLength(3);
    });

    it('first node is ServerDeclarationNode(3000)', () => {
      const ast = parseSource(source);
      expect(ast.body[0]).toMatchObject({ type: 'ServerDeclaration', port: 3000 });
    });

    it('second node is DatabaseDeclarationNode with the connection URI', () => {
      const ast = parseSource(source);
      expect(ast.body[1]).toMatchObject({
        type: 'DatabaseDeclaration',
        uri: 'mongodb://localhost/myapp',
      });
    });

    it('third node is a RouteNode with three body statements', () => {
      const ast = parseSource(source);
      const route = ast.body[2];
      expect(route).toMatchObject({ type: 'Route', method: 'GET', path: '/users' });
      expect(route.body).toHaveLength(3);
    });
  });
});
