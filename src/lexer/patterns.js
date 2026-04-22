// patterns.js
// Maps each TOKEN_TYPE to the regular expression used to recognise it.
// Patterns are tested in the order they appear in TOKEN_PATTERNS so that
// higher-priority rules (e.g. COMMENT, STRING) are evaluated before more
// general ones (e.g. IDENTIFIER, NUMBER).

import { TOKEN_TYPES } from './tokens.js';

export const TOKEN_PATTERNS = new Map([
  // Single-line comment: # followed by anything until end of line
  [TOKEN_TYPES.COMMENT, /^#[^\n]*/],

  // Double-quoted string literal; captures the inner value without quotes
  [TOKEN_TYPES.STRING, /^"([^"\\]|\\.)*"/],

  // Integer or floating-point number
  [TOKEN_TYPES.NUMBER, /^\d+(\.\d+)?/],

  // Identifier or keyword: starts with a letter or underscore, followed by
  // word characters.  The lexer classifies the matched text as KEYWORD when
  // it appears in KEYWORDS, or IDENTIFIER otherwise.
  [TOKEN_TYPES.IDENTIFIER, /^[A-Za-z_]\w*/],

  // Operators and punctuation used in Trionary source
  [TOKEN_TYPES.OPERATOR, /^[,:.()[\]{}<>!=+\-*/&|^~%]/],

  // Newline
  [TOKEN_TYPES.NEWLINE, /^\n/],
]);
