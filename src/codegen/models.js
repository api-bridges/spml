// models.js
// Generates Mongoose schema and model definitions by inferring field shapes
// from the AST.  Called during compilation (Step 18) so that the compiled
// output is fully self-contained — no hand-written schema files are needed.

import { addImport } from './imports.js';

// ---------------------------------------------------------------------------
// Field-type inference helpers
// ---------------------------------------------------------------------------

/**
 * Map a field name to its Mongoose schema type expression.
 *
 * Rules (applied in order):
 *   1. Fields named "email"                            → `{ type: String, unique: true }`
 *   2. Fields ending with "id" (case-insensitive),
 *      except the bare "id" field (MongoDB manages _id) → `mongoose.Schema.Types.ObjectId`
 *   3. Everything else                                  → `String`
 *
 * @param {string} fieldName
 * @returns {string} Mongoose schema type expression (not JSON-quoted).
 */
function inferFieldType(fieldName) {
  const lower = fieldName.toLowerCase();
  if (lower === 'email') return '{ type: String, unique: true }';
  // Bare "id" is MongoDB's internal identifier; omit it from the schema.
  // Fields like "authorId", "postId" are foreign-key references.
  if (lower.endsWith('id') && lower !== 'id') return 'mongoose.Schema.Types.ObjectId';
  return 'String';
}

// ---------------------------------------------------------------------------
// AST walker
// ---------------------------------------------------------------------------

/**
 * Walk the full AST and build a map of model name → Set of field names.
 *
 * For each Route node the walker:
 *   - Identifies which model(s) the route operates on (Create, Update, Delete,
 *     Find, Paginate, ExistsCheck nodes carry a `model` or `target` property).
 *   - Collects field names from TakeNode and CreateNode siblings in that same
 *     route and associates them with the detected model.
 *
 * @param {{ type: 'Program', body: object[] }} ast
 * @returns {Map<string, Set<string>>}  lower-case model name → field names
 */
function collectModelFields(ast) {
  /** @type {Map<string, Set<string>>} */
  const modelFields = new Map();

  for (const node of ast.body) {
    if (node.type !== 'Route') continue;

    // Determine which models are referenced in this route.
    const routeModels = new Set();
    const routeFields = [];

    for (const stmt of node.body) {
      switch (stmt.type) {
        case 'Create':
        case 'Update':
        case 'Delete':
          if (stmt.model) routeModels.add(stmt.model.toLowerCase());
          // CreateNode / UpdateNode may carry an explicit fields list
          if (Array.isArray(stmt.fields)) {
            routeFields.push(...stmt.fields);
          }
          break;

        case 'Find':
        case 'Paginate':
          if (stmt.target) routeModels.add(stmt.target.toLowerCase());
          break;

        case 'ExistsCheck':
          if (stmt.model) routeModels.add(stmt.model.toLowerCase());
          break;

        case 'Take':
          // Collect body fields; associate with whatever model this route uses
          if (Array.isArray(stmt.fields)) {
            routeFields.push(...stmt.fields);
          } else if (typeof stmt.fields === 'string') {
            routeFields.push(stmt.fields);
          }
          break;

        default:
          break;
      }
    }

    // Associate collected fields with every model touched in this route.
    for (const modelName of routeModels) {
      if (!modelFields.has(modelName)) {
        modelFields.set(modelName, new Set());
      }
      const fieldSet = modelFields.get(modelName);
      for (const f of routeFields) {
        fieldSet.add(f.trim());
      }
    }
  }

  return modelFields;
}

// ---------------------------------------------------------------------------
// Code emitter
// ---------------------------------------------------------------------------

/**
 * Capitalise the first letter of a string.
 *
 * @param {string} str
 * @returns {string}
 */
function capitalise(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Emit a single Mongoose schema + model definition.
 *
 * @param {string}      modelName  Lower-case model name (e.g. "user")
 * @param {Set<string>} fields     Field names inferred from the AST
 * @returns {string}
 */
function emitModel(modelName, fields) {
  const Model = capitalise(modelName);
  const schemaName = `${Model}Schema`;

  const fieldLines = [...fields].map((f) => `  ${f}: ${inferFieldType(f)},`);

  const schemaBody =
    fieldLines.length > 0
      ? `{\n${fieldLines.join('\n')}\n}`
      : '{}';

  return [
    `const ${schemaName} = new mongoose.Schema(${schemaBody}, { timestamps: true });`,
    `const ${Model} = mongoose.model('${Model}', ${schemaName});`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Walk the AST and generate Mongoose schema + model definitions for every
 * unique model referenced by CRUD statements.
 *
 * Registers `mongoose` as a required import automatically.
 *
 * @param {{ type: 'Program', body: object[] }} ast
 * @returns {string} Node.js source code containing schema and model definitions,
 *                   or an empty string when no models are found.
 */
export function generateModels(ast) {
  const modelFields = collectModelFields(ast);

  if (modelFields.size === 0) return '';

  addImport('mongoose', 'mongoose');

  const blocks = [];
  for (const [modelName, fields] of modelFields.entries()) {
    blocks.push(emitModel(modelName, fields));
  }

  return blocks.join('\n\n');
}
