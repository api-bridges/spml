import { describe, it, expect } from '@jest/globals';
import { generateServer } from '../../src/codegen/server.js';

describe('generateServer()', () => {
  it('contains app.listen(PORT', () => {
    const output = generateServer({ type: 'ServerDeclaration', port: 3000 });
    expect(output).toContain('app.listen(PORT');
  });

  it('sets PORT constant to the given port', () => {
    const output = generateServer({ type: 'ServerDeclaration', port: 3000 });
    expect(output).toContain('const PORT = 3000;');
  });

  it('works with a different port number', () => {
    const output = generateServer({ type: 'ServerDeclaration', port: 8080 });
    expect(output).toContain('app.listen(PORT');
    expect(output).toContain('const PORT = 8080;');
  });

  it('matches snapshot', () => {
    const output = generateServer({ type: 'ServerDeclaration', port: 3000 });
    expect(output).toMatchSnapshot();
  });
});
