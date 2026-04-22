// auth.js
// Generates Node.js Express handler code for authentication-related AST nodes.
// Covers the register, login, and /me route patterns from the Trionary spec.
// All generators return strings; no file I/O is performed here.

import { addImport } from './imports.js';

/**
 * Register the npm packages required by auth route generation.
 * Called automatically by generateAuthStatements; safe to call multiple times.
 */
function registerAuthImports() {
  addImport('express', 'express');
  addImport('bcrypt', 'bcrypt');
  addImport('jsonwebtoken', 'jwt');
}

/**
 * Generate code for a HashNode.
 * Trionary: `hash password`
 * Output:   const hashed = await bcrypt.hash(password, 10);
 *           req.body.password = hashed;
 *
 * @param {{ type: 'Hash', field: string }} node
 * @returns {string}
 */
function generateHash(node) {
  const field = node.field;
  return [
    `const hashed = await bcrypt.hash(${field}, 10);`,
    `req.body.${field} = hashed;`,
  ].join('\n');
}

/**
 * Generate code for an ExistsCheckNode.
 * Trionary: `exists user where email`
 * Output:   const exists = await User.findOne({ email });
 *
 * @param {{ type: 'ExistsCheck', model: string, filter: string }} node
 * @returns {string}
 */
function generateExistsCheck(node) {
  const Model = capitalise(node.model);
  const filter = node.filter;
  return `const exists = await ${Model}.findOne({ ${filter} });`;
}

/**
 * Generate code for an IfNode whose condition is an exists check.
 * Trionary: `if exists return error "Email already in use"`
 * Output:   if (exists) return res.status(409).json({ error: 'Email already in use' });
 *
 * For a password-mismatch condition the output is:
 *           if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
 *
 * @param {{ type: 'If', condition: string, body: string }} node
 * @returns {string}
 */
function generateIf(node) {
  const condition = node.condition;
  const body = node.body;

  if (condition === 'exists') {
    const message = extractMessage(body, 'Email already in use');
    return `if (exists) return res.status(409).json({ error: '${escapeQuotes(message)}' });`;
  }

  if (condition === '!valid' || condition === 'not valid') {
    const message = extractMessage(body, 'Invalid credentials');
    return `if (!valid) return res.status(401).json({ error: '${escapeQuotes(message)}' });`;
  }

  // Generic fallback — emit the condition and body as-is.
  const bodyCode = typeof body === 'string' ? body : JSON.stringify(body);
  return `if (${condition}) { ${bodyCode} }`;
}

/**
 * Generate code for a CreateNode (auth context: creating a user).
 * Trionary: `create user with name, email, password`
 * Output:   const user = await User.create({ name, email, password });
 *
 * @param {{ type: 'Create', model: string, fields: string[] }} node
 * @returns {string}
 */
function generateCreate(node) {
  const varName = node.model.toLowerCase();
  const Model = capitalise(node.model);
  const fields = Array.isArray(node.fields) ? node.fields.join(', ') : node.fields;
  return `const ${varName} = await ${Model}.create({ ${fields} });`;
}

/**
 * Generate code for a FindNode (auth context: finding a user by email).
 * Trionary: `find user by email`
 * Output:   const user = await User.findOne({ email });
 *
 * @param {{ type: 'Find', target: string, filter: string, options: object }} node
 * @returns {string}
 */
function generateFind(node) {
  const varName = node.target.toLowerCase();
  const Model = capitalise(node.target);
  const filter = node.filter || 'email';
  return `const ${varName} = await ${Model}.findOne({ ${filter} });`;
}

/**
 * Generate code for a ReturnNode (auth context).
 *
 * Recognised values:
 *   'token'        → sign a JWT and return it.
 *   'current user' → return req.user (for /me route).
 *
 * @param {{ type: 'Return', value: string, statusCode?: number }} node
 * @returns {string}
 */
function generateReturn(node) {
  const value = typeof node.value === 'string' ? node.value.trim().toLowerCase() : '';

  if (value === 'token') {
    return [
      `if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');`,
      `const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });`,
      `return res.json({ token });`,
    ].join('\n');
  }

  if (value === 'current user') {
    return `return res.json({ user: req.user });`;
  }

  if (node.statusCode) {
    return `return res.status(${node.statusCode}).json({ error: '${escapeQuotes(String(node.value))}' });`;
  }

  // For a plain identifier value, emit it directly in object notation.
  const safeValue = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(String(node.value))
    ? node.value
    : JSON.stringify(node.value);
  return `return res.json({ ${safeValue} });`;
}

/**
 * Generate a bcrypt password comparison check.
 * Trionary: `password matches` (or ValidateNode with rule 'matches')
 * Output:   const valid = await bcrypt.compare(password, user.password);
 *
 * @returns {string}
 */
function generatePasswordMatches() {
  return `const valid = await bcrypt.compare(password, user.password);`;
}

/**
 * Generate Node.js code for an array of auth-related statement AST nodes.
 * Registers bcrypt, jsonwebtoken, and express in the import collector.
 *
 * @param {Array<object>} statementsArray - AST nodes from a route body.
 * @returns {string} Generated Node.js source code, one statement per block.
 */
export function generateAuthStatements(statementsArray) {
  registerAuthImports();

  const lines = [];

  for (const node of statementsArray) {
    switch (node.type) {
      case 'Hash':
        lines.push(generateHash(node));
        break;

      case 'ExistsCheck':
        lines.push(generateExistsCheck(node));
        break;

      case 'If':
        lines.push(generateIf(node));
        break;

      case 'Create':
        lines.push(generateCreate(node));
        break;

      case 'Find':
        lines.push(generateFind(node));
        break;

      case 'Return':
        lines.push(generateReturn(node));
        break;

      case 'Validate':
        // `validate password matches` — password comparison check.
        if (node.rule === 'matches') {
          lines.push(generatePasswordMatches());
        }
        break;

      default:
        // Unknown node types are silently skipped; the caller may handle them.
        break;
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Capitalise the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
function capitalise(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Extract a human-readable message from a body value that may be a plain
 * string, an AST ReturnNode, or any other object with a `value` property.
 *
 * @param {string|object} body
 * @param {string} defaultMessage
 * @returns {string}
 */
function extractMessage(body, defaultMessage) {
  if (typeof body === 'string') return body;
  if (body && typeof body.value === 'string') return body.value;
  return defaultMessage;
}

/**
 * Escape single quotes in a string so it is safe to embed inside single-quoted
 * JS string literals in generated code.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeQuotes(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
