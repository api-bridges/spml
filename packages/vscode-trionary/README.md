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

Open any file with the `.tri` extension — VS Code will automatically apply Trionary syntax highlighting.

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

## Building the extension

```bash
npm install
npm run vsce:package
```

This produces a `.vsix` file that can be installed directly into VS Code.

## Roadmap

- **Step 29** — Language Server Protocol integration: autocomplete, inline diagnostics, and hover documentation.

## License

ISC
