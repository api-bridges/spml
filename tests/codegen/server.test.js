import { describe, it, expect } from '@jest/globals';
import { generateServer, generateEnvExample } from '../../src/codegen/server.js';

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

  it('emits process.env reference when envVar is set', () => {
    const output = generateServer({ type: 'ServerDeclaration', port: null, envVar: 'PORT' });
    expect(output).toContain('process.env.PORT || 3000');
  });

  it('uses envVar in PORT constant when envVar is set', () => {
    const output = generateServer({ type: 'ServerDeclaration', port: null, envVar: 'APP_PORT' });
    expect(output).toContain('const PORT = process.env.APP_PORT || 3000;');
  });

  it('matches snapshot', () => {
    const output = generateServer({ type: 'ServerDeclaration', port: 3000 });
    expect(output).toMatchSnapshot();
  });

  it('matches snapshot with envVar', () => {
    const output = generateServer({ type: 'ServerDeclaration', port: null, envVar: 'PORT' });
    expect(output).toMatchSnapshot();
  });
});

describe('generateEnvExample()', () => {
  it('generates a line per variable with empty value', () => {
    const output = generateEnvExample(['PORT', 'MONGODB_URI']);
    expect(output).toContain('PORT=');
    expect(output).toContain('MONGODB_URI=');
  });

  it('ends with a newline', () => {
    const output = generateEnvExample(['PORT']);
    expect(output.endsWith('\n')).toBe(true);
  });

  it('returns an empty string with trailing newline for empty list', () => {
    const output = generateEnvExample([]);
    expect(output).toBe('\n');
  });

  it('matches snapshot', () => {
    const output = generateEnvExample(['PORT', 'MONGODB_URI']);
    expect(output).toMatchSnapshot();
  });
});
