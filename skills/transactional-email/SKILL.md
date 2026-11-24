---
name: transactional-email
disable-model-invocation: true
description: >-
  Sends transactional email that arrives: provider choice (Postmark,
  SendGrid, Mailgun, Amazon SES, Resend), SPF, DKIM and DMARC alignment on a
  sending subdomain, templates with plain-text parts, queued sending with
  idempotency, bounce and complaint webhooks with suppression, unsubscribe
  headers where required, and deliverability monitoring. Use when wiring password resets, receipts or notifications, or
  when mail lands in spam.
---

# Transactional Email

Password resets and receipts are part of the product, and they fail
invisibly: a missing DKIM record, a duplicated send on retry, a hard bounce
you keep hammering, or a test run that emails real customers. Authenticate
the domain properly, send through a queue with idempotency, honour bounces
and complaints, and keep development mail captured locally.

## When to use

- Sending sign-up confirmations, password resets, magic links, receipts, invoices or alerts.
- Mail lands in spam, is rejected, or Gmail shows "via" or a warning banner.
- Choosing a provider, or moving providers without losing reputation.
- Handling bounces, complaints and unsubscribes.

## When not to use

- Newsletters, campaigns and lifecycle marketing: use `email-marketing`.
- Record types and DNS troubleshooting in general: use `dns-tls`.
- Mobile or browser notifications: use `push-notifications`.
- Login flows and token design: use `auth-patterns`.

## Workflow

1. **Inventory and classify messages.** For each email: trigger, recipient, template, locale, urgency, and whether it is transactional (expected by the user because of an action) or promotional. Send the two classes from separate subdomains or streams (`mail.example.com` vs `news.example.com`) so marketing reputation cannot sink password resets.

   **Check:** Every template is labelled transactional or promotional, and promotional content is absent from transactional mail.

2. **Choose a provider.** Postmark (transactional focus, separate message streams), SendGrid and Mailgun (broad features), Amazon SES (low cost, more do-it-yourself), Resend (developer-oriented API). Google Cloud has no first-party email sending API, and Compute Engine blocks outbound port 25, so send through a provider's HTTPS API or SMTP on 587. Compare pricing, dedicated IP options and data residency against current docs.

   **Check:** The provider supports signed event webhooks and a suppression list API.

3. **Authenticate the sending domain.** Add the provider's DKIM records (2048-bit where offered), a custom return-path or MAIL FROM subdomain so SPF aligns, and a DMARC policy on the organizational domain, starting at `p=none` with aggregate reports, then moving to `quarantine` and `reject` once reports are clean. DNS changes affect production mail: confirm each record with the user before applying.

   ```bash
   dig +short TXT _dmarc.example.com
   dig +short TXT s1._domainkey.mail.example.com
   dig +short TXT bounces.mail.example.com
   # PowerShell: Resolve-DnsName -Type TXT _dmarc.example.com
   ```

   **Check:** A test message viewed with Gmail's "Show original" reports SPF, DKIM and DMARC as PASS for the sending domain.

4. **Build templates that render and read well.** Use MJML or React Email (or the provider's templates) with inlined CSS, a plain-text alternative, a preheader, absolute HTTPS links on your own domain, localized strings and dark-mode-safe colours. Never put secrets, full card numbers or health details in mail.

   **Check:** Templates render in major clients (Gmail, Outlook, Apple Mail) and the plain-text part is readable on its own.

5. **Send through a queue with idempotency.** Enqueue sends from the business transaction (outbox or transactional job), dedupe on a key such as `password-reset:<user>:<token-id>` or `receipt:<order>`, retry 429 and 5xx with backoff, and respect provider rate limits.

   **Check:** Retrying a send job after a timeout does not deliver a second copy.

6. **Process bounces and complaints.** Subscribe to provider event webhooks and verify their signatures. Hard bounces and spam complaints add the address to a suppression list immediately; soft bounces retry with backoff and suppress after repeated failures. Check suppression before every send.

   **Check:** Sending to a provider's test bounce address results in suppression and no further attempts.

7. **Provide unsubscribe where required.** Messages users subscribed to (digests, product updates) need a visible unsubscribe link plus `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (RFC 8058); large senders to Gmail and Yahoo must honour one-click unsubscribe. Pure transactional mail is exempt, which is why classification in step 1 matters. This is not legal advice; confirm CAN-SPAM, GDPR or local rules with a qualified professional.

   **Check:** One-click unsubscribe works with a single POST and is reflected in preferences immediately.

8. **Keep non-production mail contained.** Run Mailpit locally and point SMTP at it; in staging use provider sandbox modes or an allowlist of internal recipients. An agent sends to real external addresses only after explicit user confirmation.

   ```bash
   docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
   # SMTP on localhost:1025, web UI on http://localhost:8025
   ```

   **Check:** The staging configuration cannot deliver to arbitrary external domains.

9. **Monitor deliverability.** Google Postmaster Tools for domain reputation and spam rate (keep user-reported spam well under 0.1% and never reach 0.3%), provider bounce and complaint rates, DMARC aggregate reports, and alerts when send failures or bounce rates spike. Verify current sender requirements against Google and Yahoo docs.

   **Check:** Dashboards show delivery, bounce and complaint rates per message type.

## Patterns

### DNS records

| Record | Name | Example value |
| :--- | :--- | :--- |
| DKIM | `<selector>._domainkey.mail.example.com` | CNAME or TXT supplied by the provider |
| SPF (return-path domain) | `bounces.mail.example.com` | `v=spf1 include:<provider include> -all`, or a CNAME to the provider |
| DMARC | `_dmarc.example.com` | `v=DMARC1; p=none; rua=mailto:dmarc-reports@example.com` |

SPF is evaluated on the envelope sender (return-path) domain and allows at most 10 DNS lookups; DMARC passes when SPF or DKIM passes and aligns with the visible From domain.

### Secure reset and magic-link mail

- Tokens are random, single use, short-lived (minutes), and stored hashed.
- Links point to your own HTTPS domain with no open-redirect parameters.
- The same response is shown whether or not the address exists, to avoid account enumeration.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Send from the root domain shared with marketing | Separate transactional subdomain or stream | Campaign complaints sink password resets |
| Jump straight to `p=reject` | `p=none`, read reports, then tighten | Legitimate senders you forgot get blocked |
| Send inline in the request handler | Queue with idempotency keys | Timeouts and retries create duplicates |
| Ignore bounce webhooks | Suppress hard bounces and complaints | Reputation drops and providers suspend you |
| HTML-only messages | HTML plus plain-text parts | Spam scoring and accessibility suffer |
| Development servers using real SMTP credentials | Mailpit or sandbox mode | Real customers receive test mail |

## Verification checklist

- [ ] Messages are classified; transactional and promotional streams are separate.
- [ ] SPF, DKIM and DMARC pass and align for every sending domain.
- [ ] Sends are queued and idempotent; retries do not duplicate.
- [ ] Bounces and complaints flow into a suppression list checked before sending.
- [ ] Unsubscribe headers exist where required.
- [ ] Non-production environments cannot reach real recipients.

## Related

- Knowledge: `dns-tls`, `email-marketing`, `background-jobs`, `webhooks`, `auth-patterns`, `gdpr-privacy`.
- Agents: `backend-engineer`, `security-guard`.
