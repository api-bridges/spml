// imports.js
// Tracks which npm packages are used during code generation and produces the
// import/require block that goes at the top of every generated output file.
// All generators call addImport(); the final emitter calls generateImports().

/**
 * Internal registry: package name → local identifier used in generated code.
 * @type {Map<string, string>}
 */
const importRegistry = new Map();

/**
 * Register a package dependency so it appears in the generated import block.
 *
 * @param {string} pkg   - npm package name (e.g. 'express', 'mongoose').
 * @param {string} local - Local identifier used in generated code (e.g. 'express').
 */
export function addImport(pkg, local) {
  if (!importRegistry.has(pkg)) {
    importRegistry.set(pkg, local);
  }
}

/**
 * Generate the full ES-module import block from the collected registry.
 * Call this once, after all AST nodes have been processed, to produce the
 * top-of-file import statements.
 *
 * @returns {string} Newline-separated import statements.
 */
export function generateImports() {
  const lines = [];
  for (const [pkg, local] of importRegistry.entries()) {
    lines.push(`import ${local} from '${pkg}';`);
  }
  return lines.join('\n');
}

/**
 * Reset the import registry (useful between compilation runs or in tests).
 */
export function resetImports() {
  importRegistry.clear();
}
