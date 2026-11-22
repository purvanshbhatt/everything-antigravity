---
name: email-marketing
description: >-
  Plans and runs consent-based email marketing: list building and double
  opt-in, segmentation, lifecycle flows (welcome, onboarding, re-engagement,
  win-back), campaigns, deliverability (SPF, DKIM, DMARC, one-click
  unsubscribe, list hygiene), A/B tests and metrics, within CAN-SPAM, GDPR/PECR
  and CASL rules. Use when the user asks to grow a list, write a sequence, fix
  deliverability or plan email campaigns.
---

# Email Marketing

Email works when people asked for it, each message is relevant to where the
reader is, and the sending domain keeps a clean reputation. Consent and
deliverability come before copy: a perfect email in the spam folder, or sent
to people who never opted in, is a liability. Legal summaries below are
orientation, not legal advice.

## When to use

- Growing a list, adding signup forms or a preference centre.
- Writing welcome, onboarding, re-engagement or win-back sequences.
- Planning a campaign calendar or a launch announcement.
- Emails landing in spam, rising bounces or complaints.
- Designing an email A/B test.

## When not to use

- Password resets, receipts and other transactional email: `transactional-email`.
- A recurring editorial newsletter strategy: `newsletters`.
- One-to-one cold outreach for sales: `sales-outreach`.
- Building consent storage or deletion tooling: `gdpr-privacy`.

## Workflow

1. **Confirm consent and the rules that apply.** For every list or segment, record where subscribers are, how and when consent was captured, and the exact wording they agreed to. Exclude purchased, rented or scraped lists entirely.

   **Check:** Each segment has a documented consent source, and no imported list lacks one.

2. **Set up sending properly.** Send marketing from a dedicated subdomain (for example `news.example.com`) through a reputable email service provider. Publish SPF and DKIM for it, and a DMARC record starting at `p=none` with reporting, tightening to `quarantine` or `reject` once reports are clean. Enable one-click unsubscribe headers (`List-Unsubscribe` and `List-Unsubscribe-Post`, RFC 8058), a footer unsubscribe link, the sender's postal address and a preference centre. Ramp volume gradually on new domains or IPs.

   **Check:** A test message viewed with Gmail's "Show original" shows SPF, DKIM and DMARC as PASS.

3. **Segment.** Use lifecycle stage, behaviour (signed up, activated, purchased, lapsed), engagement recency and declared preferences. Do not build segments on sensitive data (health, religion, sexual orientation) without a specific legal basis.

   **Check:** Each segment has a definition, a size and a reason to exist.

4. **Build lifecycle flows** before one-off campaigns (table below). Each flow has a trigger, a goal, an exit condition and a frequency cap across flows.

   **Check:** Nobody can receive more than the agreed number of marketing emails per week.

5. **Write and QA.** One goal and one primary call to action per email. Pair the subject line with preheader text, include a plain-text part, use live text (not text inside images), alt text, sufficient contrast and UTM-tagged links. Send tests to seed inboxes on major clients and on mobile.

   **Check:** Links, personalization fallbacks and unsubscribe all work in the test sends.

6. **Test one variable at a time.** Opens are inflated by privacy features such as Apple Mail Privacy Protection, so use clicks or conversions as the primary metric. Size the test before sending (see `ab-testing`); small lists support only large differences.

   **Check:** The hypothesis, primary metric and sample size are written before the send.

7. **Get approval, then send.** Present the segment, size, subject, final content, send time and suppression lists. Send or schedule only after explicit user confirmation.

   **Check:** The user confirmed this exact send.

8. **Monitor and clean.** Track bounces, complaints and unsubscribes per send. Suppress hard bounces and complaints immediately, honour unsubscribes promptly, and sunset subscribers with no engagement over an agreed window after a re-permission attempt. Watch Google Postmaster Tools for the sending domain.

   **Check:** Spam complaint rate stays under 0.1% and never reaches 0.3%.

## Legal orientation (not legal advice)

| Rule | Applies to | Key requirements |
| :--- | :--- | :--- |
| CAN-SPAM (US) | Commercial email to US recipients | No false headers or deceptive subjects; identify ads; valid physical postal address; clear opt-out; honour opt-outs within 10 business days; opt-out must be free |
| GDPR / UK GDPR with ePrivacy and PECR | Marketing to individuals in the EU and UK | Prior opt-in consent that is specific, informed and unambiguous (no pre-ticked boxes); records of consent; easy withdrawal. Soft opt-in for existing customers about similar products only if an opt-out was offered at collection and in every message |
| CASL (Canada) | Commercial electronic messages sent to or from Canada | Express or time-limited implied consent; sender identification and contact details; working unsubscribe processed within 10 business days |

Mailbox providers add their own rules. Gmail and Yahoo require bulk senders to authenticate with SPF, DKIM and DMARC, support one-click unsubscribe, process unsubscribes within two days and keep spam rates low. Check current sender guidelines before large sends.

## Lifecycle flows

| Flow | Trigger | Goal | Typical length | Exit when |
| :--- | :--- | :--- | :--- | :--- |
| Welcome | Confirmed signup | Set expectations, first value | 2-4 emails | Activated or completed |
| Onboarding | Account created | Reach the activation event | 3-6 emails | Activation event fires |
| Abandonment | Cart or signup started, not finished | Recover the action | 1-3 emails | Action completed |
| Re-engagement | No clicks for <window> | Win back attention or confirm preference | 2-3 emails | Click, or move to sunset |
| Win-back | Customer lapsed | Return purchase or renewal | 2-3 emails | Purchase or unsubscribe |

Double opt-in (a confirmation link before the first marketing email) proves consent, blocks typo and spam-trap addresses, and is strongly recommended for EU and UK audiences.

## Metrics

| Metric | Use |
| :--- | :--- |
| Delivery and bounce rate | List quality and infrastructure health |
| Click rate | Primary engagement signal |
| Conversion rate and revenue per recipient | Business outcome |
| Unsubscribe rate | Relevance and frequency fit |
| Complaint rate | Reputation risk; act on any increase |
| Open rate | Directional only; inflated by privacy proxies |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Buy or scrape lists | Grow opt-in lists | Illegal in many places and destroys sender reputation |
| Pre-ticked consent boxes | Unticked, specific consent | Not valid consent under GDPR |
| Hide or break unsubscribe | One-click unsubscribe and preference centre | Legal requirement; frustrated readers report spam instead |
| Mail the whole list every time | Segment by lifecycle and engagement | Irrelevant mail drives complaints |
| Judge tests on open rate | Use clicks or conversions | Opens are inflated by privacy proxies |
| Keep mailing unengaged addresses | Re-permission, then sunset | Old addresses become spam traps |
| Send without approval | Show the final send for explicit confirmation | Sends cannot be recalled |

## Verification checklist

- [ ] Every segment has a documented consent source; no bought lists.
- [ ] SPF, DKIM and DMARC pass; one-click unsubscribe and postal address are present.
- [ ] Flows have triggers, goals, exit conditions and a frequency cap.
- [ ] Test sends were checked on major clients and mobile.
- [ ] Tests use clicks or conversions with a pre-set sample size.
- [ ] Each send was explicitly confirmed by the user.
- [ ] Bounces, complaints and unsubscribes are suppressed automatically.

## Related

- Knowledge: `copywriting`, `transactional-email`, `gdpr-privacy`, `ab-testing`, `growth-marketing`, `newsletters`, `content-marketing`.
- Agents: `marketing-strategist` (lifecycle strategy and copy review).
