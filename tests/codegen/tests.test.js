import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateTest, generateTestFile } from '../../src/codegen/tests.js';
import { compile } from '../../src/cli/index.js';
import { resetImports } from '../../src/codegen/imports.js';

beforeEach(() => resetImports());

// ── generateTest() ──────────────────────────────────────────────────────────

describe('generateTest()', () => {
  it('wraps the block in describe with the test description', () => {
    const node = {
      type: 'Test',
      description: 'POST /register creates a user',
      body: [],
    };
    const output = generateTest(node);
    expect(output).toContain(`describe('POST /register creates a user', () => {`);
  });

  it('emits an async it() block', () => {
    const node = { type: 'Test', description: 'GET /health returns ok', body: [] };
    const output = generateTest(node);
    expect(output).toContain('async () => {');
  });

  it('derives it() description from status expectation', () => {
    const node = {
      type: 'Test',
      description: 'POST /login',
      body: [
        { type: 'Expect', expectType: 'status', assertion: { code: 200 } },
      ],
    };
    const output = generateTest(node);
    expect(output).toContain(`it('returns status 200'`);
  });

  it('uses fallback it() description when no status expect', () => {
    const node = {
      type: 'Test',
      description: 'GET /posts',
      body: [],
    };
    const output = generateTest(node);
    expect(output).toContain(`it('should satisfy expectations'`);
  });

  it('emits supertest GET call', () => {
    const node = {
      type: 'Test',
      description: 'GET /posts',
      body: [
        { type: 'Send', method: 'GET', path: '/posts', fields: [] },
      ],
    };
    const output = generateTest(node);
    expect(output).toContain(`request(app).get('/posts')`);
  });

  it('emits supertest POST call with body fields', () => {
    const node = {
      type: 'Test',
      description: 'POST /register',
      body: [
        {
          type: 'Send',
          method: 'POST',
          path: '/register',
          fields: [
            { name: 'name', value: 'Alice' },
            { name: 'email', value: 'alice@example.com' },
          ],
        },
      ],
    };
    const output = generateTest(node);
    expect(output).toContain(`request(app).post('/register').send({ name: 'Alice', email: 'alice@example.com' })`);
  });

  it('emits expect(res.status).toBe() for status assertions', () => {
    const node = {
      type: 'Test',
      description: 'POST /login',
      body: [
        { type: 'Expect', expectType: 'status', assertion: { code: 200 } },
      ],
    };
    const output = generateTest(node);
    expect(output).toContain('expect(res.status).toBe(200)');
  });

  it('emits toBeDefined() for body.field exists assertions', () => {
    const node = {
      type: 'Test',
      description: 'GET /me',
      body: [
        { type: 'Expect', expectType: 'body', assertion: { path: 'token', check: 'exists' } },
      ],
    };
    const output = generateTest(node);
    expect(output).toContain('expect(res.body.token).toBeDefined()');
  });

  it('emits toBe() for body.field equals assertions', () => {
    const node = {
      type: 'Test',
      description: 'GET /status',
      body: [
        { type: 'Expect', expectType: 'body', assertion: { path: 'status', check: { equals: 'ok' } } },
      ],
    };
    const output = generateTest(node);
    expect(output).toContain(`expect(res.body.status).toBe('ok')`);
  });

  it('matches snapshot for a full test block', () => {
    const node = {
      type: 'Test',
      description: 'POST /register creates a user',
      body: [
        {
          type: 'Send',
          method: 'POST',
          path: '/register',
          fields: [
            { name: 'name', value: 'Alice' },
            { name: 'email', value: 'alice@example.com' },
            { name: 'password', value: 'secret' },
          ],
        },
        { type: 'Expect', expectType: 'status', assertion: { code: 200 } },
        { type: 'Expect', expectType: 'body', assertion: { path: 'token', check: 'exists' } },
      ],
    };
    expect(generateTest(node)).toMatchSnapshot();
  });
});

// ── generateTestFile() ──────────────────────────────────────────────────────

describe('generateTestFile()', () => {
  it('emits supertest require at the top', () => {
    const output = generateTestFile([]);
    expect(output).toContain(`const request = require('supertest')`);
  });

  it('emits app require at the top', () => {
    const output = generateTestFile([]);
    expect(output).toContain(`const app = require('./app')`);
  });

  it('includes all provided test blocks', () => {
    const nodes = [
      { type: 'Test', description: 'first test', body: [] },
      { type: 'Test', description: 'second test', body: [] },
    ];
    const output = generateTestFile(nodes);
    expect(output).toContain(`describe('first test'`);
    expect(output).toContain(`describe('second test'`);
  });

  it('matches snapshot for a single test block', () => {
    const nodes = [
      {
        type: 'Test',
        description: 'GET /health returns ok',
        body: [
          { type: 'Send', method: 'GET', path: '/health', fields: [] },
          { type: 'Expect', expectType: 'status', assertion: { code: 200 } },
        ],
      },
    ];
    expect(generateTestFile(nodes)).toMatchSnapshot();
  });
});

// ── compile() — test DSL parsing ────────────────────────────────────────────

describe('compile() — test keyword is parsed but not emitted to app output', () => {
  it('parses a test block without error', () => {
    const source = [
      'server port 3000',
      '',
      'route GET /health',
      '  return ok',
      '',
      'test "GET /health returns ok"',
      '  send GET /health',
      '  expect status 200',
    ].join('\n');
    expect(() => compile(source)).not.toThrow();
  });

  it('does not emit test code into the compiled app', () => {
    const source = [
      'server port 3000',
      '',
      'route GET /health',
      '  return ok',
      '',
      'test "GET /health returns ok"',
      '  send GET /health',
      '  expect status 200',
    ].join('\n');
    const output = compile(source);
    expect(output).not.toContain('supertest');
    expect(output).not.toContain('describe(');
  });
});
