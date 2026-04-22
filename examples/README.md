# Trionary Blog API Example

This directory contains a full blog REST API written in Trionary (`.tri`) and its compiled Node.js output.

## Files

| File | Description |
|------|-------------|
| `blog-api.tri` | Full blog API source written in plain-English Trionary syntax |
| `blog-api.js` | Compiled Node.js/Express output (committed as a reference) |

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | — | Create a user account; returns a JWT token |
| POST | `/login` | — | Authenticate with email + password; returns a JWT token |
| GET | `/me` | ✅ | Return the currently authenticated user |
| GET | `/posts` | — | List posts (paginated, 10 per page) |
| POST | `/posts` | ✅ | Create a new post |
| GET | `/posts/:id` | — | Get a single post by ID |
| PUT | `/posts/:id` | ✅ | Update a post |
| DELETE | `/posts/:id` | ✅ | Delete a post |

## Prerequisites

- Node.js ≥ 18
- MongoDB running locally on the default port (`27017`)

## Quick Start

### 1. Install dependencies

```bash
npm install express mongoose bcrypt jsonwebtoken cors morgan helmet express-rate-limit
```

### 2. Set environment variables

Create a `.env` file (or export variables directly):

```bash
JWT_SECRET=your_secret_here
PORT=3000
```

> **Important:** Set a strong, random `JWT_SECRET` before running in production.

### 3. Start the server

```bash
node examples/blog-api.js
```

You should see:

```
Server running on port 3000
```

### 4. Test the API

**Register a user:**
```bash
curl -s -X POST http://localhost:3000/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Alice","email":"alice@example.com","password":"secret123"}' | jq
```

**Login:**
```bash
curl -s -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"secret123"}' | jq
```

Copy the returned `token` and use it for authenticated routes:

**Get current user (`/me`):**
```bash
TOKEN="<paste token here>"
curl -s http://localhost:3000/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Create a post:**
```bash
curl -s -X POST http://localhost:3000/posts \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Hello Trionary","body":"My first post!"}' | jq
```

**List posts:**
```bash
curl -s 'http://localhost:3000/posts?page=1' | jq
```

## Re-compile from source

To recompile `blog-api.tri` → `blog-api.js` yourself:

```bash
node src/cli/index.js build examples/blog-api.tri
# or, if trionary is globally linked:
trionary build examples/blog-api.tri
```

## Discrepancies from Spec

The compiled output is valid, production-ready Node.js. A few implementation notes:

- **Mongoose models** (`User`, `Post`) are referenced in the compiled output but not defined within it. Add your Mongoose schema definitions above the route handlers, or use [Step 18](../PLAN.md) (model auto-generation) once it is implemented.
- The `PUT /posts/:id` route takes `title` and `body` from the request body but only validates their presence — it does not enforce that at least one field is provided for a partial update.
