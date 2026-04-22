# Trionary Backend — 20-Step Implementation Plan

**Document**: Based on `Trionary_Backend_Spec.docx`  
**Goal**: Build a plain-English backend language that compiles to production-ready Node.js.  
**Validation Status**: ✅ Plan is technically feasible (compiler pipeline is well-understood; lexer → parser → AST → code generator is proven architecture).

---

## How to Use This Document

Each step below:
- Describes **what it does** (the task).
- Lists **what it expects** from the previous step (its dependency).
- Specifies **what it produces** (its output artifact).
- Ends with an instruction to **update `done.md`** — a shared progress log — with a single-sentence summary of what that step completed.

`done.md` lives at the repo root. Every step appends one line to it so the team can track progress at a glance.

---

## Step 1 — Repository & Project Scaffolding

### What this step does
Initialise the repository, install tooling, and establish the folder structure that every subsequent step will use. This is the foundation every other step depends on.

### Expects from previous step
Nothing. This is the first step.

### Tasks
1. Create a new repository (or use the existing one) named `trionary`.
2. Run `npm init -y` to create `package.json`.
3. Set `"type": "module"` in `package.json` to use ES modules throughout.
4. Install development dependencies:
   ```
   npm install --save-dev jest @jest/globals prettier eslint
   ```
5. Create the following folder structure at the repo root:
   ```
   trionary/
   ├── src/
   │   ├── lexer/
   │   ├── parser/
   │   ├── transformer/
   │   ├── codegen/
   │   ├── cli/
   │   ├── errors/
   │   └── utils/
   ├── tests/
   │   ├── lexer/
   │   ├── parser/
   │   └── codegen/
   ├── examples/
   ├── docs/
   ├── done.md          ← shared progress log (create empty file)
   └── PLAN.md          ← this file
   ```
6. Create `.eslintrc.json` with `"env": { "node": true, "es2022": true }`.
7. Create `.prettierrc` with `{ "singleQuote": true, "semi": true }`.
8. Create an empty `done.md` with a header:
   ```md
   # Trionary — Done Log
   ```
9. Create `README.md` with title "Trionary Backend" and a one-line description.

### Produces
- Initialised repo with correct folder structure.
- `package.json`, `done.md`, `README.md`, `.eslintrc.json`, `.prettierrc`.

### Update done.md
Append the following line to `done.md`:
```
- Step 1 ✅ Repository and project scaffold created; folder structure, package.json, done.md, and tooling config in place.
```

---

## Step 2 — Token Definitions & Lexer Design

### What this step does
Define every token the Trionary lexer must recognise before writing a single line of lexer code. This is a design document step — no executable code yet.

### Expects from previous step
- Step 1 complete: repo structure and `src/lexer/` directory exist.

### Tasks
1. Create `src/lexer/tokens.js` and export a frozen `TOKEN_TYPES` object that lists every token:
   ```
   KEYWORD, IDENTIFIER, STRING, NUMBER, OPERATOR,
   INDENT, DEDENT, NEWLINE, EOF, COMMENT
   ```
2. Create `src/lexer/keywords.js` and export a `Set` of all reserved keywords from the spec:
   ```
   server, port, database, connect, route, GET, POST, PUT, PATCH, DELETE,
   take, require, validate, exists, hash, create, find, update, delete,
   return, auth, middleware, cors, logs, helmet, ratelimit, compress,
   paginate, check, if, by, all, sorted, with, where, current, user,
   token, for, error, status, ok, password, matches, not, found,
   min, max, per, minute, is, email, length, limit
   ```
3. Write a `TOKEN_PATTERNS` map in `src/lexer/patterns.js` that pairs each token type with its regex.
4. Write a short design comment at the top of each file explaining its role.

### Produces
- `src/lexer/tokens.js`
- `src/lexer/keywords.js`
- `src/lexer/patterns.js`

### Update done.md
Append:
```
- Step 2 ✅ Token types, reserved keyword set, and regex patterns defined in src/lexer/.
```

---

## Step 3 — Implement the Lexer (Tokenizer)

### What this step does
Write the lexer that converts raw Trionary source text into a flat list of typed tokens. This is the first executable component of the compiler.

### Expects from previous step
- Step 2 complete: `tokens.js`, `keywords.js`, and `patterns.js` exist and are correct.

### Tasks
1. Create `src/lexer/lexer.js` and export a `tokenize(source)` function.
2. The function must:
   - Track `line` and `column` for every token (required by the error system in Step 12).
   - Handle indentation: emit `INDENT` when indentation increases and `DEDENT` when it decreases.
   - Strip `#`-prefixed comment lines.
   - Return an array of token objects: `{ type, value, line, col }`.
3. Handle edge cases:
   - Mixed spaces/tabs: normalize to 2-space units; emit a warning but do not crash.
   - Trailing whitespace on lines: strip before tokenising.
   - Empty lines: skip without emitting a token.
   - Strings in double quotes: capture the inner value without quotes.
4. Export a secondary helper `tokenizeFile(path)` that reads a `.tri` file and calls `tokenize`.

### Produces
- `src/lexer/lexer.js`

### Update done.md
Append:
```
- Step 3 ✅ Lexer implemented in src/lexer/lexer.js; tokenize() and tokenizeFile() exported; INDENT/DEDENT and position tracking included.
```

---

## Step 4 — AST Node Definitions

### What this step does
Define the shape of every node in the Abstract Syntax Tree (AST) that the parser will produce. Like Step 2, this is a design step: no parsing logic yet.

### Expects from previous step
- Step 3 complete: the token stream format is known and stable.

### Tasks
1. Create `src/parser/ast.js` and export factory functions (not classes) for each node type:
   - `ProgramNode(body)` — root node; `body` is an array of top-level nodes.
   - `ServerDeclarationNode(port)` — `server port 3000`.
   - `DatabaseDeclarationNode(uri)` — `database connect "..."`.
   - `MiddlewareDeclarationNode(name, options)` — `middleware cors`.
   - `RouteNode(method, path, body)` — a route and its children.
   - `AuthNode(required)` — `auth required`.
   - `TakeNode(fields)` — `take name, email, password`.
   - `RequireNode(fields)` — `require name, email, password`.
   - `ValidateNode(field, rule, value)` — `validate email is email`.
   - `FindNode(target, filter, options)` — `find all users sorted by date`.
   - `CreateNode(model, fields)` — `create user with name, email`.
   - `UpdateNode(model, fields)` — `update post with title, body`.
   - `DeleteNode(model, filter)` — `delete post by id`.
   - `ReturnNode(value, statusCode)` — `return users`, `return error "..." status 404`.
   - `ExistsCheckNode(model, filter)` — `exists user where email`.
   - `IfNode(condition, body)` — `if exists return error "..."`.
   - `HashNode(field)` — `hash password`.
   - `PaginateNode(target, limit)` — `paginate posts limit 20`.
   - `EscapeHatchNode(rawJs)` — inline Node.js block.
2. Each factory returns a plain object with a `type` string property and the listed fields.

### Produces
- `src/parser/ast.js`

### Update done.md
Append:
```
- Step 4 ✅ All 19 AST node factory functions defined in src/parser/ast.js.
```

---

## Step 5 — Implement the Parser

### What this step does
Write the recursive-descent parser that converts the token stream into an AST using the node shapes from Step 4.

### Expects from previous step
- Step 3 complete: `tokenize()` returns a stable, well-typed token array.
- Step 4 complete: all AST node factories are defined.

### Tasks
1. Create `src/parser/parser.js` and export a `parse(tokens)` function that returns a `ProgramNode`.
2. Implement recursive descent methods for each statement type:
   - `parseProgram()` — loop until EOF, dispatch to sub-parsers.
   - `parseServerDeclaration()`, `parseDatabaseDeclaration()`, `parseMiddlewareDeclaration()`.
   - `parseRoute()` — parse the route header then call `parseBlock()` for indented body.
   - `parseBlock()` — collect statements until DEDENT or EOF.
   - `parseStatement()` — dispatch based on the leading keyword token.
   - Individual parsers for: `take`, `require`, `validate`, `find`, `create`, `update`, `delete`, `return`, `auth`, `exists`, `if`, `hash`, `paginate`, `escape`.
3. On unexpected tokens, throw a structured error object `{ message, line, col, source }` (the error system in Step 12 will format it).
4. Export a secondary helper `parseFile(path)` that tokenises then parses a `.tri` file.

### Produces
- `src/parser/parser.js`

### Update done.md
Append:
```
- Step 5 ✅ Recursive-descent parser implemented in src/parser/parser.js; parse() and parseFile() exported; structured errors thrown on bad syntax.
```

---

## Step 6 — Server, Database & Middleware Code Generation

### What this step does
Write the first transformer module: generate the Node.js boilerplate for server startup, database connection, and middleware setup from the corresponding AST nodes.

### Expects from previous step
- Step 5 complete: the parser produces a valid `ProgramNode` with `ServerDeclarationNode`, `DatabaseDeclarationNode`, and `MiddlewareDeclarationNode` children.

### Tasks
1. Create `src/codegen/server.js` and export `generateServer(node)` → returns a string of Node.js code.
   - Output: `const app = express(); const PORT = <port>; app.listen(PORT, ...);`
2. Create `src/codegen/database.js` and export `generateDatabase(node)`.
   - Output: `mongoose.connect('<uri>', { useNewUrlParser: true, useUnifiedTopology: true });`
3. Create `src/codegen/middleware.js` and export `generateMiddleware(node)`.
   - Map keyword → npm package and `app.use(...)` call:
     - `cors` → `app.use(cors());`
     - `logs` → `app.use(morgan('dev'));`
     - `helmet` → `app.use(helmet());`
     - `ratelimit max N per minute` → `app.use(rateLimit({ windowMs: 60000, max: N }));`
     - `compress` → `app.use(compression());`
4. Create `src/codegen/imports.js` that collects which npm packages are used and generates the full `require`/`import` block at the top of the output file.
5. All generators return strings; no file I/O at this stage.

### Produces
- `src/codegen/server.js`
- `src/codegen/database.js`
- `src/codegen/middleware.js`
- `src/codegen/imports.js`

### Update done.md
Append:
```
- Step 6 ✅ Code generators for server, database, middleware, and imports created in src/codegen/.
```

---

## Step 7 — Auth Route Code Generation

### What this step does
Generate the Node.js Express handlers for authentication routes: `POST /register`, `POST /login`, and `GET /me`. This is the highest-value single feature — it replaces 50+ lines of boilerplate per project.

### Expects from previous step
- Step 5 complete: parser produces `RouteNode` with correctly nested statement nodes.
- Step 6 complete: import collector exists so auth dependencies (`bcrypt`, `jsonwebtoken`) can be tracked.

### Tasks
1. Create `src/codegen/auth.js` and export `generateAuthStatements(statementsArray)`.
2. Implement code generation for each auth-related AST node inside a route body:
   - `HashNode` → `const hashed = await bcrypt.hash(password, 10); req.body.password = hashed;`
   - `ReturnNode` with token → `const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' }); return res.json({ token });`
   - `ReturnNode` for `current user` → `return res.json({ user: req.user });`
   - `ExistsCheckNode` → `const exists = await User.findOne({ email });`
   - `IfNode` for exists check → `if (exists) return res.status(409).json({ error: 'Email already in use' });`
   - `CreateNode` for user → `const user = await User.create({ name, email, password });`
   - `FindNode` for user by email → `const user = await User.findOne({ email });`
   - `checkPasswordMatches` → `const valid = await bcrypt.compare(password, user.password);`
3. Register `bcrypt`, `jsonwebtoken`, and `express` in the import collector.

### Produces
- `src/codegen/auth.js`

### Update done.md
Append:
```
- Step 7 ✅ Auth route code generation implemented in src/codegen/auth.js; covers register, login, and /me handlers.
```

---

## Step 8 — CRUD Route Code Generation

### What this step does
Generate Node.js Express handlers for all standard CRUD operations: find, create, update, delete, and paginate. This covers the posts-style routes in the spec.

### Expects from previous step
- Step 7 complete: auth code generation working and import collector pattern established.

### Tasks
1. Create `src/codegen/crud.js` and export `generateCrudStatements(statementsArray, modelName)`.
2. Implement code generation for each CRUD AST node:
   - `FindNode` all → `const <model>s = await <Model>.find({}).sort({ date: -1 });`
   - `FindNode` by id → `const <model> = await <Model>.findById(req.params.id);`
   - `PaginateNode` → `.skip((page-1)*limit).limit(limit)` appended to the find query; add `const page = parseInt(req.query.page) || 1;` before.
   - `CreateNode` → `const <model> = await <Model>.create({ ...req.body });`
   - `UpdateNode` → `await <model>.updateOne({ _id: req.params.id }, { ...req.body });`
   - `DeleteNode` → `await <Model>.findByIdAndDelete(req.params.id);`
   - `ReturnNode` for model → `return res.json({ <model> });`
   - `ReturnNode` ok → `return res.json({ message: '<msg>' });`
   - `ReturnNode` error with status → `return res.status(<code>).json({ error: '<msg>' });`
   - `IfNode` not found → `if (!<model>) return res.status(404).json({ error: 'Not found' });`
3. `TakeNode` → `const { field1, field2 } = req.body;`
4. `RequireNode` → generate a validation block that returns 400 if any required field is missing.

### Produces
- `src/codegen/crud.js`

### Update done.md
Append:
```
- Step 8 ✅ CRUD route code generation implemented in src/codegen/crud.js; covers find, create, update, delete, paginate, take, require, and conditional returns.
```

---

## Step 9 — Validation Statement Code Generation

### What this step does
Generate inline validation code for the `validate` keyword — field format checks and length rules — which appear inside route bodies.

### Expects from previous step
- Step 8 complete: the `generateCrudStatements` pattern is established; validation fits the same statement-level generator pattern.

### Tasks
1. Create `src/codegen/validate.js` and export `generateValidate(node)`.
2. Implement the two validation rules from the spec:
   - `validate <field> is email` →
     ```js
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(<field>)) return res.status(400).json({ error: 'Invalid email address' });
     ```
   - `validate <field> min length <n>` →
     ```js
     if (<field>.length < <n>) return res.status(400).json({ error: '<Field> must be at least <n> characters' });
     ```
3. Extend the rule set for future validators by using a `VALIDATORS` dispatch map so new rules can be added without touching existing logic.
4. Integrate `generateValidate` into the statement dispatcher in `crud.js`.

### Produces
- `src/codegen/validate.js`

### Update done.md
Append:
```
- Step 9 ✅ Validation code generation implemented in src/codegen/validate.js; email and min-length rules supported; extensible via VALIDATORS dispatch map.
```

---

## Step 10 — JWT Auth Middleware Generation

### What this step does
Generate the `authRequired` Express middleware function that guards routes marked `auth required`. This is a shared middleware injected once and referenced by name in every guarded route.

### Expects from previous step
- Step 9 complete: all statement-level generators are in place; the full generator pattern is stable.

### Tasks
1. Create `src/codegen/authMiddleware.js` and export `generateAuthMiddleware()` which returns the full middleware function as a string:
   ```js
   const authRequired = (req, res, next) => {
     const header = req.headers.authorization;
     if (!header) return res.status(401).json({ error: 'No token provided' });
     const token = header.split(' ')[1];
     try {
       req.user = jwt.verify(token, process.env.JWT_SECRET);
       next();
     } catch {
       return res.status(401).json({ error: 'Invalid or expired token' });
     }
   };
   ```
2. When the route body contains `AuthNode(required: true)`, inject `authRequired` as the first argument to the Express route handler: `app.get('/me', authRequired, async (req, res) => { ... })`.
3. The `generateAuthMiddleware()` function is called exactly once per compiled file; the import collector ensures `jsonwebtoken` is already in the imports from Step 7.

### Produces
- `src/codegen/authMiddleware.js`

### Update done.md
Append:
```
- Step 10 ✅ JWT authRequired middleware generation implemented in src/codegen/authMiddleware.js; auto-injected on routes with auth required.
```

---

## Step 11 — Escape Hatch for Inline Node.js

### What this step does
Implement the inline Node.js escape hatch — the safety valve that lets developers drop raw JS into a Trionary file when the language cannot express what they need.

### Expects from previous step
- Step 5 complete: the parser can recognise the escape hatch syntax and produce an `EscapeHatchNode`.
- Step 10 complete: the full code generation pipeline is in place.

### Tasks
1. Define the escape hatch syntax in the parser (update `src/parser/parser.js`):
   ```
   js:
     const result = someComplexOperation();
     return res.json(result);
   ```
   An indented block after a `js:` line is treated as raw JS and produces an `EscapeHatchNode(rawJs)`.
2. Create `src/codegen/escape.js` and export `generateEscape(node)` which emits the raw JS verbatim inside the route handler — no transformation.
3. When an escape hatch is used, prepend a comment in the generated output:
   ```js
   // --- trionary escape hatch: raw Node.js below ---
   ```
4. Update the statement dispatcher to handle `EscapeHatchNode`.
5. Add a warning to the error/logging system (Step 12) that prints: `⚠ Escape hatch used at line <n>. Output is not validated by Trionary.`

### Produces
- Updated `src/parser/parser.js` (escape hatch syntax)
- `src/codegen/escape.js`

### Update done.md
Append:
```
- Step 11 ✅ Inline Node.js escape hatch implemented; js: syntax parsed to EscapeHatchNode; raw JS emitted verbatim with warning comment.
```

---

## Step 12 — Error Messaging System

### What this step does
Build the human-readable error formatting system that turns raw parser/compiler errors into plain-English messages with line numbers — matching the spec's promise of errors that "name the line and explain the problem in plain English."

### Expects from previous step
- Step 3 complete: every token carries `{ line, col }`.
- Step 5 complete: the parser throws `{ message, line, col, source }` objects.
- Step 11 complete: the full pipeline produces errors at known stages.

### Tasks
1. Create `src/errors/TrinaryError.js` and export a `TrinaryError` class extending `Error`:
   - Properties: `message`, `line`, `col`, `source` (lexer/parser/codegen), `hint`.
   - Override `toString()` to format:
     ```
     [Trionary Error — line 12, col 5]
     Parser: Unexpected token "retun". Did you mean "return"?
     Hint: All return statements must start with the keyword "return".
     ```
2. Create `src/errors/messages.js` — a lookup map from error codes to plain-English messages with `{field}` placeholders.
3. Create `src/errors/suggestions.js` — a levenshtein-distance function that suggests the nearest keyword when an unknown identifier is found (e.g., `retun` → `return`).
4. All parser and codegen modules should import and throw `TrinaryError` instead of plain `Error`.
5. The CLI (Step 13) will catch `TrinaryError` and print a formatted block to stderr.

### Produces
- `src/errors/TrinaryError.js`
- `src/errors/messages.js`
- `src/errors/suggestions.js`

### Update done.md
Append:
```
- Step 12 ✅ Error messaging system built in src/errors/; TrinaryError class, plain-English messages, and keyword suggestions implemented.
```

---

## Step 13 — CLI Implementation

### What this step does
Build the `trionary` command-line interface with three commands: `init`, `build`, and `dev`. This is the primary interface developers use.

### Expects from previous step
- Step 12 complete: errors are formatted and catchable.
- Steps 6–11 complete: the full code generation pipeline works end-to-end.

### Tasks
1. Create `src/cli/index.js` as the CLI entry point. Add `"bin": { "trionary": "./src/cli/index.js" }` to `package.json`.
2. Implement `trionary init`:
   - Creates a `app.tri` starter file with the minimal server + one route.
   - Creates a `.env` file with `JWT_SECRET=changeme PORT=3000`.
   - Prints: `✅ Trionary project initialised. Edit app.tri then run: trionary dev`.
3. Implement `trionary build <file>`:
   - Reads the `.tri` source file.
   - Runs: tokenize → parse → transform → codegen.
   - Writes the compiled Node.js to `<filename>.js` in the same directory.
   - Prints: `✅ Compiled to <filename>.js`.
4. Implement `trionary dev <file>`:
   - Runs `trionary build` then starts the server with `node <filename>.js`.
   - Watches the `.tri` source with `chokidar`; on change, rebuilds and restarts.
   - Prints: `🔄 Watching <file> for changes...`.
5. All three commands catch `TrinaryError` and print the formatted error, then exit with code 1.
6. Add shebang `#!/usr/bin/env node` to `src/cli/index.js`.
7. Run `npm link` locally to test the `trionary` command.

### Produces
- `src/cli/index.js`
- Updated `package.json` (bin field)

### Update done.md
Append:
```
- Step 13 ✅ CLI implemented in src/cli/index.js; trionary init, trionary build, and trionary dev commands working; chokidar watch mode included.
```

---

## Step 14 — Unit Tests: Lexer

### What this step does
Write a comprehensive test suite for the lexer using Jest to verify that every token type is correctly identified, including edge cases like indentation changes and escape characters.

### Expects from previous step
- Step 3 complete: `tokenize()` is fully implemented and stable.
- Step 13 complete: CLI proves the pipeline runs end-to-end, confirming the lexer is integrated.

### Tasks
1. Create `tests/lexer/lexer.test.js`.
2. Write tests for:
   - Simple keyword tokens: `server`, `route`, `return`.
   - String literals: `"mongodb://localhost/myapp"`.
   - Number literals: `3000`, `20`, `200`.
   - INDENT and DEDENT tokens on indented blocks.
   - Comments (`# this is a comment`) are stripped and not returned.
   - Position tracking: token at second line reports `line: 2`.
   - Unknown characters: lexer throws `TrinaryError` with a helpful message.
   - A complete Trionary snippet tokenises to the expected token list.
3. Run `npx jest tests/lexer` and ensure all tests pass.
4. Aim for ≥ 90% line coverage on `src/lexer/`.

### Produces
- `tests/lexer/lexer.test.js`
- All tests passing.

### Update done.md
Append:
```
- Step 14 ✅ Lexer unit tests written in tests/lexer/lexer.test.js; all tests passing with ≥90% coverage.
```

---

## Step 15 — Unit Tests: Parser

### What this step does
Write a comprehensive test suite for the parser to verify that valid Trionary source produces correctly-shaped AST nodes, and that invalid source throws properly-formatted errors.

### Expects from previous step
- Step 5 complete: `parse()` is fully implemented.
- Step 14 complete: the lexer is verified stable, so parser tests can rely on `tokenize()` without mocking.

### Tasks
1. Create `tests/parser/parser.test.js`.
2. Write tests for:
   - `server port 3000` → `ProgramNode` containing a `ServerDeclarationNode({ port: 3000 })`.
   - `route GET /users` with body → correct `RouteNode` with children.
   - `take name, email, password` → `TakeNode({ fields: ['name','email','password'] })`.
   - `validate email is email` → `ValidateNode({ field:'email', rule:'is', value:'email' })`.
   - `auth required` → `AuthNode({ required: true })`.
   - `if not found return error "Not found" status 404` → correct `IfNode` wrapping a `ReturnNode`.
   - Escape hatch block → `EscapeHatchNode` with correct raw JS.
   - Missing keyword: `parser throws TrinaryError with line number`.
   - Incomplete route (route with no body): parser throws `TrinaryError`.
3. Run `npx jest tests/parser` and ensure all tests pass.

### Produces
- `tests/parser/parser.test.js`
- All tests passing.

### Update done.md
Append:
```
- Step 15 ✅ Parser unit tests written in tests/parser/parser.test.js; AST shapes and error cases verified; all tests passing.
```

---

## Step 16 — Unit Tests: Code Generation

### What this step does
Write a test suite for each codegen module to verify that AST nodes produce the expected Node.js string output.

### Expects from previous step
- Steps 6–11 complete: all codegen modules are implemented.
- Step 15 complete: parser tests confirm AST nodes are correctly shaped; codegen tests can use those same node factories directly.

### Tasks
1. Create `tests/codegen/server.test.js`, `auth.test.js`, `crud.test.js`, `validate.test.js`, `middleware.test.js`.
2. For each generator, write "snapshot" style tests: pass an AST node and assert the output string equals the expected Node.js code exactly (use `toMatchSnapshot()`).
3. Key cases to cover:
   - `generateServer({ port: 3000 })` → contains `app.listen(3000`.
   - `generateDatabase({ uri: 'mongodb://localhost/myapp' })` → contains `mongoose.connect`.
   - `generateMiddleware({ name: 'ratelimit', max: 200 })` → contains `rateLimit({ windowMs: 60000, max: 200 })`.
   - Auth register flow → output contains `bcrypt.hash`, `jwt.sign`, `User.create`.
   - Find all with paginate → output contains `.skip(` and `.limit(`.
   - Escape hatch node → output contains the raw JS verbatim.
4. Run `npx jest tests/codegen` and ensure all tests pass.

### Produces
- `tests/codegen/` test files
- Jest snapshots committed to repo.
- All tests passing.

### Update done.md
Append:
```
- Step 16 ✅ Code generation unit tests written in tests/codegen/; snapshot tests for all generators; all tests passing.
```

---

## Step 17 — End-to-End Compilation of the Sample API

### What this step does
Compile the full sample API from Section 4 of the spec (the complete REST API with auth + posts) end-to-end and verify the output is valid, runnable Node.js.

### Expects from previous step
- Steps 14–16 complete: all unit tests pass, confirming every component works in isolation.
- Step 13 complete: the CLI can run `trionary build`.

### Tasks
1. Create `examples/blog-api.tri` and paste in the complete Trionary source from Section 4 of the spec (server, database, all middleware, all auth routes, all post routes).
2. Run `trionary build examples/blog-api.tri`.
3. Inspect `examples/blog-api.js` (the compiled output) and verify:
   - All six `require`/`import` statements are present (express, mongoose, bcrypt, jsonwebtoken, cors, morgan, helmet, express-rate-limit).
   - All five routes are present: `POST /register`, `POST /login`, `GET /me`, `GET /posts`, `POST /posts`, `GET /posts/:id`, `PUT /posts/:id`, `DELETE /posts/:id`.
   - `authRequired` middleware is declared once and used on the correct routes.
   - The file is approximately 200 lines as described in the spec.
4. Install the output's dependencies and run `node examples/blog-api.js` to confirm the server starts without errors.
5. Use a REST client (curl or Postman) to manually verify:
   - `POST /register` creates a user and returns a token.
   - `POST /login` returns a token for valid credentials.
   - `GET /posts` returns an empty array on a fresh database.
   - `POST /posts` with a valid token creates a post.
6. Document any discrepancies between the spec and the actual generated output.

### Produces
- `examples/blog-api.tri`
- `examples/blog-api.js` (compiled output — committed to repo as a reference)
- `examples/README.md` explaining how to run the example.

### Update done.md
Append:
```
- Step 17 ✅ Full sample API (blog-api.tri) compiled end-to-end; output verified runnable; all 8 routes tested with curl/Postman.
```

---

## Step 18 — Mongoose Model Auto-Generation

### What this step does
Add automatic Mongoose model generation so the compiler infers model schemas from `create` and `find` statements without requiring the developer to write schema files.

### Expects from previous step
- Step 17 complete: end-to-end compilation works; the gap between the current output and a fully self-contained output file is clear.

### Tasks
1. Create `src/codegen/models.js` and export `generateModels(ast)`.
2. Walk the full AST and collect every unique model name (capitalised noun from `create user`, `find post`, etc.).
3. For each model, infer its fields from `TakeNode` and `CreateNode` siblings in the same route.
4. Generate a Mongoose schema and model:
   ```js
   const UserSchema = new mongoose.Schema({
     name: String,
     email: { type: String, unique: true },
     password: String,
   }, { timestamps: true });
   const User = mongoose.model('User', UserSchema);
   ```
5. Emit model definitions between the database connection and the route handlers in the compiled output.
6. Re-run the end-to-end test from Step 17 to confirm the compiled output now includes model definitions and is still runnable.

### Produces
- `src/codegen/models.js`
- Updated `examples/blog-api.js` (now includes schema definitions).

### Update done.md
Append:
```
- Step 18 ✅ Mongoose model auto-generation implemented in src/codegen/models.js; schemas inferred from AST; models emitted in compiled output.
```

---

## Step 19 — Documentation

### What this step does
Write all user-facing documentation: the main README, the keyword reference, and the getting-started guide. Documentation must match the spec exactly.

### Expects from previous step
- Step 17 complete: the compiled output is verified and stable — documentation describes real, working behaviour.
- Step 18 complete: model generation is included in the documented behaviour.

### Tasks
1. Rewrite `README.md` to include:
   - The Three Rules (from Section 2 of the spec).
   - Installation: `npm install -g trionary`.
   - Quick start: `trionary init` → edit `app.tri` → `trionary dev`.
   - The side-by-side comparison table (Section 3 of the spec).
   - A link to `docs/KEYWORDS.md`.
2. Create `docs/KEYWORDS.md`:
   - Full reserved keyword table from Section 5 of the spec.
   - One example per keyword.
   - Group by category: server/db, routing, auth, data, response, control flow.
3. Create `docs/GETTING_STARTED.md`:
   - Step-by-step: install → init → write first route → build → run.
   - Shows `trionary init` output, minimal `app.tri`, and the compiled `app.js`.
4. Create `docs/LIMITATIONS.md` documenting the honest reservations from Section 7 (ecosystem, expressiveness ceiling, escape hatch, generated code quality, tooling).
5. Create `docs/ROADMAP.md` from Section 9 of the spec.

### Produces
- Updated `README.md`
- `docs/KEYWORDS.md`
- `docs/GETTING_STARTED.md`
- `docs/LIMITATIONS.md`
- `docs/ROADMAP.md`

### Update done.md
Append:
```
- Step 19 ✅ Full documentation written: README, KEYWORDS, GETTING_STARTED, LIMITATIONS, and ROADMAP docs created in docs/.
```

---

## Step 20 — npm Publish & Public Demo API

### What this step does
Package the compiler, publish it to npm, and deploy a live public demo API built entirely in Trionary — proving the spec's goal: "one developer saying 'I shipped a real backend with this.'"

### Expects from previous step
- All previous steps complete: the compiler is tested, documented, and the sample API runs end-to-end.
- Step 19 complete: documentation is accurate and complete for npm consumers.

### Tasks
1. Update `package.json`:
   - Set `"name": "trionary"`, `"version": "0.1.0"`, `"description": "A plain-English backend language that compiles to Node.js"`.
   - Set `"main": "src/cli/index.js"`, `"bin": { "trionary": "./src/cli/index.js" }`.
   - Add `"keywords": ["compiler", "backend", "nodejs", "express", "plain-english", "dsl"]`.
   - Add `"files": ["src/", "README.md"]` to exclude tests and examples from the npm bundle.
2. Add an `.npmignore` to exclude `tests/`, `examples/`, `.env`, and `done.md`.
3. Run `npm pack` and inspect the tarball to verify only intended files are included.
4. Run `npm publish --access public` to publish to npm.
5. Create `examples/demo-api/`:
   - Write a real, meaningful public API in Trionary (e.g., a URL shortener or bookmark manager).
   - Compile it: `trionary build examples/demo-api/app.tri`.
   - Deploy to a free hosting platform (Railway, Render, or Fly.io) using the compiled Node.js output.
   - Record the live URL and add it to `README.md`.
6. Announce on relevant communities (dev.to, Hacker News, Reddit r/node) with a link to the npm package and the live demo.
7. Tag the git commit as `v0.1.0` and create a GitHub Release with the changelog.

### Produces
- Published `trionary@0.1.0` on npm.
- Live demo API URL added to README.
- GitHub Release `v0.1.0` with changelog.

### Update done.md
Append:
```
- Step 20 ✅ trionary@0.1.0 published to npm; live demo API deployed; GitHub Release v0.1.0 created; project shipped.
```

---

## Summary Table

| Step | Title | Key Output |
|------|-------|-----------|
| 1 | Repository & Project Scaffolding | Folder structure, `package.json`, `done.md` |
| 2 | Token Definitions & Lexer Design | `tokens.js`, `keywords.js`, `patterns.js` |
| 3 | Implement the Lexer | `lexer.js` — `tokenize()` |
| 4 | AST Node Definitions | `ast.js` — 19 node factories |
| 5 | Implement the Parser | `parser.js` — `parse()` |
| 6 | Server, Database & Middleware Codegen | `server.js`, `database.js`, `middleware.js` |
| 7 | Auth Route Code Generation | `auth.js` |
| 8 | CRUD Route Code Generation | `crud.js` |
| 9 | Validation Statement Code Generation | `validate.js` |
| 10 | JWT Auth Middleware Generation | `authMiddleware.js` |
| 11 | Escape Hatch for Inline Node.js | `escape.js`, updated `parser.js` |
| 12 | Error Messaging System | `TrinaryError.js`, `messages.js`, `suggestions.js` |
| 13 | CLI Implementation | `cli/index.js` — init / build / dev |
| 14 | Unit Tests: Lexer | `tests/lexer/lexer.test.js` |
| 15 | Unit Tests: Parser | `tests/parser/parser.test.js` |
| 16 | Unit Tests: Code Generation | `tests/codegen/*.test.js` |
| 17 | End-to-End Compilation of Sample API | `examples/blog-api.tri` + compiled `.js` |
| 18 | Mongoose Model Auto-Generation | `models.js` |
| 19 | Documentation | `README.md`, `docs/` |
| 20 | npm Publish & Public Demo API | `trionary@0.1.0` on npm, live demo |

---

## Plan Validation Notes

The plan in `Trionary_Backend_Spec.docx` is **technically sound**. The compiler pipeline (lexer → parser → AST → codegen) is a well-proven approach. Below are the key risks the plan already acknowledges (Section 7) and how this implementation plan addresses them:

| Risk (from spec) | How this plan addresses it |
|---|---|
| Ecosystem problem (zero plugins, zero tutorials at launch) | Step 20 includes a launch announcement and a live public demo to attract early adopters. |
| Expressiveness ceiling (keywords can't cover every case) | Step 11 ships the escape hatch from day one. Step 19 documents limitations honestly. |
| Escape hatch breaks the readability promise | Step 11 adds a warning comment in the generated output and a CLI warning at build time. |
| Generated code quality | Steps 14–17 include unit and end-to-end tests comparing output to hand-written equivalents. |
| Tooling is 80% of the product | Steps 12–13 prioritise plain-English error messages and a smooth CLI experience before adding features. |
