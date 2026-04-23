// extension.js
// VS Code extension entry point for Trionary language support.
// Registers syntax highlighting (via the TextMate grammar in package.json)
// and launches the Trionary LSP server as a child process, connecting it
// to VS Code via the vscode-languageclient LanguageClient.

'use strict';

const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

/** @type {LanguageClient | undefined} */
let client;

/**
 * Called by VS Code when the extension is activated.
 * @param {import('vscode').ExtensionContext} context
 */
function activate(context) {
  // Path to the LSP server entry point inside the sibling package.
  const serverModule = context.asAbsolutePath(
    path.join('..', 'trionary-lsp', 'server.js'),
  );

  /** @type {import('vscode-languageclient/node').ServerOptions} */
  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  /** @type {import('vscode-languageclient/node').LanguageClientOptions} */
  const clientOptions = {
    // Only activate the LSP for .tri files
    documentSelector: [{ scheme: 'file', language: 'trionary' }],
  };

  client = new LanguageClient(
    'trionary',
    'Trionary Language Server',
    serverOptions,
    clientOptions,
  );

  client.start();
}

/**
 * Called by VS Code when the extension is deactivated.
 * @returns {Thenable<void> | undefined}
 */
function deactivate() {
  if (!client) return undefined;
  return client.stop();
}

module.exports = { activate, deactivate };
