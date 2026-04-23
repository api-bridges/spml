# Trionary — Keyword Reference

All reserved keywords in the Trionary language, grouped by category. Keywords are case-sensitive where shown; HTTP method keywords (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`) are uppercase.

---

## Server & Database

| Keyword | Role | Example |
|---|---|---|
| `server` | Declare the HTTP server and its port | `server port 3000` |
| `port` | Specify the port number (used with `server`) | `server port 8080` |
| `database` | Declare the database connection | `database connect "mongodb://localhost/mydb"` |
| `connect` | Provide the connection URI (used with `database`) | `database connect "mongodb+srv://..."` |

---

## Routing

| Keyword | Role | Example |
|---|---|---|
| `route` | Declare an HTTP route | `route GET /users` |
| `GET` | HTTP GET method | `route GET /posts` |
| `POST` | HTTP POST method | `route POST /register` |
| `PUT` | HTTP PUT method | `route PUT /posts/:id` |
| `PATCH` | HTTP PATCH method | `route PATCH /posts/:id` |
| `DELETE` | HTTP DELETE method | `route DELETE /posts/:id` |

### PUT vs PATCH — codegen behaviour

Trionary generates different update logic depending on the HTTP method of the route that contains an `update` statement:

| Method | Generated code | Semantics |
|---|---|---|
| `PUT` | `Model.updateOne({ _id: req.params.id }, { ...req.body })` | Full document replacement — every field in the Mongoose document is overwritten with the entire request body. |
| `PATCH` | `const updates = {}; if (req.body.<field> !== undefined) …; Model.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true })` | Selective update — only request-body fields that are explicitly present (not `undefined`) are written to the database. Omitted fields retain their existing values. |

**Example — PATCH route:**

```tri
route PATCH /posts/:id
  auth required
  take title, body
  update post with title, body
  return ok
```

Generated output (excerpt):

```js
const updates = {};
if (req.body.title !== undefined) updates.title = req.body.title;
if (req.body.body !== undefined) updates.body = req.body.body;
await Post.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
```

---

## Middleware

| Keyword | Role | Example |
|---|---|---|
| `middleware` | Register a middleware for all routes | `middleware cors` |
| `cors` | Enable CORS via the `cors` package | `middleware cors` |
| `logs` | Enable request logging via `morgan` | `middleware logs` |
| `helmet` | Add security headers via `helmet` | `middleware helmet` |
| `ratelimit` | Limit requests per time window | `middleware ratelimit max 200 per minute` |
| `compress` | Enable gzip compression | `middleware compress` |
| `max` | Set the upper bound (used with `ratelimit`) | `middleware ratelimit max 100 per minute` |
| `per` | Link count to time unit (used with `ratelimit`) | `middleware ratelimit max 100 per minute` |
| `minute` | Time unit for rate limiting | `middleware ratelimit max 100 per minute` |

---

## Authentication

| Keyword | Role | Example |
|---|---|---|
| `auth` | Mark a route as requiring JWT authentication | `auth required` |
| `hash` | Bcrypt-hash a password field | `hash password` |
| `password` | Refers to the `password` field (used with `hash` / `validate`) | `hash password` |
| `token` | Return a signed JWT to the client | `return token` |
| `matches` | Verify a plain password against its bcrypt hash | `validate password is matches` |
| `current` | Refer to the authenticated user (used with `user`) | `return current user` |
| `user` | The authenticated user object | `return current user` |

---

## Data Operations

| Keyword | Role | Example |
|---|---|---|
| `take` | Extract fields from the request body | `take name, email, password` |
| `require` | Assert fields are present; return 400 if not | `require title, body` |
| `validate` | Apply a format or length rule to a field | `validate email is email` |
| `is` | Link a field to its validation rule | `validate email is email` |
| `email` | Validate that a field is a valid email address | `validate email is email` |
| `number` | Validate that a field is a numeric value | `validate age is number` |
| `url` | Validate that a field is a valid URL | `validate website is url` |
| `one` | Part of the `is one of` allowlist rule | `validate role is one of "admin", "user"` |
| `of` | Part of the `is one of` allowlist rule | `validate role is one of "admin", "user"` |
| `min` | Set a minimum length threshold | `validate password min length 8` |
| `max` | Set a maximum length threshold | `validate username min length 3 max length 20` |
| `length` | Refer to the string length (used with `min` / `max`) | `validate password min length 8` |
| `limit` | Set a page size (used with `paginate`) | `paginate post limit 10` |
| `exists` | Query whether a record exists | `exists user where email` |
| `find` | Fetch one or many records from the database | `find post by id` |
| `create` | Insert a new record into the database | `create user with name, email, password` |
| `update` | Update an existing record | `update post with title, body` |
| `delete` | Remove a record from the database | `delete post by id` |
| `paginate` | Fetch a page of records | `paginate post limit 10` |
| `with` | Specify the fields to write (used with `create` / `update`) | `create post with title, body` |
| `where` | Filter by a field value | `find user where email` |
| `by` | Filter or sort by a specific field | `find post by id` |
| `all` | Retrieve every record without filtering | `find all posts` |
| `sorted` | Apply a sort (used with `find all`) | `find all posts sorted by date` |
| `for` | Associate a record with the current user | `create post for user` |
| `check` | Perform an inline assertion | `check email` |

---

## Response

| Keyword | Role | Example |
|---|---|---|
| `return` | Send a response to the client | `return post` |
| `error` | Return an error message (used with `return`) | `return error "Not found" status 404` |
| `status` | Set the HTTP status code (used with `return error`) | `return error "Unauthorised" status 401` |
| `ok` | Return a generic success response | `return ok` |

---

## Control Flow

| Keyword | Role | Example |
|---|---|---|
| `if` | Conditionally execute a statement | `if not found return error "Not found" status 404` |
| `not` | Negate a condition (used with `if`) | `if not valid return error "Invalid" status 401` |
| `found` | Refers to whether the previous `find` succeeded | `if not found return error "Not found" status 404` |

---

## Streaming (Server-Sent Events)

| Keyword | Role | Example |
|---|---|---|
| `stream` | Begin a Server-Sent Events response (used with `events`) | `stream events` |
| `events` | Marks the stream as an SSE event stream (used with `stream`) | `stream events` |

The `stream events` statement compiles to a Server-Sent Events (SSE) Express route that sets the required response headers and flushes them to the client, establishing a persistent push connection.

**Generated output:**

```js
res.setHeader('Content-Type', 'text/event-stream');
res.setHeader('Cache-Control', 'no-cache');
res.setHeader('Connection', 'keep-alive');
res.flushHeaders();
// developer fills in the event data
```

**Example:**

```tri
route GET /events/live
  stream events
```

---

## Validation Rules Reference

The `validate` keyword supports the following rules:

| Syntax | Description | Example |
|---|---|---|
| `validate <field> is email` | Reject non-email-format values | `validate email is email` |
| `validate <field> is number` | Reject non-numeric values | `validate age is number` |
| `validate <field> is url` | Reject invalid URLs (WHATWG URL check) | `validate website is url` |
| `validate <field> is one of "<v1>", "<v2>", …` | Reject values not in the allowlist | `validate role is one of "admin", "user"` |
| `validate <field> min length <n>` | Reject strings shorter than `n` characters | `validate password min length 8` |
| `validate <field> min length <n> max length <m>` | Reject strings outside the `[n, m]` range | `validate username min length 3 max length 20` |

**Examples:**

```tri
route POST /register
  take email, password, username, age, website, role
  validate email is email
  validate password min length 8
  validate username min length 3 max length 20
  validate age is number
  validate website is url
  validate role is one of "admin", "user", "guest"
  create user with email, password, username, age, website, role
  return ok
```
