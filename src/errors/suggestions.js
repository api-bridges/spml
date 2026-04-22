// suggestions.js
// Provides keyword suggestion using the Levenshtein edit-distance algorithm.
// When the parser encounters an unknown identifier it can call suggest() to
// find the nearest Trionary keyword and surface it in the error message.

import { KEYWORDS } from '../lexer/keywords.js';

/**
 * Compute the Levenshtein edit distance between two strings.
 * Uses an iterative two-row DP approach for minimal memory overhead.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} The minimum number of single-character edits required.
 */
export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,          // deletion
        prev[j - 1] + cost    // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Find the Trionary keyword closest to the given token value.
 * Returns null when the closest keyword is further than maxDistance edits away
 * (avoids suggesting something completely unrelated).
 *
 * @param {string} token       - The unrecognised identifier from the source.
 * @param {number} [maxDistance=3] - Maximum edit distance to consider a match.
 * @returns {string|null} The best-matching keyword, or null if none is close enough.
 */
export function suggest(token, maxDistance = 3) {
  let best = null;
  let bestDist = maxDistance + 1;

  for (const keyword of KEYWORDS) {
    const dist = levenshtein(token.toLowerCase(), keyword.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = keyword;
    }
  }

  return bestDist <= maxDistance ? best : null;
}
