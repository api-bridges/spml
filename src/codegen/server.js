// server.js
// Generates the Node.js boilerplate for Express server startup from a ServerDeclarationNode.
// Returns a string of Node.js code; no file I/O is performed here.

/**
 * Generate Express server startup code from a ServerDeclarationNode.
 *
 * @param {{ type: 'ServerDeclaration', port: number|string }} node
 * @returns {string} Node.js source code string.
 */
export function generateServer(node) {
  const port = node.port;
  return [
    `const app = express();`,
    `const PORT = ${port};`,
    `app.listen(PORT, () => {`,
    `  console.log(\`Server running on port \${PORT}\`);`,
    `});`,
  ].join('\n');
}
