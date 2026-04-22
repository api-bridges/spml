// lexer.js
// Converts raw Trionary source text into a flat list of typed tokens.
// Each token has the shape: { type, value, line, col }
// Emits INDENT/DEDENT tokens when indentation level changes.
// Strips #-prefixed comment lines and empty lines.
// Normalises mixed spaces/tabs to 2-space units with a warning.

import { readFile } from 'fs/promises';
import { TOKEN_TYPES } from './tokens.js';
import { KEYWORDS } from './keywords.js';
import { TOKEN_PATTERNS } from './patterns.js';

/**
 * Tokenise a Trionary source string.
 *
 * @param {string} source - Raw source text.
 * @returns {{ type: string, value: string, line: number, col: number }[]}
 */
export function tokenize(source) {
  const tokens = [];
  const lines = source.split('\n');
  const indentStack = [0]; // stack of indent levels (in 2-space units)

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const lineNumber = lineIndex + 1;
    let rawLine = lines[lineIndex];

    // Strip trailing whitespace
    rawLine = rawLine.trimEnd();

    // Skip empty lines
    if (rawLine.trim() === '') continue;

    // Strip #-prefixed comment lines (the whole line is a comment)
    if (rawLine.trimStart().startsWith('#')) continue;

    // ── Indentation handling ──────────────────────────────────────────────

    // Count leading whitespace characters
    let leadingWhitespace = '';
    for (let i = 0; i < rawLine.length; i++) {
      if (rawLine[i] === ' ' || rawLine[i] === '\t') {
        leadingWhitespace += rawLine[i];
      } else {
        break;
      }
    }

    // Normalise to 2-space units; warn on mixed tabs/spaces
    let indentLevel;
    if (leadingWhitespace.includes('\t') && leadingWhitespace.includes(' ')) {
      process.stderr.write(
        `[lexer] warning: line ${lineNumber} mixes tabs and spaces — normalising to 2-space units\n`,
      );
      // Replace each tab with 2 spaces then count
      const normalised = leadingWhitespace.replace(/\t/g, '  ');
      indentLevel = Math.floor(normalised.length / 2);
    } else if (leadingWhitespace.includes('\t')) {
      // Each tab counts as one 2-space unit
      indentLevel = leadingWhitespace.length;
    } else {
      indentLevel = Math.floor(leadingWhitespace.length / 2);
    }

    const currentIndent = indentStack[indentStack.length - 1];

    if (indentLevel > currentIndent) {
      indentStack.push(indentLevel);
      tokens.push({ type: TOKEN_TYPES.INDENT, value: '', line: lineNumber, col: 1 });
    } else {
      while (indentLevel < indentStack[indentStack.length - 1]) {
        indentStack.pop();
        tokens.push({ type: TOKEN_TYPES.DEDENT, value: '', line: lineNumber, col: 1 });
      }
    }

    // ── Token scanning ────────────────────────────────────────────────────

    let remaining = rawLine.trimStart();
    let col = leadingWhitespace.length + 1;

    while (remaining.length > 0) {
      // Skip inline whitespace
      const wsMatch = remaining.match(/^[ \t]+/);
      if (wsMatch) {
        col += wsMatch[0].length;
        remaining = remaining.slice(wsMatch[0].length);
        continue;
      }

      // Inline comment: skip rest of line
      if (remaining.startsWith('#')) break;

      let matched = false;

      for (const [type, pattern] of TOKEN_PATTERNS) {
        // Skip NEWLINE pattern here — we handle newlines between lines above
        if (type === TOKEN_TYPES.NEWLINE) continue;

        const match = remaining.match(pattern);
        if (match) {
          const raw = match[0];
          let value = raw;
          let tokenType = type;

          if (type === TOKEN_TYPES.STRING) {
            // Strip surrounding double quotes to expose the inner value
            value = raw.slice(1, -1);
          } else if (type === TOKEN_TYPES.IDENTIFIER) {
            // Reclassify as KEYWORD when the text is a reserved word
            if (KEYWORDS.has(raw)) {
              tokenType = TOKEN_TYPES.KEYWORD;
            }
          } else if (type === TOKEN_TYPES.COMMENT) {
            // Inline comment matched — skip the rest of the line
            break;
          }

          tokens.push({ type: tokenType, value, line: lineNumber, col });
          col += raw.length;
          remaining = remaining.slice(raw.length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Warn about unrecognised characters and advance to avoid an infinite loop
        process.stderr.write(
          `[lexer] warning: line ${lineNumber}, col ${col}: unexpected character '${remaining[0]}' — skipped\n`,
        );
        col += 1;
        remaining = remaining.slice(1);
      }
    }

    // Emit a NEWLINE at the column immediately after the last character on the line
    tokens.push({ type: TOKEN_TYPES.NEWLINE, value: '\n', line: lineNumber, col });
  }

  // Close any open indentation blocks at end-of-file
  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ type: TOKEN_TYPES.DEDENT, value: '', line: lines.length, col: 1 });
  }

  tokens.push({ type: TOKEN_TYPES.EOF, value: '', line: lines.length, col: 1 });

  return tokens;
}

/**
 * Read a `.tri` file from disk and tokenise its contents.
 *
 * @param {string} filePath - Absolute or relative path to a `.tri` file.
 * @returns {Promise<{ type: string, value: string, line: number, col: number }[]>}
 */
export async function tokenizeFile(filePath) {
  const source = await readFile(filePath, 'utf8');
  return tokenize(source);
}
