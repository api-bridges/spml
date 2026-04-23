// src/plugin/index.js
// Public plugin API for Trionary.
// Third-party plugins can register new keywords, AST node factories, and
// codegen emitters without forking the compiler.
//
// Usage in trionary.config.js:
//
//   import myPlugin from './my-plugin.js';
//   export default { plugins: [myPlugin] };
//
// A plugin module must export a register(api) function:
//
//   export function register(api) {
//     api.registerKeyword('mykey');
//     api.registerASTNode('MyNode', (args) => ({ type: 'MyNode', ...args }));
//     api.registerEmitter('MyNode', (node) => `// my node`);
//   }

/**
 * Internal registry state.
 * Kept as module-level maps so the lexer and codegen can import them directly.
 */

/** @type {Set<string>} Extra keywords contributed by plugins. */
const _keywords = new Set();

/** @type {Map<string, (args: object) => object>} AST node factory functions keyed by node type name. */
const _astNodes = new Map();

/** @type {Map<string, (node: object, context?: object) => string>} Codegen emitter functions keyed by node type. */
const _emitters = new Map();

// ---------------------------------------------------------------------------
// Public registration API (passed to each plugin's register() hook)
// ---------------------------------------------------------------------------

/**
 * Register a new reserved keyword so the lexer classifies it as KEYWORD.
 *
 * @param {string} name - The keyword text (e.g. 'stripe').
 */
export function registerKeyword(name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError(`registerKeyword: name must be a non-empty string, got ${JSON.stringify(name)}`);
  }
  _keywords.add(name.trim());
}

/**
 * Register an AST node factory.
 * The factory is stored so the parser (or plugins themselves) can create typed
 * AST nodes in a consistent way.
 *
 * @param {string} name - Node type identifier (e.g. 'StripeWebhook').
 * @param {(args: object) => object} factory - Function that returns an AST node object.
 */
export function registerASTNode(name, factory) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError(`registerASTNode: name must be a non-empty string`);
  }
  if (typeof factory !== 'function') {
    throw new TypeError(`registerASTNode: factory must be a function`);
  }
  _astNodes.set(name.trim(), factory);
}

/**
 * Register a codegen emitter for an AST node type.
 * The emitter receives the node and returns a string of generated JavaScript.
 *
 * @param {string} nodeType - The AST node type string (e.g. 'StripeWebhook').
 * @param {(node: object, context?: object) => string} emitterFn
 */
export function registerEmitter(nodeType, emitterFn) {
  if (typeof nodeType !== 'string' || !nodeType.trim()) {
    throw new TypeError(`registerEmitter: nodeType must be a non-empty string`);
  }
  if (typeof emitterFn !== 'function') {
    throw new TypeError(`registerEmitter: emitterFn must be a function`);
  }
  _emitters.set(nodeType.trim(), emitterFn);
}

// ---------------------------------------------------------------------------
// Read-only accessors used by lexer and codegen
// ---------------------------------------------------------------------------

/**
 * Apply any plugin-registered keywords to the live KEYWORDS Set used by the lexer.
 * Must be called before tokenising when plugins have been loaded.
 *
 * @param {Set<string>} keywordsSet - The mutable KEYWORDS set from src/lexer/keywords.js.
 */
export function applyKeywords(keywordsSet) {
  for (const kw of _keywords) {
    keywordsSet.add(kw);
  }
}

/**
 * The map of plugin-registered codegen emitters.
 * Codegen code should look here when the node type is not handled by the built-in switch.
 *
 * @type {ReadonlyMap<string, (node: object, context?: object) => string>}
 */
export const emitters = _emitters;

/**
 * The map of plugin-registered AST node factories.
 *
 * @type {ReadonlyMap<string, (args: object) => object>}
 */
export const astNodes = _astNodes;

// ---------------------------------------------------------------------------
// Plugin API object — passed to each plugin's register() hook
// ---------------------------------------------------------------------------

/**
 * The plugin API object passed to every plugin's `register(api)` call.
 */
export const pluginAPI = {
  registerKeyword,
  registerASTNode,
  registerEmitter,
};

// ---------------------------------------------------------------------------
// Reset helper (used in tests to isolate plugin state between test cases)
// ---------------------------------------------------------------------------

/** @internal */
export function _resetRegistry() {
  _keywords.clear();
  _astNodes.clear();
  _emitters.clear();
}
