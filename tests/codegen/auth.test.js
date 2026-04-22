import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateAuthStatements } from '../../src/codegen/auth.js';
import { resetImports } from '../../src/codegen/imports.js';

beforeEach(() => resetImports());

describe('generateAuthStatements()', () => {
  // ── register flow ───────────────────────────────────────────────────────────

  describe('register flow', () => {
    it('generates bcrypt.hash for a Hash node', () => {
      const output = generateAuthStatements([{ type: 'Hash', field: 'password' }]);
      expect(output).toContain('bcrypt.hash(password, 10)');
    });

    it('generates ExistsCheck for a user model filtered by email', () => {
      const output = generateAuthStatements([{ type: 'ExistsCheck', model: 'user', filter: 'email' }]);
      expect(output).toContain('User.findOne({ email })');
    });

    it('generates an if-exists guard with a 409 response', () => {
      const output = generateAuthStatements([
        { type: 'If', condition: 'exists', body: 'Email already in use' },
      ]);
      expect(output).toContain("res.status(409).json({ error: 'Email already in use' })");
    });

    it('generates User.create for a Create node', () => {
      const output = generateAuthStatements([
        { type: 'Create', model: 'user', fields: ['name', 'email', 'password'] },
      ]);
      expect(output).toContain('User.create');
    });

    it('generates jwt.sign for a Return token node', () => {
      const output = generateAuthStatements([{ type: 'Return', value: 'token' }]);
      expect(output).toContain('jwt.sign');
    });

    it('generates a complete register flow snapshot', () => {
      const nodes = [
        { type: 'Hash', field: 'password' },
        { type: 'ExistsCheck', model: 'user', filter: 'email' },
        { type: 'If', condition: 'exists', body: 'Email already in use' },
        { type: 'Create', model: 'user', fields: ['name', 'email', 'password'] },
        { type: 'Return', value: 'token' },
      ];
      expect(generateAuthStatements(nodes)).toMatchSnapshot();
    });
  });

  // ── login flow ──────────────────────────────────────────────────────────────

  describe('login flow', () => {
    it('generates User.findOne for a Find node', () => {
      const output = generateAuthStatements([{ type: 'Find', target: 'user', filter: 'email' }]);
      expect(output).toContain('User.findOne({ email })');
    });

    it('generates bcrypt.compare for a Validate-matches node', () => {
      const output = generateAuthStatements([{ type: 'Validate', rule: 'matches' }]);
      expect(output).toContain('bcrypt.compare(password, user.password)');
    });

    it('generates an invalid-credentials guard for condition "not valid"', () => {
      const output = generateAuthStatements([
        { type: 'If', condition: 'not valid', body: 'Invalid credentials' },
      ]);
      expect(output).toContain("res.status(401).json({ error: 'Invalid credentials' })");
    });

    it('generates jwt.sign in the Return token output', () => {
      const output = generateAuthStatements([{ type: 'Return', value: 'token' }]);
      expect(output).toContain('jwt.sign');
    });
  });

  // ── /me route ───────────────────────────────────────────────────────────────

  describe('/me route', () => {
    it('returns req.user for a Return "current user" node', () => {
      const output = generateAuthStatements([{ type: 'Return', value: 'current user' }]);
      expect(output).toContain('req.user');
    });
  });

  // ── escape hatch ─────────────────────────────────────────────────────────────

  describe('escape hatch node', () => {
    it('emits the raw JS verbatim', () => {
      const rawJs = 'console.log("escape hatch");';
      const output = generateAuthStatements([{ type: 'EscapeHatch', rawJs }]);
      expect(output).toContain(rawJs);
    });

    it('includes the trionary escape hatch comment', () => {
      const output = generateAuthStatements([
        { type: 'EscapeHatch', rawJs: 'const x = 1;' },
      ]);
      expect(output).toContain('trionary escape hatch');
    });
  });
});
