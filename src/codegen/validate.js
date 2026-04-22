// validate.js
// Generates inline validation code for the `validate` keyword in Trionary.
// Each rule maps to a runtime guard that returns a 400 response on failure.
// New rules can be added to the VALIDATORS dispatch map without touching
// existing logic.

/**
 * Escape single quotes so the string is safe inside a single-quoted JS string
 * literal in generated code.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeQuotes(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Capitalise the first letter of a string.
 *
 * @param {string} str
 * @returns {string}
 */
function capitalise(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * VALIDATORS dispatch map.
 * Each key is a rule name (string) and each value is a function that receives
 * the ValidateNode and returns a string of generated Node.js code.
 *
 * Add new rules here to extend the validator without modifying existing entries.
 */
const VALIDATORS = {
  /**
   * `validate <field> is email`
   * Emits a regex check that rejects non-email values with a 400 response.
   */
  email: (node) => {
    const field = node.field;
    return [
      `const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;`,
      `if (!emailRegex.test(${field})) return res.status(400).json({ error: 'Invalid email address' });`,
    ].join('\n');
  },

  /**
   * `validate <field> min length <n>`
   * Emits a length check that rejects strings shorter than `n` with a 400 response.
   */
  minLength: (node) => {
    const field = node.field;
    const n = node.value;
    const label = escapeQuotes(capitalise(field));
    return `if (${field}.length < ${n}) return res.status(400).json({ error: '${label} must be at least ${n} characters' });`;
  },
};

/**
 * Normalise the raw `rule` string from a ValidateNode into the key used in the
 * VALIDATORS map.
 *
 * @param {string} rule - e.g. 'is email', 'min length', 'email', 'minLength'
 * @returns {string} - VALIDATORS key
 */
function resolveRuleKey(rule) {
  if (!rule) return '';
  const normalised = String(rule).trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalised === 'is email' || normalised === 'email') return 'email';
  if (normalised === 'min length' || normalised === 'minlength') return 'minLength';
  // Convert kebab/space separated to camelCase for future rules
  return normalised.replace(/[\s-](.)/g, (_, c) => c.toUpperCase());
}

/**
 * Generate validation code for a ValidateNode.
 *
 * Supported rules (via the VALIDATORS map):
 *   - `validate <field> is email`       → email format check
 *   - `validate <field> min length <n>` → minimum length check
 *
 * @param {{ type: 'Validate', field: string, rule: string, value: any }} node
 * @returns {string} Generated Node.js source code.
 * @throws {Error} When the rule is not recognised.
 */
export function generateValidate(node) {
  const key = resolveRuleKey(node.rule);
  const handler = VALIDATORS[key];

  if (!handler) {
    throw new Error(
      `[Trionary] Unknown validation rule: "${node.rule}". ` +
        `Supported rules: ${Object.keys(VALIDATORS).join(', ')}.`
    );
  }

  return handler(node);
}
