---
name: internal-comms
disable-model-invocation: true
description: >-
  Writes internal communications from real sources: progress-plans-problems
  updates, weekly status reports, leadership summaries, incident and outage
  notices, change and reorg announcements, FAQs and team newsletters. Gathers
  facts from tickets, PRs and metrics, leads with what changed and what the
  reader must do, and marks unknowns. Use when the user asks for a status
  update, an announcement or an internal notice.
---

# Internal Comms

Internal messages compete with hundreds of others, and most readers decide in one line whether to keep reading. Lead with what changed and what the reader has to do, back every claim with a source, and say plainly what is not known yet. This skill picks the right format, gathers the facts and produces a draft the user sends; it never sends on its own.

## When to use

- "Write my weekly update", "draft a status report", "summarize this for leadership", "3P update".
- An outage or degradation needs a notice for people outside the response team.
- A process, tool, policy, team structure or deadline is changing and people need to hear it once, clearly.
- A change will raise the same questions many times and needs an FAQ.
- A team or department newsletter.

## When not to use

- Running the incident itself (roles, mitigation, timeline): `incident-response`. Writing the analysis afterwards: `/postmortem`.
- Updates to investors or a board: `investor-updates`.
- External newsletters, customer emails and marketing copy: `newsletters`, `copywriting`, `transactional-email`.
- Turning analysis into a data-led narrative or deck: `data-storytelling`, `presentation-slides`.
- Product specs and requirements: `/write-spec`, `product-requirements`.

## Workflow

1. **Pin the audience, the ask and the channel.** Ask (or infer from the request) who reads it, what they must do or decide, by when, and where it will be posted. One message serves one audience; write two drafts if executives and the team need different things.

   **Check:** You can finish the sentence "After reading this, <audience> will <action> by <date>", or state that the message is information only.

2. **Pick the format.** Use the table below, then copy the matching skeleton from [templates](references/templates.md).

   **Check:** The format matches the reader and the channel, and its length budget is known.

3. **Gather facts from sources, not memory.** Pull merged PRs, closed tickets, dashboards and decisions for the period. Use connectors for the issue tracker or chat when they are configured (`eag mcp list` shows the bundled MCP catalog); otherwise use the CLI.

   ```bash
   gh pr list --state merged --search "merged:>=2026-11-16" --json number,title,url --limit 100
   gh issue list --state closed --search "closed:>=2026-11-16" --json number,title,url --limit 100
   git log --since="7 days ago" --no-merges --pretty="%h %an %s"
   ```

   Keep a source list as you go: every number, date and status gets a link or a named owner.

   **Check:** Every metric and claim in your notes has a source. Anything without one is marked "to confirm" with an owner.

4. **Write the top first.** Draft the subject line and the first two sentences before anything else: the change or status, its impact on the reader, and the ask with a date. Then fill the body in order of what the reader needs, not the order events happened.

   **Check:** Someone who reads only the subject and first two sentences knows what happened and what to do.

5. **Mark status and unknowns honestly.** Use status labels with fixed meanings (see Status language). Write unknowns as "not known yet; <owner> will confirm by <date>". Never fill a gap with a guess or an invented number.

   **Check:** No figure appears without a source, and every open item has an owner and a date.

6. **Match the house tone.** Read two or three earlier messages of the same kind with `view_file` or the connector, and match their length, greeting, structure and formality. Remove hype, blame, internal jargon the audience does not share, and anything about an individual's performance.

   **Check:** The draft would not stand out next to the previous ones, except by being clearer.

7. **Route sensitive messages for review.** Reorganizations, layoffs, compensation, legal matters, security incidents and anything naming customers need review by the owner, HR, legal or security as appropriate. Say so in your reply and leave review placeholders in the draft.

   **Check:** The reply lists who must approve before sending, or states that no review is needed and why.

8. **Hand over the draft.** Write it to a file with `write_to_file` or present it inline, with the source list below it. Post or send only after the user explicitly confirms the final text, recipients and channel.

   **Check:** The user has the draft and its sources, and nothing was sent without their confirmation.

## Choosing the format

| Situation | Format | Length |
| :--- | :--- | :--- |
| Regular team or project update | Progress, plans, problems (3P) | 5-12 bullets |
| Recurring report to a manager or stakeholders | Weekly status report with a status label | One screen |
| An executive needs to decide or be aware | Leadership summary, bottom line first | 150-250 words |
| Something is broken for internal users or customers | Incident notice: initial, updates, resolved | Short; on a fixed cadence |
| A process, tool, policy or structure changes | Change announcement plus FAQ | Announcement under 300 words |
| Many people will ask the same questions | FAQ grouped by audience | As long as the real questions |
| Team culture and wins over a month or quarter | Internal newsletter | Scannable sections, links out |

## Status language

| Label | Meaning | Must include |
| :--- | :--- | :--- |
| On track | Will meet the committed date and scope | Nothing extra |
| At risk | May miss date or scope without action | The risk, the mitigation, the decision needed and by when |
| Off track | Will miss date or scope | The new date or scope, the cause, and what is being done |
| Blocked | Cannot progress until someone else acts | Who, what, and the date the block started |
| Done | Shipped and verified | Where to see it, and the measured result if there is one |

Status labels describe the work, not the people. A project that moves from on track straight to off track with no at-risk warning is worth a sentence explaining why.

## Writing rules

- Subject lines carry the news: "Checkout v2 rollout paused at 25% until Thursday", not "Update".
- Absolute dates with time zones ("Thu 26 Nov, 15:00 UTC"), never "next week" or "soon".
- Numbers with a baseline and a source: "p95 latency 340 ms (was 510 ms, dashboard link)".
- One ask per message where possible, bolded, with a deadline and a named owner.
- Bullets for lists of items; short paragraphs for reasoning. No walls of text and no slides pasted as images.
- Incident notices give the next-update time even when there is no news, and keep the same channel and thread throughout.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Narrate the week in time order | Lead with the outcome and the ask | Readers stop after the first lines |
| Invent or round numbers to sound precise | Cite the source or write "to confirm" | One wrong number discredits the whole update |
| Hide bad news in the middle | Put risks and misses near the top | Late surprises cost more trust than early warnings |
| Speculate on causes during an incident | State impact, workaround and next update time | Early guesses are often wrong and get quoted |
| Announce a reorg without an FAQ | Ship the announcement and FAQ together | People fill silence with rumours |
| Send or post from the draft automatically | Hand the draft over for explicit approval | Internal messages are hard to unsend |

## Verification checklist

- [ ] Audience, ask, deadline and channel are explicit.
- [ ] The subject and first two sentences state the news and the ask.
- [ ] Every number, date and status has a source or an owner; unknowns are marked with an owner and a date.
- [ ] Status labels use the defined meanings.
- [ ] Tone matches earlier messages; no blame, hype or individual performance details.
- [ ] Sensitive messages list the required reviewers.
- [ ] Nothing was sent or posted without the user's explicit confirmation.

## Related

- Knowledge: `incident-response`, `investor-updates`, `newsletters`, `data-storytelling`, `editing`, `meeting-facilitation`, `okrs`.
- Workflows: `/postmortem`, `/write-spec`, `/release-management`.
- Agents: `technical-writer`, `chief-of-staff`, `incident-commander`.
