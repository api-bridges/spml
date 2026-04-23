# Trionary — Migration Guide: v0.1.0 → v1.0.0

This document lists all breaking changes and new keywords introduced between **v0.1.0** and **v1.0.0**. Read it before upgrading an existing project.

---

## Breaking Changes

### 1. `update` now uses `$set` semantics by default on `PATCH` routes

In v0.1.0, every `update` statement performed a full document replacement regardless of HTTP method.

**v0.1.0 behaviour:**
```tri
route PUT /posts/:id
  update post with title, body   # emitted: Model.updateOne({_id: id}, {title, body})
```

**v1.0.0 behaviour:**
- `PUT` routes still perform a full replacement (unchanged).
- `PATCH` routes now emit a selective `$set` update — only fields present in the request body are written; omitted fields retain their current values.

**Action required:** If you were relying on a `PATCH` route to perform a full replacement, switch it to `PUT`.

---

### 2. `database` keyword accepts a `type` qualifier

Multi-database support was added in v0.3. The `database` line now optionally accepts a `type` specifier that changes the generated ORM/query layer.

```tri
# MongoDB (default — no change required)
database connect "mongodb://localhost/myapp"

# PostgreSQL via Prisma (new)
database type postgres connect env DATABASE_URL

# SQLite via Prisma (new)
database type sqlite connect "file:./dev.db"
```

**Action required:** Existing MongoDB projects require no change. If you use the new `type` qualifiers, Prisma-based code is generated instead of Mongoose.

---

### 3. `middleware` now supports npm package names (custom middleware)

In v0.3, the `middleware` keyword was extended to accept arbitrary npm package names as a custom-middleware shorthand. Built-in middleware names (`cors`, `logs`, `helmet`, `ratelimit`) continue to work as before.

```tri
# v0.1.0 — built-in only
middleware cors
middleware ratelimit max 200 per minute

# v1.0.0 — custom npm package (new)
middleware stripe webhooks
middleware passport jwt
```

**Action required:** No change needed for existing built-in middleware declarations.

---

## New Keywords (v0.2 – v1.0)

### Field type declarations (v0.2)

Mongoose schema fields can now be typed explicitly:

```tri
create post with title: String, views: Number, published: Boolean, createdAt: Date
```

Previously all fields defaulted to `String`.

---

### `populate` (v0.2)

Populate a Mongoose reference field in a read route:

```tri
find post by id
populate post.author
return post
```

ObjectId ref fields are declared with `ref`:

```tri
create post with title: String, author: ref User
```

---

### Additional validation rules (v0.3)

Four new rules for the `validate` keyword:

| Rule | Example |
|---|---|
| `is number` | `validate age is number` |
| `min length N max length M` | `validate username min length 3 max length 20` |
| `is url` | `validate website is url` |
| `is one of` | `validate status is one of "draft", "published"` |

---

### `env` keyword (v0.3)

Reference environment variables in `server` and `database` declarations:

```tri
server port env PORT
database connect env DATABASE_URL
```

A `.env.example` file is auto-generated when `env` references are present.

---

### `import routes from` (v1.0)

Split a large API across multiple `.tri` files:

```tri
import routes from "./posts.tri"
import routes from "./users.tri"
```

Circular imports are detected and reported as a compile-time error.

---

### `stream events` (v1.0)

Emit a Server-Sent Events route skeleton:

```tri
route GET /events
  stream events
```

---

### `socket` (v1.0)

Emit a WebSocket handler attached to the HTTP server:

```tri
route socket /chat
  ...
```

---

### `job` (v1.0)

Schedule background tasks using cron shorthands:

```tri
job daily at midnight
  delete all expired sessions

job every 5 minutes
  refresh cache
```

Compiles to `node-cron` expressions.

---

### `test` DSL (v1.0)

Write route tests inline — they compile to Jest + supertest:

```tri
test "POST /register creates a user"
  send POST /register with name "Alice", email "alice@example.com", password "secret"
  expect status 200
  expect body.token exists
```

Run tests with:

```bash
trionary test app.tri
```

---

### Plugin API (v1.0)

Register custom keywords, AST nodes, and emitters without forking the compiler:

```js
// trionary.config.js
export default {
  plugins: [myCustomPlugin],
};
```

See [PLUGIN_API.md](PLUGIN_API.md) for the full API reference.

---

### `trionary new` command (v1.0)

Interactive project generator that prompts for database type, auth, and starter routes and scaffolds a ready-to-run project:

```bash
trionary new
```

---

## Upgrade Checklist

1. **Update the package:**
   ```bash
   npm install -g trionary@1.0.0
   ```
2. Review any `PATCH` routes that relied on full-replacement semantics and switch them to `PUT` if needed.
3. Add explicit field types to your `create` and `update` statements to take advantage of correct Mongoose/Prisma schema generation.
4. Run `trionary build` and verify the compiled output is correct before deploying.
