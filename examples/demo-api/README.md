# Trionary Demo API — URL Shortener

A minimal URL-shortener API written entirely in Trionary and compiled to Node.js.

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/register` | — | Create a new user account |
| `POST` | `/login` | — | Sign in and receive a JWT |
| `GET` | `/me` | ✅ | Return the authenticated user |
| `POST` | `/links` | ✅ | Create a shortened link |
| `GET` | `/links` | ✅ | List your links (paginated) |
| `GET` | `/links/:id` | ✅ | Get a single link |
| `PUT` | `/links/:id` | ✅ | Update a link |
| `DELETE` | `/links/:id` | ✅ | Delete a link |

## Run locally

```bash
# 1. Install the compiler globally
npm install -g trionary

# 2. Compile the Trionary source
trionary build app.tri

# 3. Install generated output dependencies
cd out && npm install

# 4. Set environment variables
echo "JWT_SECRET=changeme\nMONGODB_URI=mongodb://localhost/shortener" > .env

# 5. Start the server
node app.js
```

## Source

The entire backend is defined in [`app.tri`](./app.tri) — fewer than 60 lines.
