// backends/sqlite.js
// SQLite codegen backend — re-uses the Prisma emitter from backends/prisma.js
// but overrides the datasource provider to 'sqlite' and the database URL to
// 'file:./dev.db' so developers get a zero-install local database.

export {
  generateModels,
  generateDatabase,
  generateCrudStatements,
} from './prisma.js';

import { generatePrismaSchema as _generatePrismaSchema } from './prisma.js';

/**
 * Generate a `schema.prisma` file targeting SQLite.
 *
 * Delegates to the Prisma schema generator but passes the fixed SQLite
 * datasource URL (`file:./dev.db`) so the emitted schema uses the sqlite
 * provider instead of postgresql.
 *
 * @param {{ type: 'Program', body: object[] }} ast
 * @returns {string} schema.prisma file content with sqlite provider
 */
export function generatePrismaSchema(ast) {
  const schema = _generatePrismaSchema(ast, '"file:./dev.db"');
  return schema.replace('provider = "postgresql"', 'provider = "sqlite"');
}
