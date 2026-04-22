// TrinaryError.js
// Custom error class for the Trionary compiler.
// Wraps raw parser/codegen errors into human-readable, plain-English messages
// with line numbers, source labels, and optional keyword hints.

/**
 * TrinaryError — structured compiler error for the Trionary language.
 *
 * @property {string}      message  - Plain-English description of the problem.
 * @property {number|null} line     - Source line where the error occurred.
 * @property {number|null} col      - Source column where the error occurred.
 * @property {string}      source   - Stage that produced the error: 'lexer' | 'parser' | 'codegen'.
 * @property {string|null} hint     - Optional hint to help the developer fix the error.
 */
export class TrinaryError extends Error {
  /**
   * @param {string}      message
   * @param {object}      [options={}]
   * @param {number|null} [options.line=null]
   * @param {number|null} [options.col=null]
   * @param {string}      [options.source='parser']
   * @param {string|null} [options.hint=null]
   */
  constructor(message, { line = null, col = null, source = 'parser', hint = null } = {}) {
    super(message);
    this.name = 'TrinaryError';
    this.line = line;
    this.col = col;
    this.source = source;
    this.hint = hint;
  }

  /**
   * Format the error as a multi-line, human-readable block suitable for stderr.
   *
   * Example output:
   *   [Trionary Error — line 12, col 5]
   *   Parser: Unexpected token "retun". Did you mean "return"?
   *   Hint: All return statements must start with the keyword "return".
   *
   * @returns {string}
   */
  toString() {
    const location =
      this.line != null
        ? `line ${this.line}${this.col != null ? `, col ${this.col}` : ''}`
        : 'unknown location';

    const sourceLabel =
      this.source.charAt(0).toUpperCase() + this.source.slice(1);

    let output = `[Trionary Error — ${location}]\n${sourceLabel}: ${this.message}`;
    if (this.hint) {
      output += `\nHint: ${this.hint}`;
    }
    return output;
  }
}
