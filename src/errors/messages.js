// messages.js
// Lookup map from error codes to plain-English message templates.
// Placeholders use {fieldName} syntax and are replaced at throw-time by
// TrinaryError consumers using the interpolate() helper exported below.

/**
 * Map of error code → message template string.
 * Placeholders are wrapped in curly braces: {token}, {expected}, {rule}, etc.
 */
export const MESSAGES = {
  // ── Lexer ─────────────────────────────────────────────────────────────────
  UNEXPECTED_CHARACTER: 'Unexpected character "{char}".',
  UNTERMINATED_STRING: 'Unterminated string literal.',

  // ── Parser ────────────────────────────────────────────────────────────────
  UNEXPECTED_TOKEN: 'Unexpected token "{token}". Did you mean "{suggestion}"?',
  UNEXPECTED_TOKEN_NO_HINT: 'Unexpected token "{token}".',
  EXPECTED_TOKEN: 'Expected {expected} but got "{got}".',
  EXPECTED_IDENTIFIER: 'Expected an identifier but got "{got}".',
  INVALID_NUMBER: 'Invalid number: "{value}".',
  UNEXPECTED_TOP_LEVEL: 'Unexpected top-level token "{token}". Valid top-level keywords are: server, database, middleware, route.',
  UNEXPECTED_STATEMENT: 'Unexpected statement token "{token}". Valid statement keywords are: auth, take, require, validate, find, create, update, delete, return, exists, if, hash, paginate.',

  // ── Codegen ───────────────────────────────────────────────────────────────
  UNKNOWN_MIDDLEWARE: 'Unknown middleware "{name}". Supported middleware: cors, logs, helmet, ratelimit, compress.',
  UNKNOWN_VALIDATION_RULE: 'Unknown validation rule "{rule}". Supported rules: {supported}.',
};

/**
 * Interpolate a message template with the provided values map.
 *
 * @param {string} template  - A string from MESSAGES with {placeholder} tokens.
 * @param {Record<string, string|number>} values - Replacement values keyed by placeholder name.
 * @returns {string} The interpolated message.
 *
 * @example
 * interpolate(MESSAGES.EXPECTED_TOKEN, { expected: 'KEYWORD(route)', got: 'NUMBER(3000)' });
 * // → 'Expected KEYWORD(route) but got "NUMBER(3000)".'
 */
export function interpolate(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : `{${key}}`
  );
}
