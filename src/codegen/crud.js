// crud.js
// Generates Node.js Express handler code for CRUD-related AST nodes.
// Covers find, create, update, delete, paginate, take, require, and
// conditional returns for posts-style routes in the Trionary spec.
// All generators return strings; no file I/O is performed here.

import { addImport } from './imports.js';
import { generateValidate } from './validate.js';
import { generateEscape } from './escape.js';

/**
 * Register the npm packages required by CRUD route generation.
 * Called automatically by generateCrudStatements; safe to call multiple times.
 */
function registerCrudImports() {
  addImport('express', 'express');
}

/**
 * Generate code for a TakeNode.
 * Trionary: `take name, email, password`
 * Output:   const { name, email, password } = req.body;
 *
 * @param {{ type: 'Take', fields: string[] }} node
 * @returns {string}
 */
function generateTake(node) {
  const fields = Array.isArray(node.fields) ? node.fields.join(', ') : node.fields;
  return `const { ${fields} } = req.body;`;
}

/**
 * Generate code for a RequireNode.
 * Trionary: `require name, email`
 * Output:   if (!name || !email) return res.status(400).json({ error: 'Missing required fields: name, email' });
 *
 * @param {{ type: 'Require', fields: string[] }} node
 * @returns {string}
 */
function generateRequire(node) {
  const fields = Array.isArray(node.fields) ? node.fields : [node.fields];
  const checks = fields.map((f) => `!${f}`).join(' || ');
  const fieldList = fields.join(', ');
  return `if (${checks}) return res.status(400).json({ error: 'Missing required fields: ${fieldList}' });`;
}

/**
 * Generate code for a FindNode (CRUD context), optionally chaining a
 * `.populate('<field>')` call when a PopulateNode immediately follows.
 *
 * - `find all <model>s sorted by date`
 *     → const <model>s = await <Model>.find({}).sort({ date: -1 });
 * - `find <model> by id`
 *     → const <model> = await <Model>.findById(req.params.id);
 * - `find <model> where <field>`
 *     → const <model> = await <Model>.findOne({ <field> });
 *
 * @param {{ type: 'Find', target: string, filter: string|null, options: object }} node
 * @param {string} modelName - Resolved model name passed from the route context.
 * @param {{ type: 'Populate', model: string, field: string }|null} populateNode
 * @returns {string}
 */
function generateFind(node, modelName, populateNode) {
  const resolvedModel = node.target || modelName || 'item';
  const varName = resolvedModel.toLowerCase();
  const Model = capitalise(resolvedModel);

  const rawFilter = node.filter;
  let filter = '';
  if (rawFilter && typeof rawFilter === 'object') {
    if (rawFilter.by) {
      filter = `by ${rawFilter.by}`;
    } else if (rawFilter.field) {
      filter = rawFilter.field;
    }
  } else {
    filter = rawFilter ? String(rawFilter).trim().toLowerCase() : '';
  }

  const opts = node.options || {};
  const populateChain = populateNode ? `.populate('${populateNode.field}')` : '';

  // find all → return a list
  if (filter === 'all' || opts.all) {
    const listVar = `${varName}s`;
    const sortField = opts.sortBy || 'date';
    return `const ${listVar} = await ${Model}.find({}).sort({ ${sortField}: -1 })${populateChain};`;
  }

  // find by id
  if (filter === 'id' || filter === 'by id') {
    return `const ${varName} = await ${Model}.findById(req.params.id)${populateChain};`;
  }

  // find where <field> (single field equality)
  if (filter) {
    return `const ${varName} = await ${Model}.findOne({ ${filter} })${populateChain};`;
  }

  // fallback — find all
  return `const ${varName}s = await ${Model}.find({})${populateChain};`;
}

/**
 * Generate code for a PaginateNode.
 * Trionary: `paginate posts limit 20`
 * Output:
 *   const page = parseInt(req.query.page) || 1;
 *   const <target>s = await <Model>.find({}).skip((page - 1) * <limit>).limit(<limit>);
 *
 * @param {{ type: 'Paginate', target: string, limit: number }} node
 * @param {string} modelName - Resolved model name passed from the route context.
 * @returns {string}
 */
function generatePaginate(node, modelName) {
  const resolvedModel = node.target || modelName || 'item';
  const varName = resolvedModel.toLowerCase();
  const Model = capitalise(resolvedModel);
  const limit = node.limit || 10;

  return [
    `const page = parseInt(req.query.page, 10) || 1;`,
    `const ${varName}s = await ${Model}.find({}).skip((page - 1) * ${limit}).limit(${limit});`,
  ].join('\n');
}

/**
 * Generate code for a CreateNode (CRUD context).
 * Trionary: `create post with title, body`
 * Output:   const post = await Post.create({ ...req.body });
 *
 * @param {{ type: 'Create', model: string, fields: string[] }} node
 * @returns {string}
 */
function generateCreate(node) {
  const varName = node.model.toLowerCase();
  const Model = capitalise(node.model);
  return `const ${varName} = await ${Model}.create({ ...req.body });`;
}

/**
 * Generate code for an UpdateNode.
 * Trionary: `update post with title, body`
 * Output:   await post.updateOne({ _id: req.params.id }, { ...req.body });
 *
 * @param {{ type: 'Update', model: string, fields: string[] }} node
 * @returns {string}
 */
function generateUpdate(node) {
  const Model = capitalise(node.model);
  return `await ${Model}.updateOne({ _id: req.params.id }, { ...req.body });`;
}

/**
 * Generate code for a DeleteNode.
 * Trionary: `delete post by id`
 * Output:   await Post.findByIdAndDelete(req.params.id);
 *
 * @param {{ type: 'Delete', model: string, filter: string }} node
 * @returns {string}
 */
function generateDelete(node) {
  const Model = capitalise(node.model);
  return `await ${Model}.findByIdAndDelete(req.params.id);`;
}

/**
 * Generate code for a ReturnNode (CRUD context).
 *
 * Recognised patterns:
 *   plain identifier       → return res.json({ <identifier> });
 *   ReturnNode with status → return res.status(<code>).json({ error: '<msg>' });
 *   'ok' / message string  → return res.json({ message: '<msg>' });
 *
 * @param {{ type: 'Return', value: string, statusCode?: number }} node
 * @returns {string}
 */
function generateReturn(node) {
  const raw = node.value;
  const value = typeof raw === 'string' ? raw.trim() : '';

  // Explicit status code → error response
  if (node.statusCode) {
    return `return res.status(${node.statusCode}).json({ error: '${escapeQuotes(String(raw))}' });`;
  }

  // `return ok` or a quoted message string → success message
  if (value.toLowerCase() === 'ok' || (value.startsWith('"') && value.endsWith('"'))) {
    const msg = value.startsWith('"') ? value.slice(1, -1) : 'Success';
    return `return res.json({ message: '${escapeQuotes(msg)}' });`;
  }

  // Plain identifier → wrap in object shorthand
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) {
    return `return res.json({ ${value} });`;
  }

  // Plural identifier (e.g. 'posts') — pass through
  if (value) {
    return `return res.json({ ${value} });`;
  }

  return `return res.json({});`;
}

/**
 * Generate code for an IfNode (CRUD context — "not found" guard).
 * Trionary: `if not found return error "Not found" status 404`
 * Output:   if (!<model>) return res.status(404).json({ error: 'Not found' });
 *
 * @param {{ type: 'If', condition: string, body: string|object }} node
 * @param {string} modelName
 * @returns {string}
 */
function generateIf(node, modelName) {
  const condition = typeof node.condition === 'string' ? node.condition.trim().toLowerCase() : '';
  const body = node.body;

  if (condition === 'not found' || condition === '!found') {
    const varName = (modelName || 'item').toLowerCase();
    const message = extractMessage(body, 'Not found');
    const status = extractStatus(body, 404);
    return `if (!${varName}) return res.status(${status}).json({ error: '${escapeQuotes(message)}' });`;
  }

  // Generic fallback
  const bodyCode = typeof body === 'string' ? body : JSON.stringify(body);
  return `if (${condition}) { ${bodyCode} }`;
}

/**
 * Generate Node.js code for an array of CRUD-related statement AST nodes.
 * Registers express in the import collector.
 *
 * @param {Array<object>} statementsArray - AST nodes from a route body.
 * @param {string} [modelName] - Inferred model name for the route (e.g. 'post').
 * @returns {string} Generated Node.js source code, one statement per block.
 */
export function generateCrudStatements(statementsArray, modelName) {
  registerCrudImports();

  const lines = [];

  for (let i = 0; i < statementsArray.length; i++) {
    const node = statementsArray[i];
    switch (node.type) {
      case 'Take':
        lines.push(generateTake(node));
        break;

      case 'Require':
        lines.push(generateRequire(node));
        break;

      case 'Find': {
        // Look ahead: if the immediately following node is a Populate, chain it
        const next = statementsArray[i + 1];
        const populateNode = next && next.type === 'Populate' ? next : null;
        if (populateNode) i++; // consume the Populate node
        lines.push(generateFind(node, modelName, populateNode));
        break;
      }

      case 'Populate':
        // A Populate node not immediately following a Find — emit standalone populate call
        lines.push(`// populate ${node.model}.${node.field} (no preceding find)`);
        break;

      case 'Paginate':
        lines.push(generatePaginate(node, modelName));
        break;

      case 'Create':
        lines.push(generateCreate(node));
        break;

      case 'Update':
        lines.push(generateUpdate(node));
        break;

      case 'Delete':
        lines.push(generateDelete(node));
        break;

      case 'Return':
        lines.push(generateReturn(node));
        break;

      case 'If':
        lines.push(generateIf(node, modelName));
        break;

      case 'Validate':
        lines.push(generateValidate(node));
        break;

      case 'EscapeHatch':
        lines.push(generateEscape(node));
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
  const node = Array.isArray(body) ? body[0] : body;
  if (typeof node === 'string') return node;
  if (node && node.value && typeof node.value === 'object' && typeof node.value.error === 'string') {
    return node.value.error;
  }
  if (node && typeof node.value === 'string') return node.value;
  return defaultMessage;
}

/**
 * Extract an HTTP status code from a body value (may be an array of AST nodes).
 *
 * @param {string|object|Array} body
 * @param {number} defaultStatus
 * @returns {number}
 */
function extractStatus(body, defaultStatus) {
  const node = Array.isArray(body) ? body[0] : body;
  if (node && typeof node.statusCode === 'number') return node.statusCode;
  return defaultStatus;
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
