// database.js
// Generates the Mongoose connection boilerplate from a DatabaseDeclarationNode.
// Returns a string of Node.js code; no file I/O is performed here.

/**
 * Generate Mongoose database connection code from a DatabaseDeclarationNode.
 *
 * @param {{ type: 'DatabaseDeclaration', uri: string|null, envVar: string|null }} node
 * @returns {string} Node.js source code string.
 */
export function generateDatabase(node) {
  const connArg = node.envVar
    ? `process.env.${node.envVar}`
    : `'${node.uri}'`;
  return [
    `mongoose.connect(${connArg}, {`,
    `  useNewUrlParser: true,`,
    `  useUnifiedTopology: true,`,
    `});`,
  ].join('\n');
}
