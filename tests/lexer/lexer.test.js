import { describe, it, expect } from '@jest/globals';
import { tokenize } from '../../src/lexer/lexer.js';
import { TOKEN_TYPES } from '../../src/lexer/tokens.js';
import { TrinaryError } from '../../src/errors/TrinaryError.js';

// Strips NEWLINE and EOF tokens so assertions can focus on meaningful content
const meaningful = (tokens) =>
  tokens.filter((t) => t.type !== TOKEN_TYPES.NEWLINE && t.type !== TOKEN_TYPES.EOF);

describe('tokenize()', () => {
  // ── Keyword tokens ──────────────────────────────────────────────────────────

  describe('keyword tokens', () => {
    it('classifies "server" as KEYWORD', () => {
      const tokens = meaningful(tokenize('server'));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TOKEN_TYPES.KEYWORD, value: 'server', line: 1 });
    });

    it('classifies "route" as KEYWORD', () => {
      const tokens = meaningful(tokenize('route'));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TOKEN_TYPES.KEYWORD, value: 'route', line: 1 });
    });

    it('classifies "return" as KEYWORD', () => {
      const tokens = meaningful(tokenize('return'));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TOKEN_TYPES.KEYWORD, value: 'return', line: 1 });
    });

    it('classifies an unknown word as IDENTIFIER (not KEYWORD)', () => {
      const tokens = meaningful(tokenize('myModel'));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TOKEN_TYPES.IDENTIFIER, value: 'myModel' });
    });
  });

  // ── String literals ─────────────────────────────────────────────────────────

  describe('string literals', () => {
    it('strips surrounding double quotes and emits STRING token', () => {
      const tokens = meaningful(tokenize('"mongodb://localhost/myapp"'));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({
        type: TOKEN_TYPES.STRING,
        value: 'mongodb://localhost/myapp',
      });
    });

    it('handles an empty string literal', () => {
      const tokens = meaningful(tokenize('""'));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TOKEN_TYPES.STRING, value: '' });
    });
  });

  // ── Number literals ─────────────────────────────────────────────────────────

  describe('number literals', () => {
    it('tokenises an integer', () => {
      const tokens = meaningful(tokenize('3000'));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TOKEN_TYPES.NUMBER, value: '3000' });
    });

    it('tokenises multiple numbers on one line', () => {
      const nums = meaningful(tokenize('20 200')).filter((t) => t.type === TOKEN_TYPES.NUMBER);
      expect(nums).toHaveLength(2);
      expect(nums[0].value).toBe('20');
      expect(nums[1].value).toBe('200');
    });

    it('tokenises a floating-point number', () => {
      const tokens = meaningful(tokenize('3.14'));
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ type: TOKEN_TYPES.NUMBER, value: '3.14' });
    });
  });

  // ── INDENT / DEDENT ─────────────────────────────────────────────────────────

  describe('INDENT and DEDENT tokens', () => {
    it('emits an INDENT token when indentation level increases', () => {
      const tokens = tokenize('server\n  port 3000');
      const types = tokens.map((t) => t.type);
      expect(types).toContain(TOKEN_TYPES.INDENT);
    });

    it('emits a DEDENT token when indentation level decreases', () => {
      const tokens = tokenize('server\n  port 3000\nroute GET /users');
      const types = tokens.map((t) => t.type);
      expect(types).toContain(TOKEN_TYPES.DEDENT);
    });

    it('emits matching numbers of INDENT and DEDENT tokens', () => {
      const source = 'server\n  port 3000\nroute GET /users';
      const tokens = tokenize(source);
      const indents = tokens.filter((t) => t.type === TOKEN_TYPES.INDENT).length;
      const dedents = tokens.filter((t) => t.type === TOKEN_TYPES.DEDENT).length;
      expect(indents).toBe(dedents);
    });

    it('handles two levels of indentation', () => {
      const source = 'server\n  route GET /users\n    return ok';
      const tokens = tokenize(source);
      const indents = tokens.filter((t) => t.type === TOKEN_TYPES.INDENT).length;
      const dedents = tokens.filter((t) => t.type === TOKEN_TYPES.DEDENT).length;
      expect(indents).toBe(2);
      expect(dedents).toBe(2);
    });
  });

  // ── Comments ────────────────────────────────────────────────────────────────

  describe('comments', () => {
    it('strips a whole-line comment and produces no COMMENT token', () => {
      const tokens = tokenize('# this is a comment\nserver');
      const types = tokens.map((t) => t.type);
      expect(types).not.toContain(TOKEN_TYPES.COMMENT);
    });

    it('still emits the keyword after a comment-only line', () => {
      const tokens = tokenize('# this is a comment\nserver');
      const kws = tokens.filter((t) => t.type === TOKEN_TYPES.KEYWORD);
      expect(kws).toHaveLength(1);
      expect(kws[0].value).toBe('server');
    });

    it('strips an inline comment that follows real tokens', () => {
      const tokens = tokenize('server # inline comment');
      const types = tokens.map((t) => t.type);
      expect(types).not.toContain(TOKEN_TYPES.COMMENT);
      const kws = tokens.filter((t) => t.type === TOKEN_TYPES.KEYWORD);
      expect(kws[0].value).toBe('server');
    });
  });

  // ── Position tracking ───────────────────────────────────────────────────────

  describe('position tracking', () => {
    it('assigns line: 1 to a token on the first line', () => {
      const tokens = tokenize('server');
      const kw = tokens.find((t) => t.type === TOKEN_TYPES.KEYWORD);
      expect(kw.line).toBe(1);
    });

    it('assigns line: 2 to a token on the second line', () => {
      const tokens = tokenize('server\nroute');
      const kw = tokens.find((t) => t.value === 'route');
      expect(kw.line).toBe(2);
    });

    it('tracks column numbers correctly', () => {
      const tokens = tokenize('server port');
      const portToken = tokens.find((t) => t.value === 'port');
      // "server " is 7 characters, so "port" starts at col 8
      expect(portToken.col).toBe(8);
    });
  });

  // ── Unknown characters ──────────────────────────────────────────────────────

  describe('unknown characters', () => {
    it('throws a TrinaryError for an unrecognised character', () => {
      expect(() => tokenize('@')).toThrow(TrinaryError);
    });

    it('includes the unrecognised character in the error message', () => {
      expect(() => tokenize('@')).toThrow('@');
    });

    it('includes the line number in the error', () => {
      let err;
      try {
        tokenize('@');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(TrinaryError);
      expect(err.line).toBe(1);
    });

    it('reports the correct line number when the bad char is on line 2', () => {
      let err;
      try {
        tokenize('server\n@');
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(TrinaryError);
      expect(err.line).toBe(2);
    });
  });

  // ── Complete snippet ────────────────────────────────────────────────────────

  describe('complete Trionary snippet', () => {
    const source = [
      'server',
      '  port 3000',
      '  database connect "mongodb://localhost/myapp"',
      '  route GET /users',
      '    auth required',
      '    return ok',
    ].join('\n');

    it('produces the expected first token: KEYWORD "server"', () => {
      const tokens = meaningful(tokenize(source));
      expect(tokens[0]).toMatchObject({ type: TOKEN_TYPES.KEYWORD, value: 'server' });
    });

    it('produces an INDENT after "server"', () => {
      const tokens = meaningful(tokenize(source));
      expect(tokens[1]).toMatchObject({ type: TOKEN_TYPES.INDENT });
    });

    it('tokenises "port" as KEYWORD with NUMBER "3000" following it', () => {
      const tokens = meaningful(tokenize(source));
      const portIdx = tokens.findIndex((t) => t.value === 'port');
      expect(tokens[portIdx]).toMatchObject({ type: TOKEN_TYPES.KEYWORD, value: 'port' });
      expect(tokens[portIdx + 1]).toMatchObject({ type: TOKEN_TYPES.NUMBER, value: '3000' });
    });

    it('tokenises the connection string as a STRING token', () => {
      const tokens = meaningful(tokenize(source));
      const str = tokens.find((t) => t.type === TOKEN_TYPES.STRING);
      expect(str.value).toBe('mongodb://localhost/myapp');
    });

    it('tokenises "route" and "GET" as KEYWORD tokens', () => {
      const tokens = meaningful(tokenize(source));
      const routeTok = tokens.find((t) => t.value === 'route');
      const getTok = tokens.find((t) => t.value === 'GET');
      expect(routeTok).toMatchObject({ type: TOKEN_TYPES.KEYWORD });
      expect(getTok).toMatchObject({ type: TOKEN_TYPES.KEYWORD });
    });

    it('ends with an EOF token', () => {
      const tokens = tokenize(source);
      expect(tokens[tokens.length - 1]).toMatchObject({ type: TOKEN_TYPES.EOF });
    });
  });
});
