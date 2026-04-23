# vscode-trionary

VS Code syntax highlighting extension for the [Trionary](https://github.com/api-bridges/spml) language (`.tri` files).

## Features

- **Keyword highlighting** — all Trionary reserved words (`route`, `auth`, `validate`, `find`, `create`, `update`, `delete`, `return`, `populate`, `middleware`, `take`, `require`, `paginate`, …) are highlighted as control keywords.
- **HTTP verb highlighting** — `GET`, `POST`, `PUT`, `PATCH`, and `DELETE` stand out as operator tokens.
- **Type keyword highlighting** — scalar types `String`, `Number`, `Boolean`, and `Date` are highlighted as type tokens.
- **Route path highlighting** — URL paths like `/users/:id` are highlighted as strings.
- **String, number, and boolean literals** — correctly coloured throughout.
- **Comment highlighting** — lines starting with `#` are dimmed as comments.
- **Inline JS escape hatch** — `js: <expression>` is highlighted with embedded JavaScript colouring.
- **Bracket matching and comment toggling** — via the included `language-configuration.json`.
- **Autocomplete** — contextual keyword suggestions as you type (provided by the Trionary LSP server).
- **Inline diagnostics** — real-time error highlighting powered by the Trionary lexer and parser; errors appear as you type without running a build.
- **Hover documentation** — hover over any keyword to see a one-line description and usage example.

## Installation

### From the VS Code Marketplace

Search for **Trionary** in the Extensions panel (`Ctrl+Shift+X`) and click **Install**.

### From a `.vsix` file

```bash
cd packages/vscode-trionary
npm install
npm run vsce:package          # produces vscode-trionary-0.1.0.vsix
code --install-extension vscode-trionary-0.1.0.vsix
```

## Usage

Open any file with the `.tri` extension — VS Code will automatically apply Trionary syntax highlighting and start the Language Server.

### Sample `.tri` file

```tri
# Blog API
server port 3000
database connect "mongodb://localhost/blog"

route GET /posts
  find all posts
  return posts

route POST /posts
  auth required
  take title, body
  require title, body
  validate title min length 3
  create post
  return post

route GET /posts/:id
  find post by id
  populate post.author
  return post
```

## LSP Features

The extension launches the Trionary Language Server (`packages/trionary-lsp/server.js`) as a background process. This server provides:

### Autocomplete

Press `Space` or start typing a keyword to receive context-aware suggestions:

- At the top level: `server`, `database`, `route`, `middleware`
- After `route`: HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
- Inside a route body: `auth`, `take`, `require`, `validate`, `find`, `create`, `update`, `delete`, `return`, `exists`, `if`, `hash`, `paginate`, `populate`
- After `auth`: `required`
- After `validate … is`: `email`, `number`, `url`, `one`
- After `return`: `ok`, `error`, `token`, `current`

### Inline Diagnostics

Every time you edit a `.tri` file the Language Server runs the Trionary lexer and parser in the background and reports any syntax errors as red squiggles directly in the editor — no need to run `trionary build`.

### Hover Documentation

Hover over any keyword to see a Markdown tooltip with:
- A one-line description of the keyword
- A short usage example

## Building the extension

```bash
npm install
npm run vsce:package
```

This produces a `.vsix` file that can be installed directly into VS Code.

## License

ISC
