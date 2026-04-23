// middleware.js
// Generates app.use(...) middleware setup code from a MiddlewareDeclarationNode
// or a MiddlewareNode (custom npm package).
// Returns a string of Node.js code; no file I/O is performed here.

import { addImport } from './imports.js';
import { TrinaryError } from '../errors/TrinaryError.js';
import { MESSAGES, interpolate } from '../errors/messages.js';

/**
 * Middleware keyword → { pkg, call } mapping.
 * `pkg` is the npm package name; `call` is the app.use(...) expression body.
 */
const MIDDLEWARE_MAP = {
  cors: { pkg: 'cors', call: 'cors()' },
  logs: { pkg: 'morgan', call: "morgan('dev')" },
  helmet: { pkg: 'helmet', call: 'helmet()' },
  compress: { pkg: 'compression', call: 'compression()' },
};

/**
 * Registry of custom npm package names declared via the MiddlewareNode path.
 * @type {Set<string>}
 */
const customPackageRegistry = new Set();

/**
 * Generate Express middleware setup code from a MiddlewareDeclarationNode.
 *
 * For `ratelimit`, the node's `options` object must contain `{ max: number }`.
 * Example Trionary: `middleware ratelimit max 100 per minute`
 * Produces: `app.use(rateLimit({ windowMs: 60000, max: 100 }));`
 *
 * @param {{ type: 'MiddlewareDeclaration', name: string, options?: object }} node
 * @returns {string} Node.js source code string.
 */
export function generateMiddleware(node) {
  const name = node.name;

  if (name === 'ratelimit') {
    const max = node.options && node.options.max != null ? node.options.max : 100;
    addImport('express-rate-limit', 'rateLimit');
    addImport('express', 'express');
    return `app.use(rateLimit({ windowMs: 60000, max: ${max} }));`;
  }

  const entry = MIDDLEWARE_MAP[name];
  if (!entry) {
    throw new TrinaryError(interpolate(MESSAGES.UNKNOWN_MIDDLEWARE, { name }), {
      source: 'codegen',
      hint: 'Supported middleware keywords are: cors, logs, helmet, ratelimit, compress.',
    });
  }

  let localId;
  if (entry.pkg === 'morgan') {
    localId = 'morgan';
  } else if (name === 'compress') {
    localId = 'compression';
  } else {
    localId = name;
  }
  addImport(entry.pkg, localId);
  addImport('express', 'express');
  return `app.use(${entry.call});`;
}

/**
 * Generate Express middleware setup code from a MiddlewareNode (custom npm package).
 *
 * Example Trionary: `middleware morgan`
 * Produces: `app.use(require('morgan'));`
 *
 * @param {{ type: 'Middleware', packageName: string }} node
 * @returns {string} Node.js source code string.
 */
export function generateCustomMiddleware(node) {
  const pkg = node.packageName;
  customPackageRegistry.add(pkg);
  addImport('express', 'express');
  return `app.use(require('${pkg}'));`;
}

/**
 * Return the list of custom npm package names declared via MiddlewareNode.
 *
 * @returns {string[]}
 */
export function getCustomPackages() {
  return [...customPackageRegistry];
}

/**
 * Reset the custom package registry (useful between compilation runs or in tests).
 */
export function resetCustomPackages() {
  customPackageRegistry.clear();
}
