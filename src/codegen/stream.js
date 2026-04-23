// stream.js
// Generates Node.js Express code for a StreamNode (Server-Sent Events route).
// The emitted skeleton sets the required SSE response headers and establishes
// a keep-alive connection; the developer fills in the event data.

/**
 * Generate SSE boilerplate for a StreamNode.
 *
 * Trionary: `stream events`
 * Output:
 *   res.setHeader('Content-Type', 'text/event-stream');
 *   res.setHeader('Cache-Control', 'no-cache');
 *   res.setHeader('Connection', 'keep-alive');
 *   res.flushHeaders();
 *   // developer fills in the event data
 *
 * @returns {string} Node.js source code string.
 */
export function generateStream() {
  return [
    `res.setHeader('Content-Type', 'text/event-stream');`,
    `res.setHeader('Cache-Control', 'no-cache');`,
    `res.setHeader('Connection', 'keep-alive');`,
    `res.flushHeaders();`,
    `// developer fills in the event data`,
  ].join('\n');
}
