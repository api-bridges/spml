// tokens.js
// Defines every token type the Trionary lexer can produce.
// TOKEN_TYPES is frozen so callers cannot accidentally mutate it.

export const TOKEN_TYPES = Object.freeze({
  KEYWORD: 'KEYWORD',
  IDENTIFIER: 'IDENTIFIER',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  OPERATOR: 'OPERATOR',
  INDENT: 'INDENT',
  DEDENT: 'DEDENT',
  NEWLINE: 'NEWLINE',
  EOF: 'EOF',
  COMMENT: 'COMMENT',
  TYPE_STRING: 'TYPE_STRING',
  TYPE_NUMBER: 'TYPE_NUMBER',
  TYPE_BOOLEAN: 'TYPE_BOOLEAN',
  TYPE_DATE: 'TYPE_DATE',
});
