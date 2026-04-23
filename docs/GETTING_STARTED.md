# Getting Started with Trionary

This guide takes you from a fresh machine to a running Trionary API in five steps.

---

## Prerequisites

- **Node.js ≥ 18** — [nodejs.org](https://nodejs.org)
- **MongoDB** — running locally on the default port (`27017`), or a hosted URI (e.g. MongoDB Atlas), unless you choose PostgreSQL or SQLite.

---

## Step 1 — Install Trionary

```bash
npm install -g trionary
```

Verify the installation:

```bash
trionary --help
# Usage:
#   trionary new [project-name]
#   trionary init
#   trionary build <file>
#   trionary dev <file>
```

---

## Step 2 — Create a new project with `trionary new`

`trionary new` is the fastest way to get started. It scaffolds a full project directory, prompts you for the database type, authentication, and starter routes, then runs `npm install` for you.

```bash
trionary new my-api
```

You will be asked four short questions:

```
? Project name: my-api
? Database type: › MongoDB (Mongoose)
? Include authentication routes (register / login / /me)? › Yes
? Starter routes: › Blog (posts + users)
```

When the command completes, your project is ready:

```
✅  Created my-api/
   my-api/app.tri
   my-api/.env
   my-api/package.json

📦  Installing dependencies…

🎉  Your project is ready!

   Next steps:

     cd my-api
     trionary dev app.tri
```

### What gets created

| File | Purpose |
|---|---|
| `app.tri` | Trionary source file pre-filled with the routes you chose |
| `.env` | Environment variables (port, database URL, JWT secret) |
| `package.json` | Minimal npm package descriptor |

> **Important:** Change `JWT_SECRET` in `.env` to a long random string before deploying to production.

### Prompt options

| Prompt | Options |
|---|---|
| Database type | `MongoDB (Mongoose)`, `PostgreSQL (Prisma)`, `SQLite (Prisma)` |
| Authentication | `Yes` / `No` — adds register, login, and `/me` routes |
| Starter routes | `Blog (posts + users)`, `E-commerce (products + orders)`, `Blank` |

---

## (Alternative) Initialise a minimal project manually

If you prefer a bare-bones starting point, create a new directory and run `trionary init`:

```bash
mkdir my-api && cd my-api
trionary init
```

Output:

```
✅ Trionary project initialised. Edit app.tri then run: trionary dev
```

Two files are created:

```
my-api/
├── app.tri    ← your Trionary source file
└── .env       ← JWT_SECRET and PORT
```

The generated **`app.tri`**:

```tri
server port 3000

database connect "mongodb://localhost/myapp"

middleware cors
middleware logs

route GET /health
  return ok
```

The generated **`.env`**:

```
JWT_SECRET=changeme
PORT=3000
```

> **Important:** Change `JWT_SECRET` to a long random string before deploying to production.

---

## Step 3 — Write your first route

Open `app.tri` in any editor and add a route. Here is a minimal API with user registration and a protected profile endpoint:

```tri
server port 3000

database connect "mongodb://localhost/myapp"

middleware cors
middleware logs

route POST /register
  take name, email, password
  require name, email, password
  validate email is email
  exists user where email
  if exists return error "Email already in use" status 409
  hash password
  create user with name, email, password
  return token

route GET /me
  auth required
  return current user
```

Save the file.

---

## Step 4 — Build

Compile `app.tri` to Node.js:

```bash
trionary build app.tri
# ✅ Compiled to /path/to/my-api/app.js
```

The compiled **`app.js`** (abbreviated):

```js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect('mongodb://localhost/myapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(cors());
app.use(morgan('dev'));

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);

const authRequired = (req, res, next) => { /* ... JWT verification ... */ };

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing required fields: ...' });
    /* email validation, exists check, bcrypt hash, User.create, jwt.sign ... */
    return res.json({ token });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/me', authRequired, async (req, res) => {
  try {
    return res.json({ user: req.user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
```

---

## Step 5 — Run

Install the compiled file's runtime dependencies, then start the server:

```bash
npm install express mongoose bcrypt jsonwebtoken cors morgan
node app.js
# Server running on port 3000
```

Test your API:

```bash
# Register
curl -s -X POST http://localhost:3000/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","password":"secret123"}' | jq

# Use the returned token for protected routes
TOKEN="<paste token here>"
curl -s http://localhost:3000/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Development mode (watch + auto-restart)

Use `trionary dev` instead of `trionary build` to get hot-reload on save:

```bash
trionary dev app.tri
# ✅ Compiled to app.js
# 🔄 Watching app.tri for changes...
```

Every time you save `app.tri`, Trionary rebuilds and restarts the server automatically.

---

## Environment configuration

Trionary source files can reference environment variables for the server port
and database URL so that the same `.tri` file runs unmodified across
development, staging, and production.

Use the `env` keyword in place of a literal value:

```tri
server port env PORT

database connect env MONGODB_URI
```

When Trionary compiles this file it emits:

```js
const PORT = process.env.PORT || 3000;
// …
mongoose.connect(process.env.MONGODB_URI, { … });
```

A `.env.example` file is also written alongside the compiled output so that
every variable name is documented:

```
PORT=
MONGODB_URI=
```

Copy `.env.example` to `.env` and fill in the values before running the server:

```bash
cp .env.example .env
# Edit .env and set PORT and MONGODB_URI
node app.js
```

> **Tip:** Both literal values (`server port 3000`) and env-var references
> (`server port env PORT`) are valid. Mix them freely — only the declarations
> that use `env` will appear in `.env.example`.

---

## Testing your API

Trionary has a built-in test DSL that compiles to Jest + supertest. Write `test` blocks directly in your `.tri` file (or in a companion `.tri.test` file) and run them with `trionary test`.

### Writing test blocks

```tri
test "POST /register creates a user"
  send POST /register with name "Alice", email "alice@example.com", password "secret"
  expect status 200
  expect body.token exists

test "GET /posts returns a list"
  send GET /posts
  expect status 200
```

**Supported assertions:**

| Assertion | Compiled Jest assertion |
|---|---|
| `expect status 200` | `expect(res.status).toBe(200)` |
| `expect body.token exists` | `expect(res.body.token).toBeDefined()` |
| `expect body.message "ok"` | `expect(res.body.message).toBe('ok')` |

### Running tests

```bash
trionary test app.tri
# ✅ Test file written to app.test.js
# (Jest runs the compiled test file)
```

Trionary compiles the `test` blocks to a Jest file (`app.test.js`) alongside your source, then invokes Jest automatically.

---

## Next steps

- Browse the full [Keyword Reference](KEYWORDS.md)
- See a complete blog API example in [`examples/blog-api.tri`](../examples/blog-api.tri)
- Review [Limitations](LIMITATIONS.md) before choosing Trionary for a project

---

## Quick start with SQLite

SQLite is a zero-install, file-based database that is ideal for rapid prototyping and local development. Use `database type sqlite` in your `.tri` file — no external database server is required.

### 1 — Declare the SQLite backend

```tri
server port 3000

database type sqlite

middleware cors
middleware logs

route GET /notes
  find all note sorted by createdAt
  return notes

route POST /notes
  take title, content
  require title
  create note with title, content
  return note
```

### 2 — Build

```bash
trionary build app.tri
# ✅ Compiled to app.js
# ✅ Written schema.prisma
```

Trionary emits two files:

| File | Purpose |
|---|---|
| `app.js` | Compiled Express/Prisma server |
| `schema.prisma` | Prisma schema with `provider = "sqlite"` and `url = "file:./dev.db"` |

### 3 — Initialise Prisma and run the server

```bash
npm install @prisma/client express
npx prisma generate          # generate the Prisma client
npx prisma db push           # create dev.db and apply the schema
node app.js
# Server running on port 3000
```

A `dev.db` SQLite file is created automatically in the project directory.

### 4 — Switch to SQLite via the CLI flag

You can also force any `.tri` file to use SQLite at build time without modifying the source:

```bash
trionary build app.tri --db sqlite
```

> **Tip:** SQLite is intended for development only. Switch to `database type postgres` (or `--db postgres`) when deploying to production.

A full example is available at [`examples/sqlite-api.tri`](../examples/sqlite-api.tri).
