// socket.js
// Generates Node.js WebSocket handler code for SocketNode AST nodes.
// Emits `ws` package setup using wss.on('connection', …) patterns.
// All generators return strings; no file I/O is performed here.

// Safe identifier pattern — matches what the Trionary lexer accepts for identifiers/keywords.
const SAFE_IDENTIFIER = /^[A-Za-z_]\w*$/;

/**
 * Generate code for a BroadcastNode inside a socket event handler.
 * Trionary: `broadcast message`
 * Output:   _wss.clients.forEach((client) => { … client.send(…) … });
 *
 * @param {{ type: 'Broadcast', data: string }} node
 * @returns {string}
 */
function generateBroadcast(node) {
  const data = SAFE_IDENTIFIER.test(node.data) ? node.data : 'data';
  return [
    `_wss.clients.forEach((client) => {`,
    `  if (client.readyState === WebSocket.OPEN) {`,
    `    client.send(${data}.toString());`,
    `  }`,
    `});`,
  ].join('\n');
}

/**
 * Generate code for the body of a socket event handler block.
 *
 * @param {object[]} body - Array of AST statement nodes.
 * @returns {string}
 */
function generateSocketBody(body) {
  const lines = [];
  for (const node of body) {
    if (node.type === 'Broadcast') {
      lines.push(generateBroadcast(node));
    }
  }
  return lines.join('\n');
}

/**
 * Generate a WebSocket connection handler for a SocketNode.
 * Trionary:
 *   socket /chat
 *     on message
 *       broadcast message
 *
 * Output:
 *   _wss.on('connection', (ws) => {
 *     ws.on('message', (message) => {
 *       _wss.clients.forEach((client) => { … });
 *     });
 *   });
 *
 * @param {{ type: 'Socket', path: string, event: string, body: object[] }} node
 * @returns {string}
 */
export function generateSocketHandler(node) {
  const bodyCode = generateSocketBody(node.body);
  const indentedBody = bodyCode
    ? bodyCode.split('\n').map((l) => `    ${l}`).join('\n')
    : `    // handle ${node.event} event`;

  return [
    `_wss.on('connection', (ws) => {`,
    `  ws.on('${node.event}', (${node.event}) => {`,
    indentedBody,
    `  });`,
    `});`,
  ].join('\n');
}
