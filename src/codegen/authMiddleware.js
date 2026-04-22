// authMiddleware.js
// Generates the JWT authRequired Express middleware that guards routes marked
// `auth required`. The middleware is emitted once per compiled file and
// injected as the first argument in every guarded route handler.

import { addImport } from './imports.js';

/**
 * Generate the `authRequired` Express middleware function as a Node.js string.
 * Verifies the Bearer token from the Authorization header using JWT_SECRET.
 * On success, attaches the decoded payload to `req.user` and calls `next()`.
 * On failure, returns a 401 JSON error response.
 *
 * Call this function exactly once per compiled file and prepend its output
 * before the route definitions.
 *
 * @returns {string} The full middleware function as a JavaScript source string.
 */
export function generateAuthMiddleware() {
  addImport('jsonwebtoken', 'jwt');

  return [
    `const authRequired = (req, res, next) => {`,
    `  const header = req.headers.authorization;`,
    `  if (!header) return res.status(401).json({ error: 'No token provided' });`,
    `  const token = header.split(' ')[1];`,
    `  try {`,
    `    req.user = jwt.verify(token, process.env.JWT_SECRET);`,
    `    next();`,
    `  } catch {`,
    `    return res.status(401).json({ error: 'Invalid or expired token' });`,
    `  }`,
    `};`,
  ].join('\n');
}

/**
 * Wrap a route handler body with an Express route registration call.
 * When the route body contains an `AuthNode` with `required: true`, the
 * `authRequired` middleware is injected as the second argument so that JWT
 * verification runs before the handler logic.
 *
 * @param {string} method      - HTTP method in lowercase (e.g. 'get', 'post').
 * @param {string} path        - Express route path (e.g. '/me', '/posts/:id').
 * @param {string} handlerBody - The already-generated async handler body code.
 * @param {boolean} authRequired - Whether the route requires authentication.
 * @returns {string} Full Express route registration statement.
 */
export function generateRouteWithAuth(method, path, handlerBody, authRequired) {
  const middlewareArg = authRequired ? 'authRequired, ' : '';
  const indentedBody = handlerBody
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');

  return [
    `app.${method}('${path}', ${middlewareArg}async (req, res) => {`,
    `  try {`,
    indentedBody,
    `  } catch (err) {`,
    `    return res.status(500).json({ error: err.message });`,
    `  }`,
    `});`,
  ].join('\n');
}
