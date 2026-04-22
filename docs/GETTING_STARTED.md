# Getting Started with Trionary

This guide takes you from a fresh machine to a running Trionary API in five steps.

---

## Prerequisites

- **Node.js ≥ 18** — [nodejs.org](https://nodejs.org)
- **MongoDB** — running locally on the default port (`27017`), or a hosted URI (e.g. MongoDB Atlas)

---

## Step 1 — Install Trionary

```bash
npm install -g trionary
```

Verify the installation:

```bash
trionary --help
# Usage:
#   trionary init
#   trionary build <file>
#   trionary dev <file>
```

---

## Step 2 — Initialise a project

Create a new directory and run `trionary init`:

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

## Next steps

- Browse the full [Keyword Reference](KEYWORDS.md)
- See a complete blog API example in [`examples/blog-api.tri`](../examples/blog-api.tri)
- Review [Limitations](LIMITATIONS.md) before choosing Trionary for a project
