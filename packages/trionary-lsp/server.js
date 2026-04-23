// server.js
// Trionary Language Server — provides autocomplete, diagnostics, and hover
// to editors that support LSP (e.g. VS Code via the vscode-trionary extension).
// Launched as a child process by the VS Code extension (vscode-trionary).

'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  CompletionItemKind,
  DiagnosticSeverity,
  TextDocumentSyncKind,
  MarkupKind,
} = require('vscode-languageserver/node');
const { TextDocument } = require('vscode-languageserver-textdocument');

// ── Keyword descriptions for hover ────────────────────────────────────────────

const KEYWORD_DOCS = {
  server: 'Declare the HTTP server and its port. Example: `server port 3000`',
  port: 'Specify the port number (used with `server`). Example: `server port 8080`',
  database: 'Declare the database connection. Example: `database connect "mongodb://localhost/mydb"`',
  connect: 'Provide the connection URI. Example: `database connect "mongodb://localhost/mydb"`',
  route: 'Declare an HTTP route. Example: `route GET /users`',
  GET: 'HTTP GET method for a route. Example: `route GET /posts`',
  POST: 'HTTP POST method for a route. Example: `route POST /register`',
  PUT: 'HTTP PUT method for a route (full document replacement). Example: `route PUT /posts/:id`',
  PATCH: 'HTTP PATCH method for a route (selective field update). Example: `route PATCH /posts/:id`',
  DELETE: 'HTTP DELETE method for a route. Example: `route DELETE /posts/:id`',
  take: 'Extract fields from the request body. Example: `take name, email, password`',
  require: 'Assert that fields are present; returns 400 if missing. Example: `require title, body`',
  validate: 'Apply a format or length rule to a field. Example: `validate email is email`',
  is: 'Link a field to its validation rule. Example: `validate email is email`',
  email: 'Validate that a field is a valid email address. Example: `validate email is email`',
  number: 'Validate that a field is a numeric value. Example: `validate age is number`',
  url: 'Validate that a field is a valid URL. Example: `validate website is url`',
  one: 'Part of the `is one of` allowlist rule. Example: `validate role is one of "admin", "user"`',
  of: 'Part of the `is one of` allowlist rule. Example: `validate role is one of "admin", "user"`',
  min: 'Set a minimum length threshold. Example: `validate password min length 8`',
  max: 'Set a maximum length threshold. Example: `validate username min length 3 max length 20`',
  length: 'Refer to the string length (used with `min` / `max`). Example: `validate password min length 8`',
  limit: 'Set a page size (used with `paginate`). Example: `paginate post limit 10`',
  exists: 'Query whether a record exists. Example: `exists user where email`',
  find: 'Fetch one or many records from the database. Example: `find post by id`',
  create: 'Insert a new record into the database. Example: `create user with name, email, password`',
  update: 'Update an existing record. Example: `update post with title, body`',
  delete: 'Remove a record from the database. Example: `delete post by id`',
  paginate: 'Fetch a page of records. Example: `paginate post limit 10`',
  with: 'Specify the fields to write (used with `create` / `update`). Example: `create post with title, body`',
  where: 'Filter by a field value. Example: `find user where email`',
  by: 'Filter or sort by a specific field. Example: `find post by id`',
  all: 'Retrieve every record without filtering. Example: `find all posts`',
  sorted: 'Apply a sort (used with `find all`). Example: `find all posts sorted by date`',
  for: 'Associate a record with the current user. Example: `create post for user`',
  check: 'Perform an inline assertion. Example: `check email`',
  return: 'Send a response to the client. Example: `return post`',
  error: 'Return an error message (used with `return`). Example: `return error "Not found" status 404`',
  status: 'Set the HTTP status code (used with `return error`). Example: `return error "Not found" status 404`',
  ok: 'Return a generic success response. Example: `return ok`',
  if: 'Conditionally execute a statement. Example: `if not found return error "Not found" status 404`',
  not: 'Negate a condition (used with `if`). Example: `if not found return error "Not found" status 404`',
  found: 'Refers to whether the previous `find` succeeded. Example: `if not found return error "Not found" status 404`',
  auth: 'Mark a route as requiring JWT authentication. Example: `auth required`',
  required: 'Mark authentication as required for this route. Example: `auth required`',
  hash: 'Bcrypt-hash a password field. Example: `hash password`',
  password: 'Refers to the password field (used with `hash` / `validate`). Example: `hash password`',
  token: 'Return a signed JWT to the client. Example: `return token`',
  matches: 'Verify a plain password against its bcrypt hash. Example: `validate password matches`',
  current: 'Refer to the authenticated user (used with `user`). Example: `return current user`',
  user: 'The authenticated user object. Example: `return current user`',
  middleware: 'Register a middleware for all routes. Example: `middleware cors`',
  cors: 'Enable CORS via the `cors` package. Example: `middleware cors`',
  logs: 'Enable request logging via `morgan`. Example: `middleware logs`',
  helmet: 'Add security headers via `helmet`. Example: `middleware helmet`',
  ratelimit: 'Limit requests per time window. Example: `middleware ratelimit max 200 per minute`',
  compress: 'Enable gzip compression. Example: `middleware compress`',
  per: 'Link count to time unit (used with `ratelimit`). Example: `middleware ratelimit max 100 per minute`',
  minute: 'Time unit for rate limiting. Example: `middleware ratelimit max 100 per minute`',
  populate: 'Dereference a Mongoose ObjectId and return the full sub-document. Example: `populate post.author`',
  ref: 'Declare an ObjectId reference field. Example: `author: User ref`',
  env: 'Reference an environment variable. Example: `server port env PORT`',
  type: 'Specify the database type. Example: `database type postgres`',
  mongodb: 'Use MongoDB/Mongoose as the database backend. Example: `database type mongodb`',
  postgres: 'Use PostgreSQL/Prisma as the database backend. Example: `database type postgres`',
  String: 'Scalar field type: string value. Example: `title: String`',
  Number: 'Scalar field type: numeric value. Example: `price: Number`',
  Boolean: 'Scalar field type: true/false value. Example: `published: Boolean`',
  Date: 'Scalar field type: date/time value. Example: `createdAt: Date`',
};

// ── Contextual completion tables ───────────────────────────────────────────────

// Keywords valid at the top level (outside a route body)
const TOP_LEVEL_KEYWORDS = ['server', 'database', 'route', 'middleware'];

// HTTP method keywords suggested after `route`
const HTTP_VERBS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// Keywords valid inside a route body
const BODY_KEYWORDS = [
  'auth', 'take', 'require', 'validate', 'find', 'create', 'update',
  'delete', 'return', 'exists', 'if', 'hash', 'paginate', 'populate',
];

// ── Helper: determine context from document text and cursor position ───────────

/**
 * Parse the document text up to the cursor position to determine:
 * - whether the cursor is at the top level or inside a route body
 * - the word immediately before the cursor (for contextual suggestions)
 *
 * @param {string} text       Full document text.
 * @param {{ line: number, character: number }} position  Zero-based cursor position.
 * @returns {{ context: 'top-level' | 'route-body', prevWord: string }}
 */
function getCompletionContext(text, position) {
  const lines = text.split('\n');
  const cursorLine = lines[position.line] || '';
  const textBeforeCursor = cursorLine.slice(0, position.character);

  // Determine previous word on the current line
  const prevWordMatch = textBeforeCursor.trimEnd().match(/(\w+)\s*$/);
  const prevWord = prevWordMatch ? prevWordMatch[1] : '';

  // We are inside a route body when any preceding line (with lower or equal
  // indentation) starts with `route` and no subsequent top-level line has
  // appeared after it.
  let insideRoute = false;
  for (let i = 0; i < position.line; i++) {
    const trimmed = lines[i].trimStart();
    const indent = lines[i].length - trimmed.length;
    if (indent === 0 && trimmed.startsWith('route ')) {
      insideRoute = true;
    } else if (indent === 0 && trimmed.length > 0 && !trimmed.startsWith('#')) {
      // Another top-level declaration after the route resets context
      const firstWord = trimmed.split(/\s/)[0];
      if (TOP_LEVEL_KEYWORDS.includes(firstWord) && firstWord !== 'route') {
        insideRoute = false;
      }
    }
  }

  // The current line itself: if indented it is a route body line
  const currentIndent = cursorLine.length - cursorLine.trimStart().length;
  const context = insideRoute && currentIndent > 0 ? 'route-body' : 'top-level';

  return { context, prevWord };
}

/**
 * Build the list of completion items for the given context.
 *
 * @param {string} text
 * @param {{ line: number, character: number }} position
 * @returns {import('vscode-languageserver').CompletionItem[]}
 */
function buildCompletionItems(text, position) {
  const { context, prevWord } = getCompletionContext(text, position);

  let candidates;

  if (prevWord === 'route') {
    candidates = HTTP_VERBS;
  } else if (prevWord === 'auth') {
    candidates = ['required'];
  } else if (prevWord === 'validate') {
    // suggest field-oriented follow-ups handled generically; show all body + validation keywords
    candidates = ['is', 'min', 'max', 'email', 'url', 'number', 'one'];
  } else if (prevWord === 'is') {
    candidates = ['email', 'number', 'url', 'one'];
  } else if (prevWord === 'database') {
    candidates = ['connect', 'type'];
  } else if (prevWord === 'server') {
    candidates = ['port'];
  } else if (prevWord === 'middleware') {
    candidates = ['cors', 'logs', 'helmet', 'ratelimit', 'compress'];
  } else if (prevWord === 'return') {
    candidates = ['ok', 'error', 'token', 'current'];
  } else if (prevWord === 'find') {
    candidates = ['all', 'by', 'where'];
  } else if (context === 'route-body') {
    candidates = BODY_KEYWORDS;
  } else {
    candidates = TOP_LEVEL_KEYWORDS;
  }

  return candidates.map((kw) => ({
    label: kw,
    kind: HTTP_VERBS.includes(kw) ? CompletionItemKind.Operator : CompletionItemKind.Keyword,
    detail: 'Trionary keyword',
    documentation: {
      kind: MarkupKind.Markdown,
      value: KEYWORD_DOCS[kw] || kw,
    },
  }));
}

/**
 * Get hover information for a keyword at the given position.
 *
 * @param {string} text
 * @param {{ line: number, character: number }} position
 * @returns {import('vscode-languageserver').Hover | null}
 */
function buildHoverInfo(text, position) {
  const lines = text.split('\n');
  const line = lines[position.line] || '';

  // Find the word at the cursor position
  let start = position.character;
  let end = position.character;

  while (start > 0 && /\w/.test(line[start - 1])) start--;
  while (end < line.length && /\w/.test(line[end])) end++;

  const word = line.slice(start, end);
  if (!word || !KEYWORD_DOCS[word]) return null;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `**\`${word}\`** — Trionary keyword\n\n${KEYWORD_DOCS[word]}`,
    },
  };
}

/**
 * Run the Trionary lexer and parser on document text and return LSP Diagnostics.
 * Returns an empty array when the document is valid.
 *
 * @param {string} text
 * @param {Function} tokenize  - The tokenize() export from the Trionary lexer.
 * @param {Function} parse     - The parse() export from the Trionary parser.
 * @returns {import('vscode-languageserver').Diagnostic[]}
 */
function buildDiagnostics(text, tokenize, parse) {
  try {
    const tokens = tokenize(text);
    parse(tokens);
    return [];
  } catch (err) {
    // TrinaryError positions are 1-based; LSP positions are 0-based.
    // When location is unavailable fall back to the top of the document (0, 0).
    const line = err.line != null ? err.line - 1 : 0;
    const col = err.col != null ? err.col - 1 : 0;
    return [
      {
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line, character: col },
          end: { line, character: col + 1 },
        },
        message: err.message || String(err),
        source: 'trionary',
      },
    ];
  }
}

// ── LSP connection setup ───────────────────────────────────────────────────────

/**
 * Start the LSP server using the given connection.
 * Exported so tests can supply a mock connection.
 *
 * @param {import('vscode-languageserver').Connection} connection
 * @param {TextDocuments<TextDocument>} documents
 * @param {{ tokenize: Function, parse: Function }} compiler  - Trionary lexer/parser.
 */
function startServer(connection, documents, compiler) {
  connection.onInitialize(() => ({
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        triggerCharacters: [' ', '\n'],
      },
      hoverProvider: true,
    },
  }));

  // Revalidate on every content change
  documents.onDidChangeContent((change) => {
    const text = change.document.getText();
    const diagnostics = buildDiagnostics(text, compiler.tokenize, compiler.parse);
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
  });

  // Completion handler
  connection.onCompletion((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];
    return buildCompletionItems(doc.getText(), params.position);
  });

  // Hover handler
  connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return null;
    return buildHoverInfo(doc.getText(), params.position);
  });

  documents.listen(connection);
  connection.listen();
}

// ── Exports (used by tests and VS Code extension wiring) ──────────────────────

module.exports = {
  KEYWORD_DOCS,
  buildCompletionItems,
  buildHoverInfo,
  buildDiagnostics,
  startServer,
};

// ── Entry point (run when invoked directly as a process) ──────────────────────

if (require.main === module) {
  // Dynamically import the ES-module Trionary compiler from the repo root.
  // The path is resolved relative to this file so the server works regardless
  // of the working directory it is launched from.
  const repoRoot = path.resolve(__dirname, '..', '..');
  const lexerUrl = pathToFileURL(path.join(repoRoot, 'src', 'lexer', 'lexer.js')).href;
  const parserUrl = pathToFileURL(path.join(repoRoot, 'src', 'parser', 'parser.js')).href;

  Promise.all([import(lexerUrl), import(parserUrl)]).then(([lexerMod, parserMod]) => {
    const connection = createConnection(ProposedFeatures.all);
    const documents = new TextDocuments(TextDocument);
    startServer(connection, documents, {
      tokenize: lexerMod.tokenize,
      parse: parserMod.parse,
    });
  });
}
