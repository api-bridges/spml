import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateCrudStatements } from '../../src/codegen/crud.js';
import { generateStream } from '../../src/codegen/stream.js';
import { resetImports } from '../../src/codegen/imports.js';

beforeEach(() => resetImports());

describe('generateStream()', () => {
  it('emits Content-Type text/event-stream header', () => {
    const output = generateStream();
    expect(output).toContain(`res.setHeader('Content-Type', 'text/event-stream')`);
  });

  it('emits Cache-Control no-cache header', () => {
    const output = generateStream();
    expect(output).toContain(`res.setHeader('Cache-Control', 'no-cache')`);
  });

  it('emits Connection keep-alive header', () => {
    const output = generateStream();
    expect(output).toContain(`res.setHeader('Connection', 'keep-alive')`);
  });

  it('calls res.flushHeaders()', () => {
    const output = generateStream();
    expect(output).toContain('res.flushHeaders()');
  });

  it('includes a developer comment for event data', () => {
    const output = generateStream();
    expect(output).toContain('// developer fills in the event data');
  });

  it('matches snapshot', () => {
    expect(generateStream()).toMatchSnapshot();
  });
});

describe('generateCrudStatements() — Stream node', () => {
  it('emits SSE headers when a Stream node is present', () => {
    const output = generateCrudStatements([{ type: 'Stream' }]);
    expect(output).toContain(`res.setHeader('Content-Type', 'text/event-stream')`);
    expect(output).toContain(`res.setHeader('Cache-Control', 'no-cache')`);
    expect(output).toContain(`res.setHeader('Connection', 'keep-alive')`);
    expect(output).toContain('res.flushHeaders()');
  });

  it('matches snapshot when embedded in a route body', () => {
    const output = generateCrudStatements([
      { type: 'Auth', required: true },
      { type: 'Stream' },
    ]);
    expect(output).toMatchSnapshot();
  });
});
