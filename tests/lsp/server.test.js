// tests/lsp/server.test.js
// Integration-style unit tests for the Trionary LSP server helpers.
// We test the exported pure functions (buildCompletionItems, buildHoverInfo,
// buildDiagnostics) directly, and exercise startServer() with a mock
// connection to verify that the LSP handlers are correctly wired up.

import { describe, it, expect, beforeAll, jest } from '@jest/globals';

// The LSP server package uses CommonJS; createRequire lets us import it from ESM.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(import.meta.url);
const {
  KEYWORD_DOCS,
  buildCompletionItems,
  buildHoverInfo,
  buildDiagnostics,
  startServer,
} = require(join(__dirname, '../../packages/trionary-lsp/server.js'));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Load the real Trionary compiler (ES modules). */
let tokenize, parse;
beforeAll(async () => {
  const lexer = await import('../../src/lexer/lexer.js');
  const parser = await import('../../src/parser/parser.js');
  tokenize = lexer.tokenize;
  parse = parser.parse;
});

// ── KEYWORD_DOCS ──────────────────────────────────────────────────────────────

describe('KEYWORD_DOCS', () => {
  it('contains entries for all core route keywords', () => {
    const expectedKeywords = ['route', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'auth', 'take', 'require', 'find', 'create', 'update', 'delete', 'return'];
    for (const kw of expectedKeywords) {
      expect(KEYWORD_DOCS).toHaveProperty(kw);
      expect(typeof KEYWORD_DOCS[kw]).toBe('string');
      expect(KEYWORD_DOCS[kw].length).toBeGreaterThan(0);
    }
  });

  it('contains entries for scalar type keywords', () => {
    for (const kw of ['String', 'Number', 'Boolean', 'Date']) {
      expect(KEYWORD_DOCS).toHaveProperty(kw);
    }
  });

  it('contains entries for middleware keywords', () => {
    for (const kw of ['middleware', 'cors', 'helmet', 'logs', 'ratelimit', 'compress']) {
      expect(KEYWORD_DOCS).toHaveProperty(kw);
    }
  });

  it('contains entries for validation keywords', () => {
    for (const kw of ['validate', 'is', 'email', 'number', 'url', 'min', 'max', 'length']) {
      expect(KEYWORD_DOCS).toHaveProperty(kw);
    }
  });
});

// ── buildCompletionItems ──────────────────────────────────────────────────────

describe('buildCompletionItems()', () => {
  it('returns top-level keywords at the start of an empty document', () => {
    const items = buildCompletionItems('', { line: 0, character: 0 });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('server');
    expect(labels).toContain('database');
    expect(labels).toContain('route');
    expect(labels).toContain('middleware');
  });

  it('returns HTTP verbs after the word "route"', () => {
    const text = 'route ';
    const items = buildCompletionItems(text, { line: 0, character: text.length });
    const labels = items.map((i) => i.label);
    expect(labels).toEqual(expect.arrayContaining(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']));
  });

  it('returns route-body keywords when cursor is inside a route body', () => {
    const text = 'route GET /posts\n  ';
    const items = buildCompletionItems(text, { line: 1, character: 2 });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('find');
    expect(labels).toContain('auth');
    expect(labels).toContain('return');
    expect(labels).toContain('take');
  });

  it('returns "required" after "auth"', () => {
    const text = 'route POST /login\n  auth ';
    const items = buildCompletionItems(text, { line: 1, character: text.split('\n')[1].length });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('required');
  });

  it('returns connect and type after "database"', () => {
    const text = 'database ';
    const items = buildCompletionItems(text, { line: 0, character: text.length });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('connect');
    expect(labels).toContain('type');
  });

  it('returns validation rule keywords after "is"', () => {
    const text = 'route POST /r\n  validate email is ';
    const items = buildCompletionItems(text, { line: 1, character: text.split('\n')[1].length });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('email');
    expect(labels).toContain('number');
    expect(labels).toContain('url');
  });

  it('returns middleware package names after "middleware"', () => {
    const text = 'middleware ';
    const items = buildCompletionItems(text, { line: 0, character: text.length });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('cors');
    expect(labels).toContain('helmet');
    expect(labels).toContain('logs');
  });

  it('returns ok, error, token, current after "return"', () => {
    const text = 'route GET /r\n  return ';
    const items = buildCompletionItems(text, { line: 1, character: text.split('\n')[1].length });
    const labels = items.map((i) => i.label);
    expect(labels).toContain('ok');
    expect(labels).toContain('error');
    expect(labels).toContain('token');
    expect(labels).toContain('current');
  });

  it('each item has a documentation field with markdown content', () => {
    const items = buildCompletionItems('', { line: 0, character: 0 });
    for (const item of items) {
      expect(item.documentation).toBeDefined();
      expect(item.documentation.kind).toBe('markdown');
    }
  });
});

// ── buildHoverInfo ────────────────────────────────────────────────────────────

describe('buildHoverInfo()', () => {
  it('returns hover info for a recognised keyword', () => {
    const text = 'route GET /posts';
    // cursor on "route" (character 2)
    const hover = buildHoverInfo(text, { line: 0, character: 2 });
    expect(hover).not.toBeNull();
    expect(hover.contents.kind).toBe('markdown');
    expect(hover.contents.value).toContain('route');
  });

  it('returns hover info for HTTP verb', () => {
    const text = 'route GET /posts';
    // cursor on "GET" (character 7)
    const hover = buildHoverInfo(text, { line: 0, character: 7 });
    expect(hover).not.toBeNull();
    expect(hover.contents.value).toContain('GET');
  });

  it('returns null for an unknown word', () => {
    const text = 'unknownWord something';
    const hover = buildHoverInfo(text, { line: 0, character: 5 });
    expect(hover).toBeNull();
  });

  it('returns null for whitespace position', () => {
    const text = 'route  GET';
    // cursor in the extra space between keywords
    const hover = buildHoverInfo(text, { line: 0, character: 6 });
    expect(hover).toBeNull();
  });

  it('returns hover info for scalar type keywords', () => {
    const text = 'title: String';
    const hover = buildHoverInfo(text, { line: 0, character: 8 });
    expect(hover).not.toBeNull();
    expect(hover.contents.value).toContain('String');
  });
});

// ── buildDiagnostics ──────────────────────────────────────────────────────────

describe('buildDiagnostics()', () => {
  it('returns an empty array for a valid Trionary document', () => {
    const text = [
      'server port 3000',
      'database connect "mongodb://localhost/test"',
      '',
      'route GET /posts',
      '  find all posts',
      '  return posts',
    ].join('\n');

    const diagnostics = buildDiagnostics(text, tokenize, parse);
    expect(diagnostics).toHaveLength(0);
  });

  it('returns a diagnostic for a lexer error (unexpected character)', () => {
    const text = 'server port 3000\n@ invalid';
    const diagnostics = buildDiagnostics(text, tokenize, parse);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].severity).toBe(1); // DiagnosticSeverity.Error === 1
    expect(diagnostics[0].source).toBe('trionary');
  });

  it('returns a diagnostic for a parser error (unexpected token)', () => {
    // Missing route body
    const text = 'route BADVERB /posts';
    const diagnostics = buildDiagnostics(text, tokenize, parse);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].severity).toBe(1);
  });

  it('diagnostic range references a valid line number', () => {
    const text = 'server port 3000\n@ bad';
    const diagnostics = buildDiagnostics(text, tokenize, parse);
    expect(diagnostics[0].range.start.line).toBeGreaterThanOrEqual(0);
    expect(diagnostics[0].range.start.character).toBeGreaterThanOrEqual(0);
  });
});

// ── startServer() mock-connection wiring ──────────────────────────────────────

describe('startServer()', () => {
  it('registers onInitialize and returns capabilities', () => {
    const handlers = {};
    const sentDiagnostics = [];
    const docListeners = {};

    const mockDocuments = {
      onDidChangeContent: (fn) => { docListeners.changeContent = fn; },
      get: () => null,
      listen: () => {},
    };

    const mockConnection = {
      onInitialize: (fn) => { handlers.onInitialize = fn; },
      onCompletion: (fn) => { handlers.onCompletion = fn; },
      onHover: (fn) => { handlers.onHover = fn; },
      sendDiagnostics: (d) => sentDiagnostics.push(d),
      listen: () => {},
    };

    startServer(mockConnection, mockDocuments, { tokenize, parse });

    // onInitialize must return server capabilities
    const result = handlers.onInitialize();
    expect(result.capabilities.completionProvider).toBeDefined();
    expect(result.capabilities.hoverProvider).toBe(true);
    expect(result.capabilities.textDocumentSync).toBeDefined();
  });

  it('sends diagnostics when document content changes', () => {
    const handlers = {};
    const sentDiagnostics = [];
    const docListeners = {};

    const mockDocuments = {
      onDidChangeContent: (fn) => { docListeners.changeContent = fn; },
      get: () => null,
      listen: () => {},
    };

    const mockConnection = {
      onInitialize: (fn) => { handlers.onInitialize = fn; },
      onCompletion: (fn) => {},
      onHover: (fn) => {},
      sendDiagnostics: (d) => sentDiagnostics.push(d),
      listen: () => {},
    };

    startServer(mockConnection, mockDocuments, { tokenize, parse });

    // Simulate a content change with a valid document
    docListeners.changeContent({
      document: {
        getText: () => 'server port 3000\ndatabase connect "mongodb://localhost/t"\nroute GET /x\n  find all items\n  return items',
        uri: 'file:///test.tri',
      },
    });

    expect(sentDiagnostics).toHaveLength(1);
    expect(sentDiagnostics[0].uri).toBe('file:///test.tri');
    expect(sentDiagnostics[0].diagnostics).toHaveLength(0);
  });

  it('sends error diagnostics for invalid document content', () => {
    const handlers = {};
    const sentDiagnostics = [];
    const docListeners = {};

    const mockDocuments = {
      onDidChangeContent: (fn) => { docListeners.changeContent = fn; },
      get: () => null,
      listen: () => {},
    };

    const mockConnection = {
      onInitialize: (fn) => { handlers.onInitialize = fn; },
      onCompletion: (fn) => {},
      onHover: (fn) => {},
      sendDiagnostics: (d) => sentDiagnostics.push(d),
      listen: () => {},
    };

    startServer(mockConnection, mockDocuments, { tokenize, parse });

    // Simulate a content change with an invalid document (bad char)
    docListeners.changeContent({
      document: {
        getText: () => '@ invalid syntax here',
        uri: 'file:///bad.tri',
      },
    });

    expect(sentDiagnostics).toHaveLength(1);
    expect(sentDiagnostics[0].diagnostics.length).toBeGreaterThan(0);
    expect(sentDiagnostics[0].diagnostics[0].severity).toBe(1);
  });
});
