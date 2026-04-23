// jobs.js
// Generates node-cron schedule calls for JobNode AST nodes.
// Each JobNode compiles to a cron.schedule('<expr>', async () => { … }) block.
// All generators return strings; no file I/O is performed here.

/**
 * Generate the body of a job handler block.
 *
 * @param {object[]} body - Array of AST statement nodes (currently emitted as comments).
 * @param {string} indent - Indentation prefix for each line.
 * @returns {string}
 */
function generateJobBody(body, indent = '  ') {
  if (!body || body.length === 0) {
    return `${indent}// scheduled task body`;
  }
  // Each node in the body is rendered as a descriptive comment so that the
  // emitted output is always valid JavaScript regardless of statement type.
  return body.map((node) => `${indent}// ${node.type}`).join('\n');
}

/**
 * Generate a node-cron schedule call for a single JobNode.
 *
 * Trionary:
 *   job daily at midnight
 *     delete Session by expiredAt
 *
 * Output:
 *   cron.schedule('0 0 * * *', async () => {
 *     // scheduled task body
 *   });
 *
 * @param {{ type: 'Job', schedule: string, body: object[] }} node
 * @returns {string}
 */
export function generateJob(node) {
  const bodyCode = generateJobBody(node.body);
  return [
    `cron.schedule('${node.schedule}', async () => {`,
    bodyCode,
    `});`,
  ].join('\n');
}
