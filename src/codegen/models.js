// models.js
// Generates Mongoose schema and model definitions by inferring field shapes
// from the AST.  Called during compilation (Step 18) so that the compiled
// output is fully self-contained — no hand-written schema files are needed.

import { addImport } from './imports.js';

// ---------------------------------------------------------------------------
// Field-type inference helpers
// ---------------------------------------------------------------------------

/**
 * Maps an explicit Trionary type keyword to its Mongoose schema type expression.
 *
 * @type {Map<string, string>}
 */
const EXPLICIT_TYPE_MAP = new Map([
  ['String', 'String'],
  ['Number', 'Number'],
  ['Boolean', 'Boolean'],
  ['Date', 'Date'],
]);

/**
 * Map a field name to its Mongoose schema type expression (name-based inference).
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

/**
 * Resolve the Mongoose type expression for a field.
 *
 * If the field has an explicit `ref` property, emit an ObjectId reference.
 * If an explicit Trionary type keyword is provided (e.g. 'Number'), it is
 * mapped directly.  Otherwise the field name is used for inference.
 *
 * @param {string} fieldName
 * @param {string} fieldType  Trionary type keyword (e.g. 'Number') or 'String' as default
 * @param {string|null} ref   Referenced model name (e.g. 'User'), or null
 * @returns {string}
 */
function resolveFieldType(fieldName, fieldType, ref) {
  if (ref) {
    return `{ type: mongoose.Schema.Types.ObjectId, ref: '${ref}' }`;
  }
  if (fieldType && EXPLICIT_TYPE_MAP.has(fieldType)) {
    // For String, still apply name-based inference so that email/id conventions hold.
    if (fieldType === 'String') return inferFieldType(fieldName);
    return EXPLICIT_TYPE_MAP.get(fieldType);
  }
  return inferFieldType(fieldName);
}

// ---------------------------------------------------------------------------
// AST walker
// ---------------------------------------------------------------------------

/**
 * Walk the full AST and build a map of model name → Map of field name → field type.
 *
 * For each Route node the walker:
 *   - Identifies which model(s) the route operates on (Create, Update, Delete,
 *     Find, Paginate, ExistsCheck nodes carry a `model` or `target` property).
 *   - Collects field definitions from TakeNode and CreateNode/UpdateNode siblings
 *     in that same route and associates them with the detected model.
 *   - FieldNode objects (from Create/Update) carry an explicit `fieldType`; plain
 *     strings (from TakeNode) fall back to name-based inference.
 *
 * @param {{ type: 'Program', body: object[] }} ast
 * @returns {Map<string, Map<string, string>>}  lower-case model name → (field name → Mongoose type expression)
 */
function collectModelFields(ast) {
  /** @type {Map<string, Map<string, string>>} */
  const modelFields = new Map();

  for (const node of ast.body) {
    if (node.type !== 'Route') continue;

    // Determine which models are referenced in this route.
    const routeModels = new Set();
    // Each entry is { name: string, fieldType: string|null }
    // fieldType null means "infer from name"
    const routeFields = [];

    for (const stmt of node.body) {
      switch (stmt.type) {
        case 'Create':
        case 'Update':
        case 'Delete':
          if (stmt.model) routeModels.add(stmt.model.toLowerCase());
          // CreateNode / UpdateNode carry an explicit fields list (FieldNode objects or strings)
          if (Array.isArray(stmt.fields)) {
            for (const f of stmt.fields) {
              if (f && typeof f === 'object' && f.type === 'Field') {
                routeFields.push({ name: f.name.trim(), fieldType: f.fieldType, ref: f.ref ?? null });
              } else if (typeof f === 'string') {
                routeFields.push({ name: f.trim(), fieldType: null, ref: null });
              }
            }
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
            for (const f of stmt.fields) {
              routeFields.push({ name: (typeof f === 'string' ? f : f.name).trim(), fieldType: null, ref: null });
            }
          } else if (typeof stmt.fields === 'string') {
            routeFields.push({ name: stmt.fields.trim(), fieldType: null, ref: null });
          }
          break;

        default:
          break;
      }
    }

    // Associate collected fields with every model touched in this route.
    for (const modelName of routeModels) {
      if (!modelFields.has(modelName)) {
        modelFields.set(modelName, { types: new Map(), explicit: new Set() });
      }
      const { types: fieldMap, explicit: explicitSet } = modelFields.get(modelName);
      for (const { name, fieldType, ref } of routeFields) {
        const isExplicit = fieldType !== null || ref !== null;
        if (!fieldMap.has(name)) {
          // First time we see this field: record it with its type (inferred or explicit).
          fieldMap.set(name, resolveFieldType(name, fieldType ?? 'String', ref));
          if (isExplicit) explicitSet.add(name);
        } else if (isExplicit && !explicitSet.has(name)) {
          // Field was previously inferred; an explicit declaration overrides it.
          fieldMap.set(name, resolveFieldType(name, fieldType, ref));
          explicitSet.add(name);
        }
        // If the field already has an explicit type, subsequent declarations are ignored.
      }
    }
  }

  // Strip the internal bookkeeping wrapper before returning.
  /** @type {Map<string, Map<string, string>>} */
  const result = new Map();
  for (const [modelName, { types }] of modelFields.entries()) {
    result.set(modelName, types);
  }
  return result;
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
 * @param {string}           modelName  Lower-case model name (e.g. "user")
 * @param {Map<string,string>} fieldMap  Field name → Mongoose type expression
 * @returns {string}
 */
function emitModel(modelName, fieldMap) {
  const Model = capitalise(modelName);
  const schemaName = `${Model}Schema`;

  const fieldLines = [...fieldMap.entries()].map(([name, typeExpr]) => `  ${name}: ${typeExpr},`);

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
