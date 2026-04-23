// backends/mongoose.js
// Mongoose-specific codegen backend (MongoDB target).
// Re-exports the existing model generation and wraps CRUD codegen with
// Mongoose-flavoured helpers.  This is the default backend when no
// `database type` declaration is present.

export { generateModels } from '../models.js';
export { generateCrudStatements } from '../crud.js';
export { generateDatabase } from '../database.js';
