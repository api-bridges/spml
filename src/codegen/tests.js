// tests.js
// Generates Jest + supertest test code from TestNode AST nodes.
// Each TestNode compiles to a describe/it block using supertest to exercise the compiled app.
// All generators return strings; no file I/O is performed here.

/**
 * Derive a human-readable `it()` description from a TestNode's expectations.
 *
 * @param {object} testNode - TestNode AST node.
 * @returns {string}
 */
function deriveItDescription(testNode) {
  const statusExpect = testNode.body.find(
    (n) => n.type === 'Expect' && n.expectType === 'status',
  );
  if (statusExpect) {
    return `returns status ${statusExpect.assertion.code}`;
  }
  return 'should satisfy expectations';
}

/**
 * Generate the supertest call for a SendNode.
 *
 * @param {object} node - SendNode AST node.
 * @returns {string}
 */
function generateSendCall(node) {
  const method = node.method.toLowerCase();
  let chain = `request(app).${method}('${node.path}')`;
  if (node.fields && node.fields.length > 0) {
    const bodyObj = node.fields
      .map((f) => `${f.name}: '${f.value}'`)
      .join(', ');
    chain += `.send({ ${bodyObj} })`;
  }
  return `    const res = await ${chain};`;
}

/**
 * Generate a single Jest expect assertion from an ExpectNode.
 *
 * @param {object} node - ExpectNode AST node.
 * @returns {string}
 */
function generateExpectAssertion(node) {
  if (node.expectType === 'status') {
    return `    expect(res.status).toBe(${node.assertion.code});`;
  }
  if (node.expectType === 'body') {
    const prop = `res.body.${node.assertion.path}`;
    if (node.assertion.check === 'exists') {
      return `    expect(${prop}).toBeDefined();`;
    }
    return `    expect(${prop}).toBe('${node.assertion.check.equals}');`;
  }
  return '';
}

/**
 * Generate a complete Jest describe/it block for a single TestNode.
 *
 * Trionary:
 *   test "POST /register creates a user"
 *     send POST /register with name "Alice", email "alice@example.com", password "secret"
 *     expect status 200
 *     expect body.token exists
 *
 * Output:
 *   describe('POST /register creates a user', () => {
 *     it('returns status 200', async () => {
 *       const res = await request(app).post('/register').send({ name: 'Alice', email: 'alice@example.com', password: 'secret' });
 *       expect(res.status).toBe(200);
 *       expect(res.body.token).toBeDefined();
 *     });
 *   });
 *
 * @param {{ type: 'Test', description: string, body: object[] }} node
 * @returns {string}
 */
export function generateTest(node) {
  const itDesc = deriveItDescription(node);
  const lines = [];
  lines.push(`describe('${node.description}', () => {`);
  lines.push(`  it('${itDesc}', async () => {`);
  for (const stmt of node.body) {
    if (stmt.type === 'Send') {
      lines.push(generateSendCall(stmt));
    } else if (stmt.type === 'Expect') {
      lines.push(generateExpectAssertion(stmt));
    }
  }
  lines.push(`  });`);
  lines.push(`});`);
  return lines.join('\n');
}

/**
 * Generate a complete Jest test file from an array of TestNodes.
 *
 * @param {object[]} testNodes - Array of TestNode AST nodes.
 * @returns {string} Complete test file source.
 */
export function generateTestFile(testNodes) {
  const header = [
    `const request = require('supertest');`,
    `const app = require('./app');`,
    '',
  ].join('\n');
  const blocks = testNodes.map(generateTest).join('\n\n');
  return header + blocks + '\n';
}
