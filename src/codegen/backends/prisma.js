// backends/prisma.js
// Prisma-specific codegen backend (PostgreSQL target).
// Emits prisma.<model>.findMany() / create() / update() / delete() calls
// instead of Mongoose equivalents, and generates a schema.prisma file.

// ---------------------------------------------------------------------------
// Schema.prisma generator
// ---------------------------------------------------------------------------

/**
 * Map an explicit Trionary type keyword to a Prisma scalar type.
 *
 * @type {Map<string, string>}
 */
const PRISMA_TYPE_MAP = new Map([
  ['String', 'String'],
  ['Number', 'Int'],
  ['Boolean', 'Boolean'],
  ['Date', 'DateTime'],
]);

/**
 * Infer a Prisma scalar type from a field name (name-based heuristic).
 *
 * @param {string} fieldName
 * @returns {string} Prisma scalar type
 */
function inferPrismaType(fieldName) {
  const lower = fieldName.toLowerCase();
  if (lower === 'email') return 'String @unique';
  if (lower.endsWith('id') && lower !== 'id') return 'Int';
  return 'String';
}

/**
 * Resolve the Prisma type string for a field.
 *
 * @param {string} fieldName
 * @param {string} fieldType  Trionary type keyword or 'String' as default
 * @param {string|null} ref   Referenced model name, or null
 * @returns {string}
 */
function resolvePrismaType(fieldName, fieldType, ref) {
  if (ref) {
    // Emit a relation field; companion Int FK will be emitted separately
    return `${ref}?   @relation(fields: [${fieldName}], references: [id])`;
  }
  if (fieldType && PRISMA_TYPE_MAP.has(fieldType)) {
    if (fieldType === 'String') return inferPrismaType(fieldName);
    return PRISMA_TYPE_MAP.get(fieldType);
  }
  return inferPrismaType(fieldName);
}

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

// ---------------------------------------------------------------------------
// Model-field collector (mirrors models.js logic)
// ---------------------------------------------------------------------------

/**
 * Walk the AST and build a map of model name → array of { name, fieldType, ref }.
 *
 * @param {{ type: 'Program', body: object[] }} ast
 * @returns {Map<string, { name: string, fieldType: string, ref: string|null }[]>}
 */
function collectModelFields(ast) {
  const modelFields = new Map();

  for (const node of ast.body) {
    if (node.type !== 'Route') continue;

    const routeModels = new Set();
    const routeFields = [];

    for (const stmt of node.body) {
      switch (stmt.type) {
        case 'Create':
        case 'Update':
        case 'Delete':
          if (stmt.model) routeModels.add(stmt.model.toLowerCase());
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

    for (const modelName of routeModels) {
      if (!modelFields.has(modelName)) {
        modelFields.set(modelName, { fields: [], seen: new Set() });
      }
      const entry = modelFields.get(modelName);
      for (const f of routeFields) {
        if (!entry.seen.has(f.name)) {
          entry.seen.add(f.name);
          entry.fields.push(f);
        }
      }
    }
  }

  const result = new Map();
  for (const [modelName, { fields }] of modelFields.entries()) {
    result.set(modelName, fields);
  }
  return result;
}

// ---------------------------------------------------------------------------
// schema.prisma emitter
// ---------------------------------------------------------------------------

/**
 * Generate the content of a `schema.prisma` file for all models in the AST.
 *
 * @param {{ type: 'Program', body: object[] }} ast
 * @param {string} [databaseUrl='env("DATABASE_URL")'] - Prisma datasource URL expression.
 * @returns {string} schema.prisma file content
 */
export function generatePrismaSchema(ast, databaseUrl = 'env("DATABASE_URL")') {
  const modelFields = collectModelFields(ast);

  const lines = [
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    '',
    'datasource db {',
    '  provider = "postgresql"',
    `  url      = ${databaseUrl}`,
    '}',
  ];

  for (const [modelName, fields] of modelFields.entries()) {
    const Model = capitalise(modelName);
    lines.push('');
    lines.push(`model ${Model} {`);
    lines.push('  id        Int      @id @default(autoincrement())');
    lines.push('  createdAt DateTime @default(now())');
    lines.push('  updatedAt DateTime @updatedAt');
    for (const { name, fieldType, ref } of fields) {
      if (name === 'id') continue; // skip bare 'id' — already emitted above
      const prismaType = resolvePrismaType(name, fieldType ?? 'String', ref);
      lines.push(`  ${name.padEnd(10)} ${prismaType}`);
    }
    lines.push('}');
  }

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Model definitions (runtime import block)
// ---------------------------------------------------------------------------

/**
 * Generate the `import { PrismaClient } from '@prisma/client'` block and
 * `const prisma = new PrismaClient();` initialisation.
 *
 * @returns {string}
 */
export function generateModels() {
  return [
    `import { PrismaClient } from '@prisma/client';`,
    `const prisma = new PrismaClient();`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Database connection
// ---------------------------------------------------------------------------

/**
 * Generate database connection code for Prisma (no-op — Prisma connects lazily).
 *
 * @returns {string}
 */
export function generateDatabase() {
  return '// Prisma connects automatically on first query.';
}

// ---------------------------------------------------------------------------
// CRUD codegen
// ---------------------------------------------------------------------------

/**
 * Generate Prisma-flavoured CRUD statements for an array of route body nodes.
 *
 * @param {Array<object>} statementsArray
 * @param {string} [modelName]
 * @param {string} [routeMethod]
 * @returns {string}
 */
export function generateCrudStatements(statementsArray, modelName, routeMethod) {
  const lines = [];

  for (let i = 0; i < statementsArray.length; i++) {
    const node = statementsArray[i];
    switch (node.type) {
      case 'Take': {
        const fields = Array.isArray(node.fields) ? node.fields.join(', ') : node.fields;
        lines.push(`const { ${fields} } = req.body;`);
        break;
      }

      case 'Require': {
        const fields = Array.isArray(node.fields) ? node.fields : [node.fields];
        const checks = fields.map((f) => `!${f}`).join(' || ');
        const fieldList = fields.join(', ');
        lines.push(`if (${checks}) return res.status(400).json({ error: 'Missing required fields: ${fieldList}' });`);
        break;
      }

      case 'Find': {
        const next = statementsArray[i + 1];
        const populateNode = next && next.type === 'Populate' ? next : null;
        if (populateNode) i++;
        lines.push(generatePrismaFind(node, modelName, populateNode));
        break;
      }

      case 'Populate':
        lines.push(`// populate ${node.model}.${node.field} (no preceding find)`);
        break;

      case 'Paginate':
        lines.push(generatePrismaPaginate(node, modelName));
        break;

      case 'Create':
        lines.push(generatePrismaCreate(node));
        break;

      case 'Update':
        lines.push(routeMethod === 'PATCH' ? generatePrismaPatchUpdate(node) : generatePrismaUpdate(node));
        break;

      case 'Delete':
        lines.push(generatePrismaDelete(node));
        break;

      case 'Return': {
        const raw = node.value;
        const value = typeof raw === 'string' ? raw.trim() : '';
        if (node.statusCode) {
          const safeRaw = String(raw).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          lines.push(`return res.status(${node.statusCode}).json({ error: '${safeRaw}' });`);
        } else if (value.toLowerCase() === 'ok' || (value.startsWith('"') && value.endsWith('"'))) {
          const inner = value.startsWith('"') ? value.slice(1, -1) : 'Success';
          const safeMsg = inner.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          lines.push(`return res.json({ message: '${safeMsg}' });`);
        } else if (value) {
          lines.push(`return res.json({ ${value} });`);
        } else {
          lines.push(`return res.json({});`);
        }
        break;
      }

      case 'If': {
        const condition = typeof node.condition === 'string' ? node.condition.trim().toLowerCase() : '';
        if (condition === 'not found' || condition === '!found') {
          const varName = (modelName || 'item').toLowerCase();
          const body = node.body;
          const bodyNode = Array.isArray(body) ? body[0] : body;
          const rawMsg = (bodyNode && typeof bodyNode.value === 'string') ? bodyNode.value : 'Not found';
          const safeMsg = rawMsg.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          const status = (bodyNode && typeof bodyNode.statusCode === 'number') ? bodyNode.statusCode : 404;
          lines.push(`if (!${varName}) return res.status(${status}).json({ error: '${safeMsg}' });`);
        } else {
          const bodyCode = typeof node.body === 'string' ? node.body : JSON.stringify(node.body);
          lines.push(`if (${condition}) { ${bodyCode} }`);
        }
        break;
      }

      case 'Validate':
        // Delegate to shared validate codegen
        lines.push(`// validate ${node.field} ${node.rule}`);
        break;

      default:
        break;
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Prisma-specific query helpers
// ---------------------------------------------------------------------------

function generatePrismaFind(node, modelName, populateNode) {
  const resolvedModel = node.target || modelName || 'item';
  const varName = resolvedModel.toLowerCase();
  const model = resolvedModel.toLowerCase();

  const rawFilter = node.filter;
  let filter = '';
  if (rawFilter && typeof rawFilter === 'object') {
    if (rawFilter.by) filter = `by ${rawFilter.by}`;
    else if (rawFilter.field) filter = rawFilter.field;
  } else {
    filter = rawFilter ? String(rawFilter).trim().toLowerCase() : '';
  }

  const opts = node.options || {};
  const includeClause = populateNode
    ? `, include: { ${populateNode.field}: true }`
    : '';

  if (filter === 'all' || opts.all) {
    const sortField = opts.sortBy || 'createdAt';
    return `const ${varName}s = await prisma.${model}.findMany({ orderBy: { ${sortField}: 'desc' }${includeClause} });`;
  }

  if (filter === 'id' || filter === 'by id') {
    return `const ${varName} = await prisma.${model}.findUnique({ where: { id: parseInt(req.params.id, 10) }${includeClause} });`;
  }

  if (filter) {
    return `const ${varName} = await prisma.${model}.findFirst({ where: { ${filter} }${includeClause} });`;
  }

  const cleanedInclude = includeClause.replace(/^,\s*/, '');
  const findManyOpts = cleanedInclude ? ` ${cleanedInclude} ` : '';
  return `const ${varName}s = await prisma.${model}.findMany({${findManyOpts}});`;
}

function generatePrismaPaginate(node, modelName) {
  const resolvedModel = node.target || modelName || 'item';
  const varName = resolvedModel.toLowerCase();
  const model = resolvedModel.toLowerCase();
  const limit = node.limit || 10;

  return [
    `const page = parseInt(req.query.page, 10) || 1;`,
    `const ${varName}s = await prisma.${model}.findMany({ skip: (page - 1) * ${limit}, take: ${limit} });`,
  ].join('\n');
}

function generatePrismaCreate(node) {
  const varName = node.model.toLowerCase();
  const model = node.model.toLowerCase();
  return `const ${varName} = await prisma.${model}.create({ data: { ...req.body } });`;
}

function generatePrismaUpdate(node) {
  const model = node.model.toLowerCase();
  return `await prisma.${model}.update({ where: { id: parseInt(req.params.id, 10) }, data: { ...req.body } });`;
}

function generatePrismaPatchUpdate(node) {
  const model = node.model.toLowerCase();
  const rawFields = Array.isArray(node.fields) ? node.fields : [];
  const fieldNames = rawFields.map((f) => (typeof f === 'string' ? f : f.name));

  const lines = [`const updates = {};`];
  for (const field of fieldNames) {
    lines.push(`if (req.body.${field} !== undefined) updates.${field} = req.body.${field};`);
  }
  lines.push(`await prisma.${model}.update({ where: { id: parseInt(req.params.id, 10) }, data: updates });`);
  return lines.join('\n');
}

function generatePrismaDelete(node) {
  const model = node.model.toLowerCase();
  return `await prisma.${model}.delete({ where: { id: parseInt(req.params.id, 10) } });`;
}
