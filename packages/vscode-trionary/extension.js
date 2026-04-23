// extension.js
// VS Code extension entry point for Trionary language support.
// Syntax highlighting is provided declaratively via the TextMate grammar
// registered in package.json contributes.grammars; no runtime activation
// logic is required for pure syntax highlighting extensions.

'use strict';

/**
 * Called by VS Code when the extension is activated.
 * @param {import('vscode').ExtensionContext} _context
 */
function activate(_context) {
  // Syntax highlighting is grammar-based and requires no runtime activation.
  // Future LSP integration (Step 29) will register commands and providers here.
}

/**
 * Called by VS Code when the extension is deactivated.
 */
function deactivate() {}

module.exports = { activate, deactivate };
