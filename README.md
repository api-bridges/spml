# Trionary Backend

[![npm version](https://img.shields.io/npm/v/trionary.svg)](https://www.npmjs.com/package/trionary)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Coverage: ≥90%](https://img.shields.io/badge/coverage-%E2%89%A590%25-brightgreen)](https://github.com/api-bridges/spml/actions/workflows/ci.yml)
[![CI](https://github.com/api-bridges/spml/actions/workflows/ci.yml/badge.svg)](https://github.com/api-bridges/spml/actions/workflows/ci.yml)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/trionary.vscode-trionary?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=trionary.vscode-trionary)
[![Docs](https://img.shields.io/badge/docs-api--bridges.github.io%2Fspml-blue)](https://api-bridges.github.io/spml/)

A plain-English backend language that compiles to production-ready Node.js.

---

## The Three Rules

1. **Every line is a complete thought.** There are no semicolons, no braces, and no callback nesting. One idea per line.
2. **Indentation is structure.** A block belongs to its parent by being indented beneath it — exactly like Python or YAML.
3. **Keywords are English words.** The vocabulary is a small, fixed set of plain nouns and verbs. If you can describe what a route does in a sentence, you can write it in Trionary.

---

## Installation

```bash
npm install -g trionary
```

Requires **Node.js ≥ 18**.

---

## Quick Start

```bash
# 1. Scaffold a new project
trionary init

# 2. Edit the generated starter file
# app.tri is created in the current directory

# 3. Start the dev server (builds, runs, and watches for changes)
trionary dev app.tri
```

`trionary init` creates two files:

- **`app.tri`** — a minimal starter with a health-check route
- **`.env`** — pre-populated with `JWT_SECRET=changeme` and `PORT=3000`

---

## Trionary vs. Express (side by side)

| Task | Trionary | Express (Node.js) |
|---|---|---|
| Start a server on port 3000 | `server port 3000` | `const app = express(); app.listen(3000, ...)` |
| Connect to MongoDB | `database connect "mongodb://localhost/myapp"` | `mongoose.connect('mongodb://localhost/myapp', { useNewUrlParser: true, ... })` |
| Add CORS middleware | `middleware cors` | `app.use(cors())` |
| Add rate limiting (200/min) | `middleware ratelimit max 200 per minute` | `app.use(rateLimit({ windowMs: 60000, max: 200 }))` |
| Declare a POST route | `route POST /register` | `app.post('/register', async (req, res) => {` |
| Read request body fields | `take name, email, password` | `const { name, email, password } = req.body;` |
| Validate required fields | `require name, email, password` | `if (!name \|\| !email \|\| !password) return res.status(400).json({ error: '...' });` |
| Validate email format | `validate email is email` | `if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json(...)` |
| Hash a password | `hash password` | `const hashed = await bcrypt.hash(password, 10); req.body.password = hashed;` |
| Check for existing record | `exists user where email` | `const exists = await User.findOne({ email });` |
| Create a record | `create user with name, email, password` | `const user = await User.create({ name, email, password });` |
| Return a JWT | `return token` | `const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' }); res.json({ token });` |
| Guard a route with JWT auth | `auth required` | `app.get('/me', authRequired, async (req, res) => {` |
| Return the current user | `return current user` | `return res.json({ user: req.user });` |
| Paginate a query | `paginate post limit 10` | `const page = parseInt(req.query.page) \|\| 1; Post.find().skip((page-1)*10).limit(10)` |
| Return 404 if not found | `if not found return error "Not found" status 404` | `if (!post) return res.status(404).json({ error: 'Not found' });` |
| Delete a record by ID | `delete post by id` | `await Post.findByIdAndDelete(req.params.id);` |
| Return success | `return ok` | `return res.json({ message: 'ok' });` |

---

## Example

```tri
server port 3000

database connect "mongodb://localhost/myapp"

middleware cors
middleware logs
middleware helmet
middleware ratelimit max 200 per minute

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

route GET /posts
  paginate post limit 10
  return posts

route POST /posts
  auth required
  take title, body
  require title, body
  create post with title, body
  return post
```

Compiles to roughly 200 lines of production-ready Express + Mongoose JavaScript.

---

## Inline Node.js (escape hatch)

When a feature cannot be expressed in Trionary, drop into raw JavaScript with the `js:` block:

```tri
route GET /analytics
  auth required
  js:
    const stats = await Post.aggregate([{ $group: { _id: null, total: { $sum: 1 } } }]);
    return res.json({ total: stats[0]?.total ?? 0 });
```

The indented block is emitted verbatim into the compiled output. A warning comment and a CLI message are added to flag escape-hatch usage.

---

## CLI Reference

| Command | Description |
|---|---|
| `trionary init` | Scaffold `app.tri` and `.env` in the current directory |
| `trionary build <file>` | Compile a `.tri` file → `.js` |
| `trionary dev <file>` | Build, run, and watch for changes |

---

## Documentation

- [📖 Docs Site →](https://api-bridges.github.io/spml/)
- [Keyword Reference →](docs/KEYWORDS.md)
- [Getting Started Guide →](docs/GETTING_STARTED.md)
- [Limitations →](docs/LIMITATIONS.md)
- [Migration: v0 → v1 →](docs/MIGRATION_v0_to_v1.md)
- [Roadmap →](docs/ROADMAP.md)

---

## Demo API

A working URL-shortener API written entirely in Trionary is included in [`examples/demo-api/`](examples/demo-api/).
It demonstrates user auth, CRUD operations, pagination, and rate-limiting — all in under 60 lines of plain-English source.

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

All commits must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification (`feat:`, `fix:`, `docs:`, `chore:`, `BREAKING CHANGE:`). A commitlint hook enforces this automatically when you run `npm install`.
