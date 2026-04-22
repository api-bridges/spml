// escape.js
// Generates code for the Trionary inline Node.js escape hatch.
// When a route body contains a `js:` block, the raw JS is emitted verbatim
// inside the route handler, preceded by a warning comment.
// A console warning is also printed at code-generation time so developers
// know the block is not validated by Trionary.

/**
 * Generate code for an EscapeHatchNode.
 * Emits the raw JS verbatim, preceded by a warning comment.
 *
 * @param {{ type: 'EscapeHatch', rawJs: string, line?: number }} node
 * @returns {string}
 */
export function generateEscape(node) {
  const lineInfo = node.line != null ? ` at line ${node.line}` : '';
  process.stderr.write(
    `\u26a0 Escape hatch used${lineInfo}. Output is not validated by Trionary.\n`,
  );
  return [
    '// --- trionary escape hatch: raw Node.js below ---',
    node.rawJs,
  ].join('\n');
}
