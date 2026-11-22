---
name: ecommerce
description: >-
  Builds and improves online stores: platform choice (hosted Shopify versus
  headless), catalog and product data, product pages, cart and checkout UX,
  payments and PCI scope, tax, shipping and returns, inventory sync, product
  feeds and structured data, analytics events, performance and conversion
  testing. Use when the user asks to launch a store, choose a platform, fix
  checkout drop-off, or improve conversion.
---

# E-commerce

A store converts when shoppers find the right product, trust the page, see
the full price early and finish checkout without friction. Keep card data off
your servers, keep one source of truth for inventory, and measure every step
of the funnel. Changes to a live store affect real customers and money, so
they always need the user's explicit confirmation.

## When to use

- Launching a store or migrating platforms.
- Designing product pages, cart and checkout.
- Checkout or cart abandonment is high, or conversion has dropped.
- Setting up product feeds, structured data, tax, shipping or returns.
- Connecting inventory across a store, marketplaces and a warehouse.

## When not to use

- Payment integration code in depth (webhooks, subscriptions, SCA): `payments-stripe`.
- Card data compliance programme: `pci-dss`.
- Page speed engineering: `web-performance`.
- Technical SEO audit: `seo-audit`.
- Store emails and lifecycle flows: `email-marketing`.

## Workflow

1. **Choose the platform** (table below) from catalog size, customization needs, team skills, integrations and total cost including apps and transaction fees.

   **Check:** The choice records the deciding criteria and what would trigger a re-platform.

2. **Model the catalog.** Products, variants (size, colour), unique SKUs, GTIN or MPN where they exist, structured attributes for filtering, high-quality images with alt text, and clear titles. Manage bulk data in a Google Sheet or CSV in the platform's import format. Publish a product feed to Google Merchant Center and add schema.org `Product` and `Offer` structured data; include ratings only from genuine reviews.

   **Check:** The import validates with zero errors, and a sample product page passes the Rich Results Test.

3. **Design product pages.** Near the top: price, availability, variant selection, delivery estimate, returns summary and one primary button. Below: images and video, specifications, sizing help, genuine reviews and FAQs. Fake reviews and undisclosed incentivized reviews are illegal in many jurisdictions (for example under the US FTC rule on fake reviews and the UK DMCC Act).

   **Check:** On a phone-sized screen, price, variant picker and add-to-cart are visible without scrolling.

4. **Streamline cart and checkout.** Offer guest checkout, minimal fields, address autocomplete, express wallets, and the full cost including shipping, taxes and fees as early as possible; several jurisdictions restrict hidden or drip-priced fees. Write clear inline errors, keep forms accessible, and never pre-tick add-ons.

   **Check:** A test order completes from product page to confirmation with keyboard only, and the total never changes unexpectedly at the last step.

5. **Keep payments out of scope.** Use the platform checkout or the payment provider's hosted page or embedded fields so card data never touches your servers; this usually shrinks PCI DSS scope, but confirm the self-assessment type with your provider. Drive order state from signed payment webhooks, enable fraud screening, and test with the provider's test mode and published test cards only.

   **Check:** No card number field is served from your own code, and webhook handlers are idempotent.

6. **Set tax, shipping and returns.** Use a tax engine or the platform's tax service for each region you sell to. Define shipping zones, rates and cut-off times. Publish a returns policy that meets local consumer law (for example the EU 14-day right of withdrawal for most distance sales); draft it with `policy-drafting` and have it reviewed.

   **Check:** Test checkouts for each main region show the correct tax and shipping.

7. **Make inventory a single source of truth.** One system owns stock counts; others sync from it. Reserve stock at checkout, prevent overselling, alert on low stock, and reconcile marketplace orders. Test sync failures.

   **Check:** Two simultaneous orders for the last unit result in one sale and one clear out-of-stock message.

8. **Measure and improve.** Track the GA4 recommended e-commerce events (`view_item_list`, `select_item`, `view_item`, `add_to_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`, `refund`) with consistent item IDs. Watch conversion rate by device and source, average order value, cart and checkout abandonment, and Core Web Vitals on product and checkout pages. Run A/B tests with pre-set sample sizes (see `ab-testing`).

   **Check:** The funnel report shows each step's drop-off by device, and `purchase` revenue reconciles with the platform's order totals.

Live-store safety: build and test on a development store, staging environment or unpublished theme. Publishing themes, changing prices or inventory, creating discounts, issuing refunds, or emailing customers happens only after explicit user confirmation.

## Platform choice

| Option | Fits | Trade-offs |
| :--- | :--- | :--- |
| Hosted platform with a theme (Shopify, BigCommerce and similar) | Most stores; small teams | App and transaction fees; limits on checkout customization |
| Hosted backend with headless front end (for example Shopify Hydrogen or the Storefront API) | Custom UX, content-heavy brands, strong front-end team | You own front-end performance, hosting and SEO |
| Open-source or composable commerce (WooCommerce, Medusa, Saleor, commercetools) | Unusual models, deep integrations, data control | You own security, upgrades, scaling and more of PCI scope |
| Marketplaces (Amazon, Etsy and others) | Demand discovery | Fees, less customer data, platform rules |

## Checkout friction checklist

| Issue | Fix |
| :--- | :--- |
| Forced account creation | Guest checkout; offer an account after purchase |
| Surprise costs at the last step | Show shipping and fees on product and cart pages |
| Long forms | Remove optional fields; address autocomplete |
| Unclear errors | Inline messages next to the field, saying how to fix |
| Few payment options | Add the wallets and local methods common in your markets |
| Slow pages | Optimize images and scripts; audit third-party apps |
| Low trust | Clear returns, contact details, secure-payment wording, genuine reviews |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Handle raw card numbers in your code | Hosted checkout or provider fields | Expands PCI scope and breach risk |
| Hidden fees at the last step | Show the full price early | Top cause of abandonment and a legal risk |
| Fake or filtered reviews | Genuine reviews, including negative ones | Illegal in many places and erodes trust |
| Several systems editing stock | One source of truth with sync | Overselling and cancelled orders |
| Install apps freely | Audit apps for speed, data access and cost | Each app adds scripts, risk and fees |
| Test on the live store | Development store or unpublished theme | Real customers see broken changes |

## Verification checklist

- [ ] Catalog import and structured data validate without errors.
- [ ] Price, variants and add-to-cart are visible on mobile without scrolling.
- [ ] Full costs appear before the final step; guest checkout works.
- [ ] Card data never touches your servers; webhooks are idempotent.
- [ ] Tax, shipping and returns are correct per region; the returns policy was reviewed.
- [ ] Funnel events fire and reconcile with orders.
- [ ] No live-store change, refund or customer email happened without explicit user confirmation.

## Related

- Knowledge: `payments-stripe`, `pci-dss`, `web-performance`, `seo-audit`, `ab-testing`, `email-marketing`, `paid-advertising`, `product-analytics`, `accessibility-a11y`, `frontend-react-nextjs`, `policy-drafting`.
- Agents: `e2e-runner` (checkout journey tests), `performance-optimizer` (store speed).
