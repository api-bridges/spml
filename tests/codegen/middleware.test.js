import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateDatabase } from '../../src/codegen/database.js';
import { resetImports, generateImports } from '../../src/codegen/imports.js';
import { generateMiddleware } from '../../src/codegen/middleware.js';
import { generateAuthMiddleware, generateRouteWithAuth } from '../../src/codegen/authMiddleware.js';

// Reset import registry before each test so tests are independent
beforeEach(() => resetImports());

// ── database ─────────────────────────────────────────────────────────────────

describe('generateDatabase()', () => {
  it('contains mongoose.connect', () => {
    const output = generateDatabase({ type: 'DatabaseDeclaration', uri: 'mongodb://localhost/myapp' });
    expect(output).toContain('mongoose.connect');
  });

  it('embeds the given URI in the connection call', () => {
    const output = generateDatabase({ type: 'DatabaseDeclaration', uri: 'mongodb://localhost/myapp' });
    expect(output).toContain("'mongodb://localhost/myapp'");
  });

  it('emits process.env reference when envVar is set', () => {
    const output = generateDatabase({ type: 'DatabaseDeclaration', uri: null, envVar: 'MONGODB_URI' });
    expect(output).toContain('process.env.MONGODB_URI');
  });

  it('does not embed a literal URI when envVar is set', () => {
    const output = generateDatabase({ type: 'DatabaseDeclaration', uri: null, envVar: 'MONGODB_URI' });
    expect(output).not.toContain("'undefined'");
    expect(output).not.toContain("'null'");
  });

  it('matches snapshot', () => {
    const output = generateDatabase({ type: 'DatabaseDeclaration', uri: 'mongodb://localhost/myapp' });
    expect(output).toMatchSnapshot();
  });

  it('matches snapshot with envVar', () => {
    const output = generateDatabase({ type: 'DatabaseDeclaration', uri: null, envVar: 'MONGODB_URI' });
    expect(output).toMatchSnapshot();
  });
});

// ── middleware ────────────────────────────────────────────────────────────────

describe('generateMiddleware()', () => {
  it('generates rateLimit call with the given max', () => {
    const output = generateMiddleware({ type: 'MiddlewareDeclaration', name: 'ratelimit', options: { max: 200 } });
    expect(output).toContain('rateLimit({ windowMs: 60000, max: 200 })');
  });

  it('uses default max of 100 when options.max is absent for ratelimit', () => {
    const output = generateMiddleware({ type: 'MiddlewareDeclaration', name: 'ratelimit' });
    expect(output).toContain('max: 100');
  });

  it('generates cors() middleware', () => {
    const output = generateMiddleware({ type: 'MiddlewareDeclaration', name: 'cors' });
    expect(output).toContain("app.use(cors())");
  });

  it('generates morgan(\'dev\') middleware for logs', () => {
    const output = generateMiddleware({ type: 'MiddlewareDeclaration', name: 'logs' });
    expect(output).toContain("morgan('dev')");
  });

  it('generates helmet() middleware', () => {
    const output = generateMiddleware({ type: 'MiddlewareDeclaration', name: 'helmet' });
    expect(output).toContain('helmet()');
  });

  it('adds express-rate-limit to the import registry when ratelimit is used', () => {
    generateMiddleware({ type: 'MiddlewareDeclaration', name: 'ratelimit', options: { max: 50 } });
    const imports = generateImports();
    expect(imports).toContain('express-rate-limit');
  });

  it('throws TrinaryError for an unknown middleware name', () => {
    expect(() => generateMiddleware({ type: 'MiddlewareDeclaration', name: 'unknownmw' })).toThrow();
  });

  it('matches snapshot for ratelimit', () => {
    const output = generateMiddleware({ type: 'MiddlewareDeclaration', name: 'ratelimit', options: { max: 200 } });
    expect(output).toMatchSnapshot();
  });
});

// ── authMiddleware ────────────────────────────────────────────────────────────

describe('generateAuthMiddleware()', () => {
  it('declares the authRequired middleware function', () => {
    const output = generateAuthMiddleware();
    expect(output).toContain('const authRequired = (req, res, next) =>');
  });

  it('verifies the JWT using JWT_SECRET', () => {
    const output = generateAuthMiddleware();
    expect(output).toContain('jwt.verify(token, process.env.JWT_SECRET)');
  });

  it('returns 401 when no token is provided', () => {
    const output = generateAuthMiddleware();
    expect(output).toContain("res.status(401).json({ error: 'No token provided' })");
  });

  it('matches snapshot', () => {
    const output = generateAuthMiddleware();
    expect(output).toMatchSnapshot();
  });
});

describe('generateRouteWithAuth()', () => {
  it('injects authRequired middleware when authRequired is true', () => {
    const output = generateRouteWithAuth('get', '/me', 'return res.json({});', true);
    expect(output).toContain('authRequired,');
  });

  it('does not inject authRequired middleware when authRequired is false', () => {
    const output = generateRouteWithAuth('get', '/public', 'return res.json({});', false);
    expect(output).not.toContain('authRequired,');
  });

  it('uses the correct HTTP method and path', () => {
    const output = generateRouteWithAuth('post', '/register', '', false);
    expect(output).toContain("app.post('/register'");
  });

  it('matches snapshot without auth', () => {
    const output = generateRouteWithAuth('get', '/posts', 'return res.json({ posts });', false);
    expect(output).toMatchSnapshot();
  });

  it('matches snapshot with auth', () => {
    const output = generateRouteWithAuth('get', '/me', 'return res.json({ user: req.user });', true);
    expect(output).toMatchSnapshot();
  });
});
