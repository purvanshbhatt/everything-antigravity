---
name: payments-stripe
description: >-
  Integrates Stripe payments in test mode: Checkout vs Payment Element with
  PaymentIntents, products and prices, subscriptions and the customer portal,
  webhooks as the source of truth, Strong Customer Authentication, idempotency
  keys, refunds and disputes, and local testing with the Stripe CLI and test
  cards. Use when adding checkout or subscriptions, handling payment
  webhooks, or debugging failed payments. Agent-run flows use test mode only.
---

# Payments with Stripe

Payment bugs cost real money and trust: double charges from retried requests,
access granted on a redirect that never paid, subscriptions that stay active
after a failed renewal. Let Stripe host the card collection, make webhooks the
only source of truth for fulfilment, key every mutation for idempotency, and
rehearse every path in test mode. This is engineering guidance, not legal,
tax or financial advice; involve qualified professionals for compliance, tax
and accounting decisions.

**Safety rules for agents:**

- Agents use test keys only (`sk_test_`, `rk_test_`, `pk_test_`) or a Stripe sandbox. If a live key (`sk_live_`, `rk_live_`) is configured where the agent runs, stop and ask the user to switch.
- Never create live charges, refunds, payouts or customer emails. Going live, refunding real payments and answering disputes are done by the user in the Dashboard.
- Never print, log or commit secret keys or webhook secrets; load them from Secret Manager or environment files excluded from version control.

## When to use

- Adding one-off payments, carts, subscriptions, trials or usage-based billing.
- Wiring Stripe webhooks, the customer portal or saved payment methods.
- Debugging declines, `requires_action` loops, duplicate charges or subscription status drift.

## When not to use

- Webhook mechanics in general (signatures, retries, SSRF): use `webhooks`.
- Internal ledgers, reconciliation and money movement between accounts: use `fintech-ledgers`.
- PCI scope and SAQ questions: use `pci-dss` (not legal advice).
- What to charge and how to package plans: use `pricing-strategy`.

## Workflow

1. **Confirm the mode before any API call.** Check the configured key prefix in scripts and tests the agent runs, and fail closed on anything but a test key.

   **Check:** The guard in the example below throws when given a live-key prefix.

2. **Choose the integration.** Use the table below. Default to Checkout (hosted or embedded); it handles SCA, wallets, local payment methods, tax collection options and receipts, and keeps card data off your servers.

   **Check:** You can name the feature Checkout lacks before choosing the Payment Element.

3. **Model products and prices in Stripe.** Create Products and Prices (with `lookup_key`s) in test mode; the server sends a price ID, never an amount from the client. Amounts are integers in the smallest currency unit (cents), and zero-decimal currencies such as JPY have no minor unit.

   **Check:** `grep_search` finds no client-supplied amounts and no floating-point money math.

4. **Create sessions server-side with idempotency keys.** Link the session to your order (`client_reference_id`, `metadata.orderId`), reuse the Stripe Customer for returning users, and pass an idempotency key derived from your own entity and version so retries never create duplicates.

   **Check:** Calling the endpoint twice for the same order version returns the same session.

5. **Fulfil only from verified webhooks.** Verify with `stripe.webhooks.constructEvent` on the raw body; deduplicate by `event.id`; return 2xx fast and process asynchronously. Grant access on `checkout.session.completed` when `payment_status` is `paid`, and on `checkout.session.async_payment_succeeded` for delayed methods. The `success_url` redirect is UX only.

   **Check:** Closing the browser before the redirect still fulfils the order once.

6. **Drive subscriptions from subscription state.** Store the subscription ID, `status` and current period end; grant access for `active` and `trialing`, decide a grace policy for `past_due`, revoke on `canceled` or `unpaid`. Listen to `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid` and `invoice.payment_failed`. Use the customer portal (`stripe.billingPortal.sessions.create`) for plan changes, payment methods and cancellation.

   **Check:** Test-clock simulations of renewal, failed renewal and cancellation produce the right access state.

7. **Handle SCA and saved cards.** On-session confirmation handles 3D Secure automatically. To charge later, save the method with `setup_future_usage: 'off_session'` or a SetupIntent; off-session charges can still fail with `authentication_required`, so email the customer a link to complete payment on-session.

   **Check:** The `4000 0025 0000 3155` test card completes the authentication flow end to end.

8. **Rehearse refunds and disputes in test mode.** `stripe.refunds.create({ payment_intent, amount })` for full or partial refunds; handle `charge.refunded` and `charge.dispute.created` to update orders and alert staff. Real refunds and dispute evidence are submitted by the user.

   **Check:** A test refund updates the order state through the webhook, not the API response alone.

9. **Test every path locally.** `stripe listen --forward-to localhost:4242/stripe/webhook` (it prints the test signing secret), `stripe trigger checkout.session.completed`, `stripe logs tail`. Run the test-card matrix below.

   **Check:** Success, decline, insufficient funds and authentication paths all have automated or scripted tests.

10. **Hand the go-live checklist to the user.** Live keys in Secret Manager, a live webhook endpoint with its own secret, Radar rules, tax configuration, statement descriptor, receipts, and legal pages reviewed by a professional. The agent does not flip to live mode.

    **Check:** The checklist is delivered as an artifact, with live-mode steps assigned to the user.

## Patterns

### Integration options

| Option | Use when | You build |
| :--- | :--- | :--- |
| Payment Links | No code, simple products | Nothing; share a link |
| Checkout (hosted or embedded) | Default for payments and subscriptions | Session creation and webhooks |
| Payment Element with PaymentIntents | Fully custom checkout UI | Client confirmation, status handling, webhooks |
| Billing APIs directly | Complex subscription logic | Subscription lifecycle, proration rules, webhooks |

### Checkout session and test-key guard (Node)

```ts
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (process.env.NODE_ENV !== 'production' && !/^(sk|rk)_test_/.test(key)) {
  throw new Error('Non-production and agent-run code requires a Stripe test key');
}
const stripe = new Stripe(key);

export async function createCheckout(order: { id: string; version: number; priceId: string }) {
  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: order.priceId, quantity: 1 }],
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    success_url: 'https://app.example.com/orders/thanks?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://app.example.com/cart',
  }, { idempotencyKey: `checkout:${order.id}:v${order.version}` });
}
```

### Test cards (any future expiry, any CVC)

| Card | Behaviour |
| :--- | :--- |
| `4242 4242 4242 4242` | Succeeds |
| `4000 0025 0000 3155` | Requires authentication (3D Secure) |
| `4000 0000 0000 9995` | Declined: insufficient funds |
| `4000 0000 0000 0002` | Declined: generic |

Verify the full list in Stripe's testing docs; it includes cards for disputes and specific decline codes.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Fulfil on the `success_url` redirect | Fulfil from verified webhooks | Redirects are skipped, forged or repeated |
| Take the amount from the client | Server-side price IDs | Users can edit requests |
| Float math for money | Integer minor units | Rounding errors in totals and refunds |
| Create PaymentIntents without idempotency keys | Key by your entity and version | Network retries double-charge |
| Parse JSON before verifying signatures | Verify raw body first | Signature checks fail or get disabled |
| Collect card numbers in your own form fields | Checkout or Elements | Expands PCI scope dramatically |
| Use live keys in development or agent sessions | Test keys or sandboxes only | Real money moves by accident |

## Verification checklist

- [ ] Agent-run code paths refuse non-test keys.
- [ ] Prices come from Stripe IDs; amounts are integer minor units.
- [ ] Every create call has an idempotency key.
- [ ] Fulfilment and access are driven by verified, deduplicated webhooks.
- [ ] Subscription states, SCA, declines and refunds are tested in test mode.
- [ ] Go-live steps are assigned to the user, with professional review for tax and legal items.

## Related

- Knowledge: `webhooks`, `pci-dss`, `fintech-ledgers`, `multi-tenant-saas`, `pricing-strategy`, `ecommerce`, `secrets-management`, `credential-sanitizer`.
- Agents: `security-guard`, `compliance-auditor`, `backend-engineer`.
