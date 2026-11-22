---
name: sales-outreach
description: >-
  Plans and drafts outbound sales outreach: ideal customer profile and
  personas, trigger-based account lists with sources, tiered research and
  personalization, multi-touch sequences, cold email structure, deliverability,
  CAN-SPAM, GDPR, PECR and CASL basics, reply handling and follow-ups. Use when
  the user wants cold emails, a prospect list or sequence, better reply rates,
  or a compliance check on outreach. Drafts only; sending needs user confirmation.
---

# Sales Outreach

Good outbound is relevant, short, honest and compliant: the right account, at a
moment when the problem is likely live, with one clear ask. The agent
researches and drafts; the user decides what is sent.

## When to use

- "Write a cold email", "build an outbound sequence", "find prospects for *<ICP>*".
- Reply rates are low and the user wants a teardown of the current sequence.
- Checking that outreach to a region follows email marketing rules.
- Preparing account research before a first call.

## When not to use

- Newsletters and lifecycle email to opted-in users: `email-marketing`.
- Managing deals after a reply: `crm-pipeline`.
- Partner and channel outreach: `partnerships`.
- Positioning and messaging foundations: `brand-discovery` and `copywriting`.

## Workflow

1. **Define the ICP and personas.** Start from the best existing customers (won deals in the CRM): industry, size, region, tech stack, triggers. For each persona, note goals, pains, objections and what proof they trust.

   **Check:** The ICP is written as filter criteria a list tool can apply, and each persona has at least one trigger event (funding, hiring for a role, new regulation, tool migration, leadership change).

2. **Build the account and contact list.** Use the CRM, public company pages, job postings, product signups and event attendee lists the user is entitled to use. Respect site terms; do not scrape personal data from sources that forbid it. Record per contact: source, region, lawful basis note and trigger. Verify addresses before sending.

   **Check:** Every row has a source, a region, a trigger and a verification status.

3. **Research in tiers.** Tier 1 (top accounts): one-to-one research. Tier 2: segment-level messaging. Tier 3: trigger-level messaging. Delegate per-account research to a subagent with a fixed output: trigger, likely pain, relevant proof point, source URL.

   **Check:** Every personalized line has a source the user can open; nothing about the prospect is invented.

4. **Write the sequence.** Each touch adds something new (an insight, a resource, a different angle); none says "just bumping this". Use the email structure and sequence shape below.

   **Check:** The first email is readable on a phone without scrolling, has one ask, and every claim (customer results, logos) is real and approved for use.

5. **Check compliance and deliverability** against the tables below for every region in the list. This is general information, not legal advice; have counsel confirm the approach for your markets.

   **Check:** Each region has a recorded basis for contact, an opt-out mechanism and a postal address in the footer.

6. **Review, then send only with confirmation.** Create drafts (Gmail drafts, or the sequencing tool with the sequence paused). Show the user sample emails, the total recipient count and the sequence name. Activate or send only after explicit approval.

   **Check:** The user's approval names the sequence and the recipient count.

7. **Handle replies.** Classify replies as interested, objection, referral, not now or unsubscribe. Honour opt-outs immediately and add them to a suppression list shared across every tool. Draft responses for approval; log outcomes in the CRM.

   **Check:** Every opt-out is suppressed everywhere within the legal deadline.

8. **Measure and iterate.** Track per step: delivered, bounced, replied, positive replies, meetings booked and opportunities created. Change one variable at a time (subject, opening line, ask) and compare over a meaningful volume.

   **Check:** Metrics are recorded per step and per variant, not just per sequence.

## Cold email structure

```text
Subject:  <specific, 2-5 words, honest; no fake "Re:" or "Fwd:">

Hi <first name>,

<Observation: the trigger and why you are writing to them now. One sentence, with a fact they can verify.>
<Problem hypothesis for their role, in their words. One or two sentences.>
<Proof: what a similar <customer type> achieved, only if real and approved. One sentence.>
<Ask: one low-effort question, e.g. "Worth a short call next week?" or "Are you the right person for <topic>?">

<Name>, <role>, <company>
<Postal address> · <Opt-out line: "Reply 'no thanks' and I will not contact you again.">
```

## Sequence shape

| Day | Channel | Purpose |
| :--- | :--- | :--- |
| 1 | Email | Trigger, problem, one ask |
| 3 | Professional network | Connect with a short, non-sales note |
| 5 | Email | New angle or a useful resource |
| 8 | Phone (if appropriate and lawful) | Short voicemail referencing the email |
| 12 | Email | Proof: a relevant example or short case |
| 17 | Email | Close the loop politely; offer to stop |

## Compliance basics

| Region | Key points (check current law) |
| :--- | :--- |
| US: CAN-SPAM | No misleading headers or subject lines; identify the sender; include a valid postal address; give a clear opt-out and honour it within 10 business days; you remain responsible for vendors sending for you |
| EU: GDPR plus national ePrivacy rules | Need a lawful basis (often documented legitimate interest for B2B); tell people where you got their data at first contact; objections to direct marketing must always be honoured; some member states require prior consent even for B2B email |
| UK: UK GDPR and PECR | Corporate addresses may be emailed with identification and an opt-out; sole traders and some partnerships are treated like individuals and need consent |
| Canada: CASL | Requires express or implied consent (for example a published business address without a "no unsolicited messages" note, with a message relevant to the role), sender identification and a working unsubscribe |

## Deliverability

| Practice | Why |
| :--- | :--- |
| Send from a separate subdomain or domain, warmed up gradually | Protects the primary domain's reputation |
| Configure SPF, DKIM and DMARC | Required by major mailbox providers for bulk senders; check current Gmail and Yahoo sender guidelines |
| Keep spam complaints very low and watch Google Postmaster Tools | High complaint rates send mail to spam for everyone |
| Plain text, few links, no attachments on first touch | Fewer spam-filter triggers |
| Verify lists and remove bounces | Bounces damage sender reputation |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Fake personalization ("loved your recent post") | Cite a verifiable fact, or use segment-level messaging | Prospects detect it and it destroys credibility |
| Fake "Re:" or "Fwd:" subjects | Use honest, specific subjects | Deceptive subject lines breach CAN-SPAM |
| Buy contact lists | Build lists from sources with a lawful basis | Bought lists bounce, trigger complaints and carry legal risk |
| Send high volume from the main domain | Use a warmed subdomain and gradual volume | One bad campaign can block company email |
| Dump features | One problem, one proof point, one ask | Long pitches get no replies |
| Let the agent auto-send | Draft, review, send on explicit approval | Outreach speaks for the user and is hard to undo |

## Verification checklist

- [ ] The ICP and personas come from real customer data.
- [ ] Every contact has a source, region, trigger and verification status.
- [ ] Personalized lines and proof points are verifiable and approved.
- [ ] Compliance and deliverability checks were done per region.
- [ ] The user approved the sequence and recipient count before sending.
- [ ] Opt-outs are suppressed across all tools.

## Related

- Knowledge: `crm-pipeline`, `copywriting`, `brand-discovery`, `email-marketing`, `transactional-email`, `gdpr-privacy`, `market-research`, `competitive-analysis`, `partnerships`.
- Agents: `marketing-strategist`, `deep-researcher`.
