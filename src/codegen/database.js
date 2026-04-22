// database.js
// Generates the Mongoose connection boilerplate from a DatabaseDeclarationNode.
// Returns a string of Node.js code; no file I/O is performed here.

/**
 * Generate Mongoose database connection code from a DatabaseDeclarationNode.
 *
 * @param {{ type: 'DatabaseDeclaration', uri: string }} node
 * @returns {string} Node.js source code string.
 */
export function generateDatabase(node) {
  const uri = node.uri;
  return [
    `mongoose.connect('${uri}', {`,
    `  useNewUrlParser: true,`,
    `  useUnifiedTopology: true,`,
    `});`,
  ].join('\n');
}
