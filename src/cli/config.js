// src/cli/config.js
// Reads trionary.config.js from the project root (process.cwd()) and loads
// any declared plugins by calling their register(api) hook.
//
// Expected shape of trionary.config.js:
//
//   import stripePlugin from './plugins/stripe-webhook.js';
//   export default {
//     plugins: [stripePlugin],
//   };

import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { pluginAPI, applyKeywords } from '../plugin/index.js';
import { KEYWORDS } from '../lexer/keywords.js';

/**
 * Load trionary.config.js from the given root directory (defaults to cwd).
 * For each plugin listed in config.plugins, calls plugin.register(pluginAPI).
 * After all plugins have been registered, re-applies keywords to the live KEYWORDS set.
 *
 * @param {string} [root] - Directory to search for trionary.config.js (defaults to process.cwd()).
 * @returns {Promise<boolean>} True if a config file was found and loaded, false otherwise.
 */
export async function loadConfig(root = process.cwd()) {
  const configPath = resolve(root, 'trionary.config.js');

  if (!existsSync(configPath)) {
    return false;
  }

  const configUrl = pathToFileURL(configPath).href;
  let config;
  try {
    const mod = await import(configUrl);
    config = mod.default ?? mod;
  } catch (err) {
    throw new Error(`Failed to load trionary.config.js: ${err.message}`);
  }

  if (!config || !Array.isArray(config.plugins)) {
    // Config file exists but has no plugins array — that's fine, nothing to load.
    return true;
  }

  for (const plugin of config.plugins) {
    if (typeof plugin.register !== 'function') {
      throw new TypeError(
        `trionary.config.js: each plugin must export a register(api) function. Got: ${JSON.stringify(plugin)}`,
      );
    }
    plugin.register(pluginAPI);
  }

  // Re-apply all newly registered keywords to the live lexer KEYWORDS set.
  applyKeywords(KEYWORDS);

  return true;
}
