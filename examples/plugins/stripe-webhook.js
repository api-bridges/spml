// examples/plugins/stripe-webhook.js
// Reference Trionary plugin — adds a `stripe webhook` keyword pair.
//
// When the Trionary compiler encounters a StripeWebhook AST node it emits an
// Express POST route that verifies the Stripe webhook signature and dispatches
// the event to a handler function.
//
// Usage in trionary.config.js:
//
//   import stripeWebhookPlugin from './plugins/stripe-webhook.js';
//   export default { plugins: [stripeWebhookPlugin] };
//
// Usage in a .tri source file (after parsing support is added via plugin):
//
//   stripe webhook /stripe/events

/**
 * The AST node factory for a StripeWebhook node.
 *
 * @param {{ path: string }} args
 * @returns {{ type: 'StripeWebhook', path: string }}
 */
function StripeWebhookNode({ path }) {
  return { type: 'StripeWebhook', path };
}

/**
 * Codegen emitter for StripeWebhook nodes.
 * Emits an Express POST route with Stripe signature verification.
 *
 * @param {{ type: 'StripeWebhook', path: string }} node
 * @returns {string}
 */
function emitStripeWebhook(node) {
  const routePath = node.path || '/stripe/events';
  return [
    `// Stripe webhook handler — verifies signature and dispatches event`,
    `app.post(${JSON.stringify(routePath)}, express.raw({ type: 'application/json' }), (req, res) => {`,
    `  const sig = req.headers['stripe-signature'];`,
    `  let event;`,
    `  try {`,
    `    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);`,
    `  } catch (err) {`,
    `    return res.status(400).send(\`Webhook Error: \${err.message}\`);`,
    `  }`,
    `  // Dispatch event`,
    `  switch (event.type) {`,
    `    case 'payment_intent.succeeded':`,
    `      // TODO: handle payment success`,
    `      break;`,
    `    default:`,
    `      console.log(\`Unhandled event type \${event.type}\`);`,
    `  }`,
    `  res.json({ received: true });`,
    `});`,
  ].join('\n');
}

/**
 * Plugin registration hook called by the Trionary config loader.
 *
 * @param {import('../../src/plugin/index.js').pluginAPI} api
 */
export function register(api) {
  // Register the two keywords so the lexer classifies them correctly.
  api.registerKeyword('stripe');
  api.registerKeyword('webhook');

  // Register the AST node factory.
  api.registerASTNode('StripeWebhook', StripeWebhookNode);

  // Register the codegen emitter.
  api.registerEmitter('StripeWebhook', emitStripeWebhook);
}

export default { register };
