# Trionary — Limitations

Trionary is designed to make the common 80 % of a REST API trivial to write. This document honestly describes the cases where it falls short, so you can make an informed decision about whether it is the right tool for your project.

---

## 1. Ecosystem problem

Trionary has no plugins, no middleware extensions, and no community tutorials at launch. Every popular Node.js framework has years of Stack Overflow answers, blog posts, and third-party integrations. Trionary has none of those yet.

**What this means in practice:**
- When you hit an edge case not covered by the keyword set, you must either use the escape hatch (see below) or rewrite the route in plain Express.
- Debugging compiled output requires understanding the generated Node.js code, not the Trionary source.

**Mitigation:** The [escape hatch](#3-escape-hatch-breaks-the-readability-promise) lets you drop to raw Node.js for any single route or statement. If more than ~20 % of your routes need escape hatches, plain Express is probably the better choice.

---

## 2. Expressiveness ceiling

The Trionary keyword set is deliberately small and fixed. Complex business logic — conditional chains, loops, external API calls, streaming responses, WebSocket handlers, background jobs — cannot be expressed in Trionary syntax.

**Examples of things Trionary cannot express natively:**
- `if (user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });`
- `for (const item of cart.items) { await processItem(item); }`
- File uploads, multipart form data
- Server-sent events or WebSockets
- Transactions across multiple MongoDB collections

**Mitigation:** Use the `js:` escape hatch for any statement that exceeds the keyword vocabulary.

---

## 3. Escape hatch breaks the readability promise

The core value of Trionary is that a non-developer can read a `.tri` file and understand what the API does. The moment you add a `js:` block, that promise is broken for that route.

**What the compiler does to flag this:**
- A `// --- trionary escape hatch: raw Node.js below ---` comment is injected before the raw code in the compiled output.
- The CLI prints: `⚠ Escape hatch used at line <n>. Output is not validated by Trionary.`

The escape hatch is a safety valve, not a feature to use by default.

---

## 4. Generated code quality

The code Trionary generates is correct and production-safe, but it is not hand-crafted. Specific known trade-offs:

- **No partial updates:** `update post with title, body` always sends both fields. A partial PATCH that only updates provided fields requires an escape hatch.
- **No field-level MongoDB operators:** `$inc`, `$push`, `$pull`, etc. are not in the keyword set.
- **No relations / population:** `populate('author')` and similar Mongoose calls are not supported.
- **No custom Mongoose schema options:** Field types are inferred as `String` for everything except fields named `password`. There is no way to declare `Number`, `Date`, `Boolean`, or `ObjectId` fields in Trionary syntax today.
- **No transactions:** Multi-document transactions are not supported.
- **Error handling is generic:** Every route wraps its body in `try/catch` and returns `{ error: err.message }` on failure. Custom error shapes require an escape hatch.

---

## 5. Tooling is 80 % of the product

The Trionary CLI and error messages cover the happy path well, but editor support (syntax highlighting, autocompletion, inline errors) does not exist at launch. You will write `.tri` files in a plain-text editor without any language-server assistance.

**What is missing at v0.1:**
- VS Code extension / syntax highlighting
- Language Server Protocol (LSP) implementation
- Import / dependency auto-install (you must run `npm install` manually after `trionary build`)
- Type-checking or schema validation of field names

---

## Summary

| Limitation | Workaround |
|---|---|
| Missing keyword for a feature | Use `js:` escape hatch |
| Complex conditional or loop logic | Use `js:` escape hatch |
| Custom Mongoose schema types | Use `js:` escape hatch or edit compiled output |
| No editor support | Write `.tri` files as plain text; compile and test often |
| No plugins or community content | Refer to the compiled Express/Mongoose output for debugging |
| Generated code not hand-crafted | Review and customise the compiled `.js` file for production-critical routes |
