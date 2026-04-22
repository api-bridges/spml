// middleware.js
// Generates app.use(...) middleware setup code from a MiddlewareDeclarationNode.
// Returns a string of Node.js code; no file I/O is performed here.

import { addImport } from './imports.js';

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
    throw new Error(`Unknown middleware: "${name}"`);
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
