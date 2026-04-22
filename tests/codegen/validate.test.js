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

  // ── unknown rule ─────────────────────────────────────────────────────────────

  describe('unknown rule', () => {
    it('throws a TrinaryError for an unrecognised rule', () => {
      expect(() =>
        generateValidate({ type: 'Validate', field: 'name', rule: 'nonexistentRule' }),
      ).toThrow(TrinaryError);
    });
  });
});
