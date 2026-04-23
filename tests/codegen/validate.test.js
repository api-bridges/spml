import { describe, it, expect } from '@jest/globals';
import { generateValidate } from '../../src/codegen/validate.js';
import { TrinaryError } from '../../src/errors/TrinaryError.js';

describe('generateValidate()', () => {
  // ── email rule ───────────────────────────────────────────────────────────────

  describe('email rule', () => {
    it('generates an email regex check for rule "is email"', () => {
      const output = generateValidate({ type: 'Validate', field: 'email', rule: 'is email' });
      expect(output).toContain('emailRegex');
    });

    it('returns a 400 response on invalid email', () => {
      const output = generateValidate({ type: 'Validate', field: 'email', rule: 'is email' });
      expect(output).toContain("res.status(400).json({ error: 'Invalid email address' })");
    });

    it('also accepts rule "email" (shorthand)', () => {
      const output = generateValidate({ type: 'Validate', field: 'email', rule: 'email' });
      expect(output).toContain('emailRegex');
    });

    it('matches snapshot', () => {
      const output = generateValidate({ type: 'Validate', field: 'email', rule: 'is email' });
      expect(output).toMatchSnapshot();
    });
  });

  // ── minLength rule ───────────────────────────────────────────────────────────

  describe('minLength rule', () => {
    it('generates a length check for rule "min length"', () => {
      const output = generateValidate({ type: 'Validate', field: 'password', rule: 'min length', value: 8 });
      expect(output).toContain('password.length < 8');
    });

    it('returns a 400 response when length is too short', () => {
      const output = generateValidate({ type: 'Validate', field: 'password', rule: 'min length', value: 8 });
      expect(output).toContain("res.status(400)");
    });

    it('also accepts rule "minLength" (camelCase)', () => {
      const output = generateValidate({ type: 'Validate', field: 'password', rule: 'minLength', value: 6 });
      expect(output).toContain('password.length < 6');
    });

    it('matches snapshot', () => {
      const output = generateValidate({ type: 'Validate', field: 'password', rule: 'min length', value: 8 });
      expect(output).toMatchSnapshot();
    });
  });

  // ── number rule ──────────────────────────────────────────────────────────────

  describe('number rule', () => {
    it('generates a typeof check for rule "is number"', () => {
      const output = generateValidate({ type: 'Validate', field: 'age', rule: 'is number' });
      expect(output).toContain("typeof age !== 'number'");
    });

    it('also checks for NaN', () => {
      const output = generateValidate({ type: 'Validate', field: 'age', rule: 'is number' });
      expect(output).toContain('isNaN(age)');
    });

    it('returns a 400 response for non-numeric values', () => {
      const output = generateValidate({ type: 'Validate', field: 'age', rule: 'is number' });
      expect(output).toContain("res.status(400).json({ error: 'Age must be a number' })");
    });

    it('also accepts rule "number" (shorthand)', () => {
      const output = generateValidate({ type: 'Validate', field: 'age', rule: 'number' });
      expect(output).toContain("typeof age !== 'number'");
    });

    it('matches snapshot', () => {
      const output = generateValidate({ type: 'Validate', field: 'age', rule: 'is number' });
      expect(output).toMatchSnapshot();
    });
  });

  // ── minMaxLength rule ────────────────────────────────────────────────────────

  describe('minMaxLength rule', () => {
    it('generates a range check for rule "min max length"', () => {
      const output = generateValidate({ type: 'Validate', field: 'username', rule: 'min max length', value: { min: 3, max: 20 } });
      expect(output).toContain('username.length < 3');
      expect(output).toContain('username.length > 20');
    });

    it('returns a 400 response when length is out of range', () => {
      const output = generateValidate({ type: 'Validate', field: 'username', rule: 'min max length', value: { min: 3, max: 20 } });
      expect(output).toContain("res.status(400).json({ error: 'Username must be between 3 and 20 characters' })");
    });

    it('matches snapshot', () => {
      const output = generateValidate({ type: 'Validate', field: 'username', rule: 'min max length', value: { min: 3, max: 20 } });
      expect(output).toMatchSnapshot();
    });
  });

  // ── url rule ─────────────────────────────────────────────────────────────────

  describe('url rule', () => {
    it('generates a URL constructor check for rule "is url"', () => {
      const output = generateValidate({ type: 'Validate', field: 'website', rule: 'is url' });
      expect(output).toContain('new URL(website)');
    });

    it('returns a 400 response for invalid URLs', () => {
      const output = generateValidate({ type: 'Validate', field: 'website', rule: 'is url' });
      expect(output).toContain("res.status(400).json({ error: 'Website must be a valid URL' })");
    });

    it('also accepts rule "url" (shorthand)', () => {
      const output = generateValidate({ type: 'Validate', field: 'website', rule: 'url' });
      expect(output).toContain('new URL(website)');
    });

    it('matches snapshot', () => {
      const output = generateValidate({ type: 'Validate', field: 'website', rule: 'is url' });
      expect(output).toMatchSnapshot();
    });
  });

  // ── oneOf rule ───────────────────────────────────────────────────────────────

  describe('oneOf rule', () => {
    it('generates an allowlist check for rule "is one of"', () => {
      const output = generateValidate({ type: 'Validate', field: 'role', rule: 'is one of', value: ['admin', 'user', 'guest'] });
      expect(output).toContain("['admin', 'user', 'guest'].includes(role)");
    });

    it('returns a 400 response when value is not in the list', () => {
      const output = generateValidate({ type: 'Validate', field: 'role', rule: 'is one of', value: ['admin', 'user'] });
      expect(output).toContain("res.status(400).json({ error: 'Role must be one of: admin, user' })");
    });

    it('also accepts rule "oneof" (shorthand)', () => {
      const output = generateValidate({ type: 'Validate', field: 'status', rule: 'oneof', value: ['active', 'inactive'] });
      expect(output).toContain("['active', 'inactive'].includes(status)");
    });

    it('matches snapshot', () => {
      const output = generateValidate({ type: 'Validate', field: 'role', rule: 'is one of', value: ['admin', 'user', 'guest'] });
      expect(output).toMatchSnapshot();
    });
  });

  // ── unknown rule ─────────────────────────────────────────────────────────────

  describe('unknown rule', () => {
    it('throws a TrinaryError for an unrecognised rule', () => {
      expect(() =>
        generateValidate({ type: 'Validate', field: 'name', rule: 'nonexistentRule' }),
      ).toThrow(TrinaryError);
    });
  });
});
