# Contributing to Trionary

Thank you for your interest in contributing! This document explains the conventions and workflow we use to keep the project healthy and releases fully automated.

---

## Conventional Commits

We use the [Conventional Commits](https://www.conventionalcommits.org/) specification for **every commit message**. This drives our automated changelog and version-bump pipeline (`semantic-release`).

### Format

```
<type>[optional scope]: <short description>

[optional body]

[optional footer(s)]
```

### Allowed types

| Type | When to use | Version bump |
|---|---|---|
| `feat` | A new user-facing feature | Minor (`0.x.0`) |
| `fix` | A bug fix | Patch (`0.0.x`) |
| `docs` | Documentation only | No release |
| `chore` | Tooling, config, or dependency updates | No release |
| `refactor` | Code restructuring with no feature/fix | No release |
| `test` | Adding or fixing tests | No release |
| `perf` | Performance improvements | Patch |
| `ci` | CI/CD configuration changes | No release |
| `BREAKING CHANGE` | Footer that signals a major bump | Major (`x.0.0`) |

### Examples

```
feat: add trionary new interactive project generator
fix: handle missing env variable in server codegen
docs: update GETTING_STARTED with trionary new command
chore: upgrade husky to v9
feat!: remove legacy update codegen path

BREAKING CHANGE: The old full-replace update route is no longer generated. Use PATCH routes with $set semantics instead.
```

A breaking change can also be indicated with a `!` after the type/scope:

```
feat(codegen)!: switch Mongoose model emit to typed fields by default
```

---

## Commit validation (commitlint + husky)

A [commitlint](https://commitlint.js.org/) pre-commit hook automatically validates every commit message against the Conventional Commits rules. The hook is managed by [husky](https://typicode.com/husky).

Set up the hooks after cloning:

```bash
npm install
```

> **Note:** npm automatically runs the `prepare` script (which installs the husky hooks) as part of `npm install`, so no extra step is needed.

If a commit message fails validation, the commit is rejected with a clear error message.

---

## Pull Requests

1. Fork the repo and create a feature branch from `main`.
2. Make your changes with well-scoped Conventional Commits.
3. Open a PR against `main`.
4. CI runs tests and linting automatically.
5. Once merged to `main`, `semantic-release` automatically:
   - Determines the next version number from commit types.
   - Generates/updates `CHANGELOG.md`.
   - Publishes the new version to npm.
   - Creates a GitHub Release with release notes.

---

## Development

```bash
# Install dependencies (also sets up husky hooks)
npm install

# Run tests
npm test

# Lint
npx eslint src/
```

---

## Reporting issues

Open an issue on [GitHub Issues](https://github.com/api-bridges/spml/issues). Please include:
- Trionary version (`trionary --version`)
- Node.js version (`node --version`)
- A minimal `.tri` file that reproduces the problem
- The error message or unexpected output
