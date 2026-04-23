# Plugin API

Trionary ships with a public plugin API that lets third-party authors extend the compiler — adding new keywords, AST node factories, and code-generation emitters — without forking the project.

---

## Quick start

### 1. Create a plugin file

A plugin is any JavaScript module that exports a `register(api)` function.

```js
// my-plugin.js
export function register(api) {
  api.registerKeyword('payment');
  api.registerASTNode('Payment', ({ amount }) => ({ type: 'Payment', amount }));
  api.registerEmitter('Payment', (node) => `// charge ${node.amount}`);
}

export default { register };
```

### 2. Create `trionary.config.js` in your project root

```js
// trionary.config.js
import myPlugin from './my-plugin.js';

export default {
  plugins: [myPlugin],
};
```

### 3. Run the compiler

The Trionary CLI automatically loads `trionary.config.js` before compiling.

```bash
trionary build app.tri
```

---

## API reference

All three registration functions are available on the `api` object passed to `register(api)`.

### `api.registerKeyword(name)`

Registers a new reserved keyword so the lexer classifies it as a `KEYWORD` token instead of an `IDENTIFIER`.

| Parameter | Type     | Description                        |
|-----------|----------|------------------------------------|
| `name`    | `string` | The keyword text, e.g. `'stripe'`. |

```js
api.registerKeyword('stripe');
api.registerKeyword('webhook');
```

Multiple calls for the same keyword are safe (idempotent).

---

### `api.registerASTNode(name, factory)`

Registers an AST node factory function. The parser (or other plugins) can then call this factory to produce typed AST nodes.

| Parameter | Type                        | Description                                              |
|-----------|-----------------------------|----------------------------------------------------------|
| `name`    | `string`                    | Node type identifier, e.g. `'StripeWebhook'`.            |
| `factory` | `(args: object) => object`  | Function that receives an argument object and returns an AST node with at least a `type` field. |

```js
api.registerASTNode('StripeWebhook', ({ path }) => ({
  type: 'StripeWebhook',
  path,
}));
```

Registered factories are accessible via the `astNodes` map exported from `src/plugin/index.js`.

---

### `api.registerEmitter(nodeType, emitterFn)`

Registers a code-generation emitter for a given AST node type. When the Trionary compiler encounters a node whose type is not handled by the built-in switch statement, it looks up the plugin emitter registry and calls the matching function.

| Parameter   | Type                                         | Description                                          |
|-------------|----------------------------------------------|------------------------------------------------------|
| `nodeType`  | `string`                                     | The AST `type` string, e.g. `'StripeWebhook'`.       |
| `emitterFn` | `(node: object, context?: object) => string` | Function that receives the AST node and returns generated JavaScript as a string. |

```js
api.registerEmitter('StripeWebhook', (node) => {
  return `app.post('${node.path}', stripeWebhookHandler);`;
});
```

---

## Reference plugin

`examples/plugins/stripe-webhook.js` shows a complete plugin that:

1. Registers the keywords `stripe` and `webhook`.
2. Registers a `StripeWebhook` AST node factory.
3. Emits an Express POST route with Stripe signature verification.

```js
import stripeWebhookPlugin from './plugins/stripe-webhook.js';

export default {
  plugins: [stripeWebhookPlugin],
};
```

---

## How the config loader works

When any `trionary` CLI command runs, `src/cli/config.js` is invoked first:

1. It looks for `trionary.config.js` in the current working directory.
2. If found, it dynamically imports the file.
3. For each entry in `config.plugins`, it calls `plugin.register(pluginAPI)`.
4. It then calls `applyKeywords(KEYWORDS)` to merge newly registered keywords into the live lexer keyword set.

If `trionary.config.js` does not exist the CLI continues without error.

---

## Advanced: importing plugin internals

For unit tests or custom tooling you can import the registry directly:

```js
import {
  registerKeyword,
  registerASTNode,
  registerEmitter,
  applyKeywords,
  emitters,
  astNodes,
  _resetRegistry,  // test helper — clears all registry state
} from 'trionary/src/plugin/index.js';
```
