// resolve.js
// Pre-processing pass that resolves `import routes from "<path>"` statements.
// Reads each imported .tri file, parses it, and merges its RouteNodes into the
// parent program's body.  Detects and throws on circular imports.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { tokenize } from '../lexer/lexer.js';
import { parse } from '../parser/parser.js';
import { TrinaryError } from '../errors/TrinaryError.js';

/**
 * Resolve all `ImportNode`s in a parsed program, merging imported routes into
 * the parent program's body.  Mutates and returns the same ProgramNode.
 *
 * @param {object} program - A `ProgramNode` produced by the parser.
 * @param {string} filePath - Absolute path of the file that produced `program`.
 *   Used as the base for resolving relative import paths.
 * @param {Set<string>} [_seen] - Internal set for circular-import detection.
 *   Callers should omit this parameter; it is populated recursively.
 * @returns {object} The same `ProgramNode` with imports resolved in-place.
 */
export function resolveImports(program, filePath, _seen = new Set()) {
  const absolutePath = resolve(filePath);
  _seen.add(absolutePath);

  const resolved = [];

  for (const node of program.body) {
    if (node.type !== 'Import') {
      resolved.push(node);
      continue;
    }

    // Resolve the import path relative to the importing file's directory
    const importPath = resolveImportPath(node.path, absolutePath);

    if (_seen.has(importPath)) {
      throw new TrinaryError(
        `Circular import detected: "${importPath}" is already being compiled.`,
        { source: 'compiler' },
      );
    }

    let source;
    try {
      source = readFileSync(importPath, 'utf8');
    } catch (err) {
      throw new TrinaryError(
        `Cannot read imported file "${importPath}": ${err.message}`,
        { source: 'compiler' },
      );
    }

    const importedAst = parse(tokenize(source));

    // Recursively resolve imports in the imported file
    resolveImports(importedAst, importPath, new Set(_seen));

    // Merge only RouteNodes from the imported file into the parent program
    for (const importedNode of importedAst.body) {
      if (importedNode.type === 'Route') {
        resolved.push(importedNode);
      }
    }
  }

  program.body = resolved;
  return program;
}

/**
 * Resolve an import path string to an absolute filesystem path.
 * Ensures the `.tri` extension is appended when absent.
 *
 * @param {string} importPathStr - The raw path value from the import statement.
 * @param {string} fromAbsolute - Absolute path of the importing file.
 * @returns {string} Absolute path to the imported file.
 */
function resolveImportPath(importPathStr, fromAbsolute) {
  const withExt = importPathStr.endsWith('.tri') ? importPathStr : `${importPathStr}.tri`;
  return resolve(dirname(fromAbsolute), withExt);
}
