# Trionary Backend — v1.0 Implementation Plan (Steps 21–40)

**Document**: Continuation of `PLAN.md` (Steps 1–20 complete, logged in `done.md`)  
**Goal**: Evolve Trionary from a working v0.1.0 prototype into a robust, production-grade v1.0 language with editor tooling, richer schema types, multi-database support, real-time capabilities, a testing DSL, and a plugin API.  
**Validation Status**: ✅ All features are architecturally sound and build on the existing lexer → parser → AST → codegen pipeline.

---

## How to Use This Document

Each step:
- Describes **what it does** (the task).
- Lists **what it expects** from the previous step (its dependency).
- Specifies **what it produces** (its output artifact).
- Ends with an instruction to **update `done.md`** with a single-sentence summary.

`done.md` lives at the repo root. Every step appends one line to it so the team can track progress at a glance.

---

## Step 21 — Explicit Field Type Declarations in Schema

### What this step does
Extend the Trionary grammar to allow model fields to carry explicit scalar types (`String`, `Number`, `Boolean`, `Date`). The lexer, parser, AST, and Mongoose model codegen are all updated so that typed fields produce correct Mongoose schema paths instead of defaulting everything to `String`.

### Expects from previous step
Step 20 complete — `trionary@0.1.0` published; Mongoose model codegen exists in `src/codegen/models.js`.

### Tasks
1. Add four new token types to `src/lexer/tokens.js`: `TYPE_STRING`, `TYPE_NUMBER`, `TYPE_BOOLEAN`, `TYPE_DATE`.
2. Add the keywords `String`, `Number`, `Boolean`, `Date` to the reserved keyword set in `src/lexer/keywords.js`.
3. Update the lexer regex table in `src/lexer/lexer.js` so these tokens are matched after the colon separator in a field declaration (`title: String`).
4. Extend the `FieldNode` AST factory in `src/parser/ast.js` with an optional `fieldType` property (default `'String'`).
5. Update the parser in `src/parser/parser.js` to consume the optional `: <TypeKeyword>` suffix when parsing field lists inside `create`, `update`, and `model` declarations.
6. Update `src/codegen/models.js` to emit the correct Mongoose type (`String`, `Number`, `Boolean`, `Date`) in the schema object, reading it from `FieldNode.fieldType`.
7. Update snapshot tests in `tests/codegen/models.test.js` with new fixtures covering each scalar type.
8. Add three new fixtures to `examples/` that exercise typed fields (e.g. a product with price as Number, published as Boolean, createdAt as Date).

### Produces
- Updated lexer, parser, AST, and models codegen supporting typed field declarations.
- Passing tests with updated snapshots.

### Update done.md
Append:
```
- Step 21 ✅ Explicit field type declarations (String, Number, Boolean, Date) supported; Mongoose schemas now emit correct types.
```

---

## Step 22 — Mongoose Relationship & Population Support

### What this step does
Add a `populate` keyword so a Trionary route can dereference a Mongoose `ObjectId` reference and return the full sub-document. The schema codegen is updated to emit `ref:` fields, and the CRUD codegen emits `.populate()` calls in the correct position in the query chain.

### Expects from previous step
Step 21 complete — typed fields supported; `FieldNode` has a `fieldType` property.

### Tasks
1. Add token `POPULATE` and keyword `populate` to the lexer.
2. Add `PopulateNode` factory to `src/parser/ast.js` with properties `model` and `field`.
3. Update the parser to recognise `populate <model>.<field>` as a statement inside a route body, emitting a `PopulateNode`.
4. Extend `FieldNode` with an optional `ref` property; update parser to consume `ref: <ModelName>` after a field type token.
5. Update `src/codegen/models.js` so a field with `ref` emits `{ type: mongoose.Schema.Types.ObjectId, ref: '<ModelName>' }`.
6. Update `src/codegen/crud.js` so a `PopulateNode` immediately following a `FindNode` appends `.populate('<field>')` to the Mongoose query.
7. Write tests in `tests/codegen/crud.test.js` covering a `find → populate → return` sequence.
8. Add an example `examples/blog-with-authors.tri` that demonstrates `populate post.author`.

### Produces
- `populate` keyword end-to-end: lexer token → AST node → emitted `.populate()` call.
- `ref:` field modifier for schema `ObjectId` references.

### Update done.md
Append:
```
- Step 22 ✅ populate keyword and ObjectId ref fields implemented; Mongoose query chains emit .populate() calls correctly.
```

---

## Step 23 — Partial Update (PATCH) Support

### What this step does
Change the `update` codegen so that only request-body fields that are actually present are written to the database, enabling true PATCH semantics. A new `patchUpdate` code path is generated alongside the existing full-replace `update`.

### Expects from previous step
Step 22 complete — populate support merged.

### Tasks
1. Add token `PATCH` and keyword `patch` to the lexer (distinct from the HTTP verb, which is already a string in the route declaration).
2. Extend the parser: when a route is declared with `PATCH` as the HTTP method, flag the `RouteNode` with `method: 'PATCH'`.
3. Update `src/codegen/crud.js` to detect `method === 'PATCH'` on the enclosing route and emit `$set` spread logic:
   ```js
   const updates = {};
   if (req.body.title !== undefined) updates.title = req.body.title;
   // …for each field in the take list
   await Post.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
   ```
4. Keep the existing full-replace path for `PUT` routes unchanged.
5. Update snapshot tests in `tests/codegen/crud.test.js` for PATCH routes.
6. Document the behaviour difference between `PUT` and `PATCH` route codegen in `docs/KEYWORDS.md`.

### Produces
- PATCH route body emits selective `$set` update instead of full document replacement.

### Update done.md
Append:
```
- Step 23 ✅ Partial update (PATCH) semantics implemented; update codegen emits $set spread for PATCH routes.
```

---

## Step 24 — Extended Validation Rules

### What this step does
Expand the `validate` keyword beyond the v0.1 `is email` and `min length` rules. Four new rules are added: `is number`, `min length … max length`, `is url`, and `is one of`.

### Expects from previous step
Step 23 complete — PATCH support merged.

### Tasks
1. Add tokens `IS_NUMBER`, `IS_URL`, `MAX_LENGTH`, `IS_ONE_OF` to the lexer.
2. Update the parser to recognise:
   - `validate <field> is number`
   - `validate <field> min length <n> max length <m>`
   - `validate <field> is url`
   - `validate <field> is one of "<v1>", "<v2>", …`
3. Add four new validator emitters to the `VALIDATORS` dispatch map in `src/codegen/validate.js`.
4. Write unit tests for each new rule in `tests/codegen/validate.test.js`.
5. Update `docs/KEYWORDS.md` with the new validate syntax and examples.

### Produces
- Four additional validation rules fully wired from lexer to emitted Express validation code.

### Update done.md
Append:
```
- Step 24 ✅ Four new validation rules added: is number, min/max length, is url, is one of.
```

---

## Step 25 — Environment-Aware Configuration

### What this step does
Let Trionary source files reference environment variables for the server port and database URL so that the same `.tri` file can run in development, staging, and production without edits.

### Expects from previous step
Step 24 complete — extended validation merged.

### Tasks
1. Add token `ENV` and keyword `env` to the lexer.
2. Update the parser to accept `server port env <VAR_NAME>` and `database connect env <VAR_NAME>` as alternative forms of the existing `server port <n>` and `database connect <url>` declarations.
3. Update `src/codegen/server.js` to emit `process.env.<VAR_NAME> || <fallback>` for the port.
4. Update `src/codegen/database.js` to emit `process.env.<VAR_NAME>` for the Mongoose connection string.
5. Update `src/codegen/server.js` to write a `.env.example` file alongside the compiled output, listing the referenced variable names with placeholder values.
6. Write tests in `tests/codegen/server.test.js` and `tests/codegen/database.test.js` covering both the literal and `env` forms.
7. Update `docs/GETTING_STARTED.md` with a section on environment configuration.

### Produces
- `env` keyword wired through lexer → parser → codegen; compiled output reads from `process.env`.
- `.env.example` auto-generated at build time.

### Update done.md
Append:
```
- Step 25 ✅ env keyword implemented; server port and database URL can reference process.env variables; .env.example auto-generated.
```

---

## Step 26 — Custom Middleware by npm Package Name

### What this step does
Allow a Trionary file to declare third-party Express middleware (e.g. `helmet`, `cors`, `morgan`) by npm package name. The compiler emits the correct `app.use(require('<pkg>'))` call and adds the package to the generated `package.json`.

### Expects from previous step
Step 25 complete — env configuration merged.

### Tasks
1. Add token `MIDDLEWARE` (already exists for auth middleware) and extend the grammar to accept `middleware <packageName>` at the top-level scope (outside a route block).
2. Add `MiddlewareNode` to `src/parser/ast.js` with a `packageName` property.
3. Update the parser to parse the new top-level `middleware` declaration and add `MiddlewareNode` instances to the program node's `middleware` array.
4. Create `src/codegen/middleware.js` (or extend the existing file) to emit `app.use(require('<packageName>'))` for each `MiddlewareNode`.
5. Update `src/codegen/server.js` to accept optional arguments like `express`, `cors`, etc., and inject custom middlewares.
6. Update the generated `package.json` dependencies section to include each declared middleware package.
7. Write tests in `tests/codegen/middleware.test.js`.
8. Add `examples/cors-api.tri` demonstrating `middleware cors` and `middleware helmet`.

### Produces
- Custom npm middleware declared in `.tri` and emitted as `app.use()` in compiled output.
- Generated `package.json` includes the middleware packages.

### Update done.md
Append:
```
- Step 26 ✅ Custom middleware keyword implemented; npm package names declared in .tri are emitted as app.use() and added to generated package.json.
```

---

## Step 27 — PostgreSQL / Prisma Multi-Database Target

### What this step does
Introduce a `database type` declaration so Trionary can compile to either MongoDB/Mongoose (the v0.1 default) or PostgreSQL/Prisma. A new `--db` CLI flag and a codegen backend selection layer are added.

### Expects from previous step
Step 26 complete — custom middleware merged.

### Tasks
1. Add tokens `TYPE` (for `database type`), `MONGODB`, `POSTGRES` to the lexer.
2. Extend the parser to handle `database type mongodb` and `database type postgres` at the top level; store the choice in a `dbType` property on the program node.
3. Create `src/codegen/backends/` directory with two sub-modules:
   - `mongoose.js` — existing Mongoose model/query codegen extracted from `src/codegen/models.js` and `src/codegen/crud.js`.
   - `prisma.js` — new Prisma-based codegen emitting `prisma.<model>.findMany()`, `prisma.<model>.create()`, etc., and a `schema.prisma` file.
4. Update `src/codegen/index.js` to select the correct backend based on `program.dbType`.
5. Add `--db <mongodb|postgres>` flag to the CLI in `src/cli/index.js` (overrides the source declaration).
6. Write tests in `tests/codegen/backends/` for both backends covering at least `find`, `create`, `update`, `delete`.
7. Add `examples/postgres-api.tri` using `database type postgres`.

### Produces
- Two codegen backends selectable via source declaration or CLI flag.
- Prisma `schema.prisma` emitted for PostgreSQL targets.

### Update done.md
Append:
```
- Step 27 ✅ Multi-database codegen implemented; database type postgres emits Prisma client calls and schema.prisma.
```

---

## Step 28 — VS Code Syntax Highlighting Extension

### What this step does
Publish a VS Code extension that provides syntax highlighting for `.tri` files using a TextMate grammar. This makes the language usable day-to-day with immediate visual feedback.

### Expects from previous step
Step 27 complete — multi-database support merged.

### Tasks
1. Create a new directory `packages/vscode-trionary/` inside the monorepo.
2. Run `npx yo code` inside that directory to scaffold a Language Extension with language ID `trionary` and file extension `.tri`.
3. Write the TextMate grammar in `packages/vscode-trionary/syntaxes/trionary.tmLanguage.json`, covering:
   - Keywords (`route`, `auth`, `validate`, `find`, `create`, `update`, `delete`, `return`, `populate`, `middleware`, etc.)
   - HTTP verbs (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`)
   - String literals, numbers, and booleans
   - Comments (`#`)
   - Route paths (`/users/:id`)
   - Inline JS escape hatch (`js:`)
4. Add a language configuration file for bracket matching and comment toggling.
5. Write a `README.md` and add a sample `.tri` screenshot to the extension.
6. Add an npm script `vsce:package` that runs `vsce package` to produce a `.vsix` file.
7. Add CI step to build the extension on every push.

### Produces
- VS Code extension project in `packages/vscode-trionary/`.
- TextMate grammar with full keyword highlighting.
- Packaged `.vsix` artifact.

### Update done.md
Append:
```
- Step 28 ✅ VS Code syntax highlighting extension created; TextMate grammar covers all Trionary keywords; .vsix packaged.
```

---

## Step 29 — Language Server Protocol (LSP) — Autocomplete & Diagnostics

### What this step does
Add an LSP server for `.tri` files that provides keyword autocomplete suggestions and real-time inline error diagnostics as the developer types, without needing to run a build.

### Expects from previous step
Step 28 complete — VS Code extension in place (the LSP server will be integrated into it).

### Tasks
1. Create `packages/trionary-lsp/` with a Node.js LSP server using `vscode-languageserver` and `vscode-languageserver-textdocument`.
2. Implement `textDocument/completion` to suggest all reserved keywords contextually (e.g. suggest HTTP verbs after `route`, suggest field names after `take`).
3. Implement `textDocument/publishDiagnostics` by running the Trionary lexer + parser on the document on every change and mapping `TrinaryError` positions to LSP `Diagnostic` objects.
4. Implement `textDocument/hover` to show a one-line description of the keyword under the cursor, sourced from a static map.
5. Wire the LSP server into the VS Code extension by launching it as a child process in `packages/vscode-trionary/extension.js`.
6. Write LSP integration tests using `vscode-languageclient/testbed` or a mock transport.
7. Update the VS Code extension `README.md` to describe the new LSP features.

### Produces
- Standalone LSP server (`packages/trionary-lsp/`).
- Autocomplete, diagnostics, and hover working in VS Code.

### Update done.md
Append:
```
- Step 29 ✅ LSP server implemented; autocomplete, inline diagnostics, and hover documentation work in VS Code.
```

---

## Step 30 — Multi-File Project Support (`import` Keyword)

### What this step does
Allow large Trionary APIs to be split across multiple `.tri` files using an `import routes from` statement. The compiler merges all imported route definitions into a single Express application.

### Expects from previous step
Step 29 complete — LSP merged.

### Tasks
1. Add tokens `IMPORT`, `ROUTES`, `FROM` to the lexer.
2. Add `ImportNode` to `src/parser/ast.js` with a `path` property.
3. Update the parser to parse `import routes from "<path>"` at the top level and emit an `ImportNode`.
4. Add a pre-processing pass in `src/compiler/resolve.js` that:
   - Reads each imported file.
   - Lexes and parses it.
   - Merges its `RouteNode` list into the parent program's route list.
   - Detects and errors on circular imports.
5. Update the CLI `build` command to pass the resolved program to the existing codegen pipeline.
6. Write tests in `tests/compiler/resolve.test.js` covering single import, multi-import, and circular-import error cases.
7. Add `examples/multi-file-api/` with `index.tri`, `posts.tri`, and `users.tri`.

### Produces
- `import routes from` keyword fully wired; multi-file APIs compile to a single Express app.
- Circular import detection with a descriptive error.

### Update done.md
Append:
```
- Step 30 ✅ import routes from keyword implemented; multi-file Trionary projects supported; circular imports detected and reported.
```

---

## Step 31 — Server-Sent Events (Streaming) Support

### What this step does
Add a `stream events` statement inside a route body that compiles to a Node.js Server-Sent Events (SSE) response, enabling real-time push from the server to connected clients.

### Expects from previous step
Step 30 complete — multi-file import merged.

### Tasks
1. Add tokens `STREAM`, `EVENTS` to the lexer.
2. Add `StreamNode` to `src/parser/ast.js`.
3. Update the parser to recognise `stream events` as a route body statement.
4. Create `src/codegen/stream.js` that emits the SSE headers and a `setInterval`-based push skeleton:
   ```js
   res.setHeader('Content-Type', 'text/event-stream');
   res.setHeader('Cache-Control', 'no-cache');
   res.setHeader('Connection', 'keep-alive');
   res.flushHeaders();
   // developer fills in the event data
   ```
5. Wire the new emitter into the route codegen pipeline.
6. Write tests in `tests/codegen/stream.test.js` verifying the emitted SSE headers.
7. Add `examples/sse-api.tri` with a `stream events` route.
8. Document the feature in `docs/KEYWORDS.md`.

### Produces
- `stream events` keyword compiles to a correct SSE Express route.

### Update done.md
Append:
```
- Step 31 ✅ stream events keyword implemented; SSE route skeleton emitted with correct headers.
```

---

## Step 32 — WebSocket Route Support

### What this step does
Introduce a `socket` keyword that compiles to a `ws` (or `socket.io`) WebSocket handler, enabling full-duplex real-time communication.

### Expects from previous step
Step 31 complete — SSE streaming merged.

### Tasks
1. Add token `SOCKET` and keyword `socket` to the lexer.
2. Add `SocketNode` to `src/parser/ast.js` with `event` and `body` properties.
3. Update the parser to parse:
   ```tri
   socket /chat
     on message
       broadcast message
   ```
4. Create `src/codegen/socket.js` that emits `ws` package setup and `wss.on('connection', …)` handlers.
5. Update `src/codegen/server.js` to conditionally attach the WebSocket server to the HTTP server when `SocketNode`s are present.
6. Add the `ws` package to the generated `package.json` dependencies.
7. Write tests in `tests/codegen/socket.test.js`.
8. Add `examples/websocket-chat.tri`.

### Produces
- `socket` keyword compiles to a `ws`-based WebSocket server attached to the Express HTTP server.

### Update done.md
Append:
```
- Step 32 ✅ socket keyword implemented; WebSocket routes compile to ws package handlers attached to the HTTP server.
```

---

## Step 33 — Background Jobs & Scheduled Tasks

### What this step does
Add a `job` keyword for declaring cron-style background tasks that run on a schedule (e.g. `job daily at midnight`). The compiler emits `node-cron` schedule calls.

### Expects from previous step
Step 32 complete — WebSocket support merged.

### Tasks
1. Add tokens `JOB`, `DAILY`, `WEEKLY`, `AT`, `MIDNIGHT`, `NOON` and an `EVERY <n> <unit>` variant to the lexer.
2. Add `JobNode` to `src/parser/ast.js` with `schedule` (cron string) and `body` (statement list) properties.
3. Update the parser to parse schedule shorthands (`daily at midnight`, `weekly`, `every 5 minutes`) and convert them to cron expressions.
4. Create `src/codegen/jobs.js` that emits `cron.schedule('<expr>', async () => { … })` for each `JobNode`.
5. Update `src/codegen/server.js` to import and initialise `node-cron` when jobs are present.
6. Add `node-cron` to the generated `package.json`.
7. Write tests in `tests/codegen/jobs.test.js` covering schedule expression conversion and emitted code.
8. Add `examples/scheduled-cleanup.tri`.

### Produces
- `job` keyword compiles to `node-cron` schedule calls.
- Schedule shorthand converts correctly to cron expressions.

### Update done.md
Append:
```
- Step 33 ✅ job keyword implemented; schedule shorthands convert to cron expressions; node-cron code emitted.
```

---

## Step 34 — Built-in Test DSL (compiles to Jest)

### What this step does
Add a `test` block syntax to Trionary that compiles to Jest test cases. Developers can write API integration tests in plain English directly in `.tri` files (or companion `.tri.test` files), which compile to Jest `describe`/`it`/`expect` blocks with `supertest`.

### Expects from previous step
Step 33 complete — background jobs merged.

### Tasks
1. Add tokens `TEST`, `SEND`, `EXPECT`, `STATUS`, `BODY`, `EXISTS` to the lexer.
2. Add `TestNode`, `SendNode`, `ExpectNode` to `src/parser/ast.js`.
3. Update the parser to parse:
   ```tri
   test "POST /register creates a user"
     send POST /register with name "Alice", email "alice@example.com", password "secret"
     expect status 200
     expect body.token exists
   ```
4. Create `src/codegen/tests.js` that emits:
   ```js
   const request = require('supertest');
   const app = require('./app');
   describe('POST /register creates a user', () => {
     it('returns 200 with a token', async () => {
       const res = await request(app).post('/register').send({ … });
       expect(res.status).toBe(200);
       expect(res.body.token).toBeDefined();
     });
   });
   ```
5. Add a `trionary test` CLI command that compiles test blocks and runs Jest.
6. Write meta-tests in `tests/codegen/tests.test.js` verifying the emitted Jest code.
7. Add `examples/blog-api.test.tri` with tests for the blog example.
8. Update `docs/GETTING_STARTED.md` with a testing section.

### Produces
- `test` DSL compiles to Jest + supertest test files.
- `trionary test` CLI command runs the compiled tests.

### Update done.md
Append:
```
- Step 34 ✅ Built-in test DSL implemented; test blocks compile to Jest/supertest; trionary test CLI command added.
```

---

## Step 35 — Plugin API for Custom Keywords

### What this step does
Expose a public JavaScript plugin API that lets third-party authors add new Trionary keywords, AST nodes, and codegen emitters without forking the compiler. Plugins are declared in a `trionary.config.js` file.

### Expects from previous step
Step 34 complete — test DSL merged.

### Tasks
1. Create `src/plugin/index.js` exposing:
   - `registerKeyword(name, tokenType)` — adds a keyword to the lexer at runtime.
   - `registerASTNode(name, factory)` — registers an AST node factory.
   - `registerEmitter(nodeType, emitterFn)` — registers a codegen emitter.
2. Update the lexer init path to call `PluginRegistry.applyKeywords()` before tokenising.
3. Update the codegen dispatch table in `src/codegen/index.js` to look up `PluginRegistry.emitters` for unknown node types.
4. Create `src/cli/config.js` that reads `trionary.config.js` from the project root, imports each declared plugin, and calls its `register(pluginAPI)` hook.
5. Write a reference plugin in `examples/plugins/stripe-webhook.js` that adds a `stripe webhook` keyword.
6. Write tests in `tests/plugin/index.test.js` covering dynamic keyword registration and emitter dispatch.
7. Document the plugin API in `docs/PLUGIN_API.md`.

### Produces
- Public plugin API in `src/plugin/index.js`.
- `trionary.config.js` plugin loading in the CLI.
- Reference plugin demonstrating the API.
- `docs/PLUGIN_API.md`.

### Update done.md
Append:
```
- Step 35 ✅ Plugin API implemented; keywords, AST nodes, and emitters can be registered at runtime via trionary.config.js.
```

---

## Step 36 — SQLite Development Database Target

### What this step does
Add `database type sqlite` as a third codegen backend targeting SQLite via Prisma (SQLite provider). This gives developers a zero-install local database for rapid prototyping.

### Expects from previous step
Step 35 complete — plugin API merged. Prisma backend from Step 27 exists.

### Tasks
1. Add token `SQLITE` to the lexer and keyword `sqlite` to the keyword set.
2. Update the parser to accept `database type sqlite`.
3. Create `src/codegen/backends/sqlite.js` that re-uses the Prisma emitter from Step 27 but sets the provider to `sqlite` and the database URL to `file:./dev.db` in the emitted `schema.prisma`.
4. Update `src/codegen/index.js` to route `sqlite` type to the new backend.
5. Add a `--db sqlite` option to the CLI.
6. Write tests in `tests/codegen/backends/sqlite.test.js`.
7. Add `examples/sqlite-api.tri`.
8. Update `docs/GETTING_STARTED.md` with a "Quick start with SQLite" section.

### Produces
- `database type sqlite` compiles to a Prisma SQLite project.

### Update done.md
Append:
```
- Step 36 ✅ SQLite database target added; database type sqlite emits Prisma schema with sqlite provider and file:./dev.db URL.
```

---

## Step 37 — Semantic Versioning, Changelog & Automated Release Pipeline

### What this step does
Set up a fully automated release pipeline using `semantic-release` (or `release-please`) that generates changelogs, bumps the npm version, creates a GitHub Release, and publishes to npm on every merge to `main`. This replaces the manual Step 20 release process.

### Expects from previous step
Step 36 complete — SQLite backend merged.

### Tasks
1. Install `semantic-release` with plugins: `@semantic-release/commit-analyzer`, `@semantic-release/release-notes-generator`, `@semantic-release/changelog`, `@semantic-release/npm`, `@semantic-release/github`.
2. Create `.releaserc.json` at the repo root configuring the plugin chain: analyse commits → generate notes → write `CHANGELOG.md` → bump `package.json` version → publish to npm → create GitHub Release.
3. Add a `.github/workflows/release.yml` workflow that runs `npx semantic-release` on pushes to `main`, with `NPM_TOKEN` and `GITHUB_TOKEN` secrets.
4. Adopt the Conventional Commits specification in `CONTRIBUTING.md`: `feat:`, `fix:`, `docs:`, `chore:`, `BREAKING CHANGE:`.
5. Add a `commitlint` config (`.commitlintrc.json`) and a `husky` pre-commit hook to enforce commit message format.
6. Verify the pipeline end-to-end in a dry-run: `npx semantic-release --dry-run`.
7. Update `README.md` with a "Contributing" section linking to `CONTRIBUTING.md`.

### Produces
- Fully automated semantic release pipeline on `main`.
- Auto-generated `CHANGELOG.md` on every release.
- Conventional Commits enforced via commitlint + husky.

### Update done.md
Append:
```
- Step 37 ✅ Automated semantic-release pipeline configured; CHANGELOG.md auto-generated; Conventional Commits enforced.
```

---

## Step 38 — End-to-End Test Suite & CI Coverage Gate

### What this step does
Add a comprehensive end-to-end (E2E) test suite that compiles real `.tri` fixture files, starts the compiled server, and makes live HTTP requests to verify correctness. A CI coverage gate of ≥90% overall is enforced.

### Expects from previous step
Step 37 complete — automated release pipeline in place.

### Tasks
1. Create `tests/e2e/` directory.
2. Write `tests/e2e/blog-api.test.js` using `supertest` (or Axios + a real running server) that:
   - Compiles `examples/blog-api.tri` to a temp output directory.
   - Spawns the compiled server with a test MongoDB/SQLite database.
   - Runs through the full CRUD lifecycle: register → login → create post → list posts → update post → delete post.
   - Asserts correct HTTP status codes and response bodies.
3. Write similar E2E tests for `examples/multi-file-api/` and `examples/postgres-api.tri` (using a test Postgres container via `@testcontainers/postgresql`).
4. Add a `jest.config.js` project for E2E tests (`testMatch: ['tests/e2e/**']`) with a longer timeout (`testTimeout: 30000`).
5. Update `.github/workflows/ci.yml` to run unit tests and E2E tests in parallel jobs.
6. Add a coverage check step: fail CI if overall line coverage drops below 90%.
7. Add a coverage badge to `README.md`.

### Produces
- `tests/e2e/` suite covering the full blog API lifecycle.
- CI pipeline with parallel unit + E2E jobs and a 90% coverage gate.

### Update done.md
Append:
```
- Step 38 ✅ E2E test suite added covering blog API lifecycle; CI coverage gate set at ≥90%.
```

---

## Step 39 — Interactive `trionary new` Project Generator

### What this step does
Add a `trionary new <project-name>` CLI command that interactively scaffolds a full Trionary project — prompting for database type, authentication style, and starter routes — and writes a ready-to-run project directory.

### Expects from previous step
Step 38 complete — full E2E test suite green.

### Tasks
1. Install `inquirer` (or `@inquirer/prompts`) as a CLI dependency.
2. Implement `src/cli/new.js` with an interactive prompt flow:
   - Project name (pre-filled from argument).
   - Database type: MongoDB / PostgreSQL / SQLite.
   - Include authentication? Yes / No.
   - Starter routes: Blog (posts + users) / E-commerce (products + orders) / Blank.
3. Based on answers, copy the appropriate template from a new `src/templates/` directory into the target folder and substitute placeholders.
4. After scaffolding, run `npm install` inside the new project directory automatically.
5. Print a "next steps" message: `cd <project-name> && trionary dev`.
6. Register the `new` command in `src/cli/index.js`.
7. Write tests in `tests/cli/new.test.js` using mocked `inquirer` responses.
8. Update `docs/GETTING_STARTED.md` to use `trionary new` as the primary onboarding path.

### Produces
- `trionary new` command with interactive prompts and project templates.
- Updated `GETTING_STARTED.md`.

### Update done.md
Append:
```
- Step 39 ✅ trionary new interactive project generator implemented; prompts for DB type, auth, and starter routes; scaffolds a ready-to-run project.
```

---

## Step 40 — Trionary v1.0.0 — Full Release, Docs Site & Community Launch

### What this step does
Cut the official v1.0.0 release: publish to npm, deploy a documentation website, write migration notes from v0.1.0, create the GitHub Release, and announce the project to the community.

### Expects from previous step
Step 39 complete — all v1.0 features implemented, E2E tests green, automated release pipeline in place.

### Tasks
1. Bump `package.json` version to `1.0.0` (or let `semantic-release` do it via a `feat!: v1.0.0` commit with `BREAKING CHANGE` footer).
2. Write `docs/MIGRATION_v0_to_v1.md` documenting all breaking changes and new keywords introduced since v0.1.0.
3. Build a documentation site using VitePress or Docusaurus, sourced from the `docs/` directory. Deploy to GitHub Pages via a `.github/workflows/docs.yml` workflow.
4. Publish the VS Code extension (`packages/vscode-trionary/`) to the VS Code Marketplace using `vsce publish` in CI.
5. Write a GitHub Release for `v1.0.0` with:
   - Full changelog (auto-generated by semantic-release).
   - "What's New" highlights.
   - Links to the docs site and VS Code extension.
6. Post launch announcements: Product Hunt, Hacker News Show HN, Dev.to article, and the project's Twitter/X account.
7. Open the GitHub Discussions board and pin a "Welcome to Trionary v1.0" thread.
8. Update `README.md` with the new docs site link, VS Code extension badge, and npm version badge.

### Produces
- `trionary@1.0.0` live on npm.
- Documentation site deployed to GitHub Pages.
- VS Code extension published to the Marketplace.
- GitHub Release `v1.0.0` with changelog and highlights.
- Community launch across Product Hunt, Hacker News, and Dev.to.

### Update done.md
Append:
```
- Step 40 ✅ Trionary v1.0.0 released; npm published, docs site live, VS Code extension on Marketplace, community launch complete.
```

---

*End of v1.0 plan — Steps 21–40.*
