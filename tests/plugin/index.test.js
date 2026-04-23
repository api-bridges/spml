// tests/plugin/index.test.js
// Unit tests for the Trionary plugin API.
// Covers dynamic keyword registration and emitter dispatch.

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  registerKeyword,
  registerASTNode,
  registerEmitter,
  applyKeywords,
  emitters,
  astNodes,
  pluginAPI,
  _resetRegistry,
} from '../../src/plugin/index.js';

beforeEach(() => {
  _resetRegistry();
});

// ---------------------------------------------------------------------------
// registerKeyword
// ---------------------------------------------------------------------------

describe('registerKeyword()', () => {
  it('adds the keyword to the internal set', () => {
    registerKeyword('stripe');
    const kws = new Set();
    applyKeywords(kws);
    expect(kws.has('stripe')).toBe(true);
  });

  it('trims whitespace before storing', () => {
    registerKeyword('  webhook  ');
    const kws = new Set();
    applyKeywords(kws);
    expect(kws.has('webhook')).toBe(true);
  });

  it('throws on empty string', () => {
    expect(() => registerKeyword('')).toThrow(TypeError);
  });

  it('throws on non-string input', () => {
    expect(() => registerKeyword(42)).toThrow(TypeError);
  });

  it('accepts duplicate registrations without error', () => {
    expect(() => {
      registerKeyword('dup');
      registerKeyword('dup');
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// applyKeywords
// ---------------------------------------------------------------------------

describe('applyKeywords()', () => {
  it('adds all registered keywords to the given Set', () => {
    registerKeyword('alpha');
    registerKeyword('beta');
    const kws = new Set(['existing']);
    applyKeywords(kws);
    expect(kws.has('alpha')).toBe(true);
    expect(kws.has('beta')).toBe(true);
    expect(kws.has('existing')).toBe(true);
  });

  it('does not remove pre-existing keywords from the set', () => {
    const kws = new Set(['keep']);
    applyKeywords(kws);
    expect(kws.has('keep')).toBe(true);
  });

  it('is a no-op when no keywords have been registered', () => {
    const kws = new Set(['x']);
    applyKeywords(kws);
    expect([...kws]).toEqual(['x']);
  });
});

// ---------------------------------------------------------------------------
// registerASTNode
// ---------------------------------------------------------------------------

describe('registerASTNode()', () => {
  it('stores the factory and retrieves it via astNodes', () => {
    const factory = (args) => ({ type: 'MyNode', ...args });
    registerASTNode('MyNode', factory);
    expect(astNodes.get('MyNode')).toBe(factory);
  });

  it('factory produces correct node shape', () => {
    registerASTNode('StripeWebhook', ({ path }) => ({ type: 'StripeWebhook', path }));
    const node = astNodes.get('StripeWebhook')({ path: '/stripe/events' });
    expect(node).toEqual({ type: 'StripeWebhook', path: '/stripe/events' });
  });

  it('throws when name is not a string', () => {
    expect(() => registerASTNode(123, () => ({}))).toThrow(TypeError);
  });

  it('throws when factory is not a function', () => {
    expect(() => registerASTNode('Bad', 'not-a-function')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// registerEmitter
// ---------------------------------------------------------------------------

describe('registerEmitter()', () => {
  it('stores the emitter and retrieves it via emitters', () => {
    const emitFn = (node) => `// ${node.type}`;
    registerEmitter('MyNode', emitFn);
    expect(emitters.get('MyNode')).toBe(emitFn);
  });

  it('emitter produces expected output', () => {
    registerEmitter('StripeWebhook', (node) => `app.post('${node.path}', handler);`);
    const output = emitters.get('StripeWebhook')({ type: 'StripeWebhook', path: '/stripe' });
    expect(output).toBe(`app.post('/stripe', handler);`);
  });

  it('throws when nodeType is empty', () => {
    expect(() => registerEmitter('', () => '')).toThrow(TypeError);
  });

  it('throws when emitterFn is not a function', () => {
    expect(() => registerEmitter('X', 'bad')).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// pluginAPI surface
// ---------------------------------------------------------------------------

describe('pluginAPI', () => {
  it('exposes registerKeyword', () => {
    expect(typeof pluginAPI.registerKeyword).toBe('function');
  });

  it('exposes registerASTNode', () => {
    expect(typeof pluginAPI.registerASTNode).toBe('function');
  });

  it('exposes registerEmitter', () => {
    expect(typeof pluginAPI.registerEmitter).toBe('function');
  });

  it('registerKeyword via pluginAPI works', () => {
    pluginAPI.registerKeyword('via-api');
    const kws = new Set();
    applyKeywords(kws);
    expect(kws.has('via-api')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Full plugin registration flow
// ---------------------------------------------------------------------------

describe('full plugin registration flow', () => {
  it('registers keyword, AST node, and emitter through a plugin', () => {
    const testPlugin = {
      register(api) {
        api.registerKeyword('payment');
        api.registerASTNode('Payment', ({ amount }) => ({ type: 'Payment', amount }));
        api.registerEmitter('Payment', (node) => `// charge ${node.amount}`);
      },
    };

    testPlugin.register(pluginAPI);

    const kws = new Set();
    applyKeywords(kws);
    expect(kws.has('payment')).toBe(true);

    const node = astNodes.get('Payment')({ amount: 100 });
    expect(node).toEqual({ type: 'Payment', amount: 100 });

    const code = emitters.get('Payment')(node);
    expect(code).toBe('// charge 100');
  });
});
