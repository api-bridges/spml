// server.js
// Generates the Node.js boilerplate for Express server startup from a ServerDeclarationNode.
// Returns a string of Node.js code; no file I/O is performed here.

/**
 * Generate Express server startup code from a ServerDeclarationNode.
 *
 * @param {{ type: 'ServerDeclaration', port: number|null, envVar: string|null }} node
 * @returns {string} Node.js source code string.
 */
export function generateServer(node) {
  const portExpr = node.envVar
    ? `process.env.${node.envVar} || 3000`
    : node.port;
  return [
    `const app = express();`,
    `const PORT = ${portExpr};`,
    `app.listen(PORT, () => {`,
    `  console.log(\`Server running on port \${PORT}\`);`,
    `});`,
  ].join('\n');
}

/**
 * Generate the contents of a `.env.example` file from a list of environment
 * variable names referenced by the compiled source.
 *
 * @param {string[]} vars - Variable names to include in the example file.
 * @returns {string} The text content of the `.env.example` file.
 */
export function generateEnvExample(vars) {
  const lines = vars.map((v) => `${v}=`);
  return lines.join('\n') + '\n';
}
