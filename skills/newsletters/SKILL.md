---
name: newsletters
disable-model-invocation: true
description: >-
  Runs newsletters that keep readers: positioning and a reader promise, a
  cadence the team can sustain, a repeatable issue structure, subject lines
  and preview text, growth loops, list hygiene and deliverability basics, and
  metrics beyond opens. Use when the user is starting, writing, growing or
  auditing an email newsletter or a publication on platforms such as Substack,
  Beehiiv, Buttondown or Ghost.
---

# Newsletters

A newsletter is a promise repeated on a schedule. Keep the promise narrow,
the format predictable and the quality consistent; growth then comes from
readers forwarding it, not from tricks.

## When to use

- "Start a newsletter for our product", "write this week's issue", "why are opens dropping?".
- Engineering or product update newsletters, community digests, creator newsletters.
- Choosing a platform, cadence and format, or auditing growth and engagement.

## When not to use

- Lifecycle and promotional email programs (onboarding flows, campaigns, segmentation): `email-marketing`.
- Receipts, password resets and other system mail: `transactional-email`.
- A single long article: `technical-blogging`.

## Workflow

1. **Position it.** Write the promise: "Every <cadence>, <audience> gets <specific value> in <time to read>." Name two or three comparable newsletters and how this one differs.

   **Check:** The promise fits in one sentence and a reader could tell if an issue broke it.

2. **Choose a format and cadence you can sustain.** Curation, essay, digest, changelog or community roundup (table below). Pick the cadence the team can keep for six months; consistency beats frequency. Build a backlog of at least three issues before launch.

   **Check:** Owners, cadence, send day and a three-issue backlog exist.

3. **Template the issue.** Fixed sections in a fixed order, one primary call to action, a short intro with a human voice, scannable headings, alt text on images and a plain-text version.

   **Check:** A new contributor could assemble an issue from the template alone.

4. **Write subject line and preview text together.** Be specific about the content ("3 ways we cut CI time by 40%" beats "Issue #12"). Keep subjects short enough to survive mobile truncation, avoid spam-trigger styling (all caps, excessive punctuation), and A/B test only with a list large enough to give a readable result.

   **Check:** Subject and preview read as a pair and don't repeat each other.

5. **Set up deliverability and compliance before the first send.** Authenticate the sending domain with SPF, DKIM and DMARC; use double opt-in; include the postal address and a visible unsubscribe link where the law requires it (CAN-SPAM, GDPR, CASL and similar); support one-click unsubscribe, which major mailbox providers require from bulk senders (verify current sender requirements). Keep complaint rates low.

   **Check:** Authentication passes in a test send's headers; unsubscribe works in one click.

6. **Send with confirmation.** Sending reaches real people and cannot be undone. Send a test to the user, show the final subject, preview text, segment and recipient count, and wait for explicit approval before scheduling or sending.

   **Check:** The user approved the exact issue and audience.

7. **Grow deliberately.** Signup forms on high-traffic pages and posts, a welcome email that delivers on the promise immediately, an archive with shareable web versions, referrals, recommendations from peer newsletters, and repurposing issues into posts. Buying lists is out: it damages deliverability and often breaks the law.

   **Check:** Each growth channel has a tracked source (UTM or platform attribution).

8. **Measure what matters and prune.** Since Apple Mail Privacy Protection, open rates are inflated and unreliable; track clicks, replies, forwards and referrals, unsubscribe and complaint rates, list growth and cohort retention. Run a re-engagement campaign for long-inactive subscribers, then suppress those who stay inactive. Removing subscribers is irreversible for that audience: confirm the segment with the user first.

   **Check:** A monthly metrics table exists with clicks, unsubscribes, complaints and net growth.

## Reference

| Format | Effort | Works for |
| :--- | :--- | :--- |
| Curation (links + commentary) | Low-medium | Busy experts who want a filter |
| Essay | High | Thought leadership, personal brands |
| Digest / roundup | Medium | Communities, open-source projects |
| Product changelog | Low | Existing users; ties to releases |
| Hybrid (one essay + links) | Medium | Most company newsletters |

Issue template:

```markdown
Subject: <specific outcome or hook>
Preview: <complements the subject>

Hi <first name or "there">, <two-sentence intro: why this issue matters>

## The main thing
<one story, insight or update; one link>

## Worth your time
- <link> - <one line on why>
- <link> - <one line on why>

## From the community / changelog
<short items>

<one call to action>
<signature, reply invitation, postal address, unsubscribe>
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Optimize for open rate | Optimize for clicks, replies and retention | Opens are distorted by privacy features |
| Change format every issue | Keep a fixed template | Predictability builds habit |
| Send without authentication | SPF, DKIM, DMARC before launch | Unauthenticated mail lands in spam or is rejected |
| Hide the unsubscribe link | Make it one click and visible | Complaints hurt deliverability more than unsubscribes |
| Send or prune without review | Test send and explicit approval | Sends and suppressions can't be undone |

## Verification checklist

- [ ] One-sentence promise and a sustainable cadence with a backlog.
- [ ] Template with one primary call to action and a plain-text version.
- [ ] SPF, DKIM, DMARC, double opt-in, unsubscribe and legal footer in place.
- [ ] Test send reviewed and the send explicitly approved by the user.
- [ ] Metrics beyond opens tracked monthly; pruning confirmed before running.

## Related

- Knowledge: `email-marketing`, `transactional-email`, `content-marketing`, `technical-blogging`, `copywriting`, `growth-marketing`, `community-management`, `editing`.
