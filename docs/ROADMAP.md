# Trionary — Roadmap

This document lists planned improvements in rough priority order. Nothing here is committed to a specific release date.

---

## Near-term (v0.2)

### Editor tooling
- **VS Code extension** — syntax highlighting for `.tri` files.
- **Language Server Protocol (LSP)** — autocomplete for keywords, inline error underlines, go-to-definition for model names.

### Richer schema types
- Declare field types explicitly in the Trionary source:
  ```tri
  create post with title: String, views: Number, published: Boolean
  ```
- Generate the correct Mongoose schema field type instead of defaulting everything to `String`.

### Relationships & population
- Support `populate` for Mongoose references:
  ```tri
  find post by id
  populate post.author
  return post
  ```

### Partial updates
- `update` should only write fields that are present in the request body:
  ```tri
  route PATCH /posts/:id
    auth required
    take title, body
    update post with title, body  # only updates provided fields
    return ok
  ```

---

## Medium-term (v0.3)

### More validation rules
Extend the `validate` keyword beyond `is email` and `min length`:
- `validate age is number`
- `validate username min length 3 max length 20`
- `validate url is url`
- `validate status is one of "draft", "published"`

### Middleware extensibility
Let users register custom middleware by npm package name:
```tri
middleware stripe webhooks
middleware passport jwt
```

### Multi-database support
Support databases beyond MongoDB:
- PostgreSQL via Prisma or Sequelize
- SQLite for development / testing

### Environment-aware configuration
```tri
server port env PORT
database connect env DATABASE_URL
```

---

## Longer-term (v1.0)

### Streaming & real-time
- Server-sent events:
  ```tri
  route GET /stream
    stream events
  ```
- WebSocket support.

### Background jobs
- Scheduled tasks and queue-based jobs using a simple keyword:
  ```tri
  job daily at midnight
    delete all expired sessions
  ```

### Multi-file projects
- `import` keyword to split a large API across multiple `.tri` files:
  ```tri
  import routes from "./posts.tri"
  import routes from "./users.tri"
  ```

### Testing language
- Built-in test syntax that compiles to Jest:
  ```tri
  test "POST /register creates a user"
    send POST /register with name "Alice", email "alice@example.com", password "secret"
    expect status 200
    expect body.token exists
  ```

### Plugin API
- A JavaScript API that lets library authors add new keywords without forking the compiler.

---

## Community goals

- Publish `trionary` to npm and maintain semantic versioning.
- Maintain a public changelog.
- Accept external contributions via GitHub Issues and Pull Requests.
- Produce written tutorials and video walkthroughs.
- Build a showcase of real APIs written in Trionary.
