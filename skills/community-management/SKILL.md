---
name: community-management
disable-model-invocation: true
description: >-
  Builds and runs online communities on Discord, Discourse, Slack or GitHub
  Discussions: purpose and platform choice, channel structure, onboarding,
  codes of conduct and moderation ladders, programs (office hours, champions,
  events), feedback loops to product, and health metrics. Use when the user
  asks to launch or grow a community, set moderation rules, handle a conflict,
  or measure community health.
---

# Community Management

A community lasts when members get value from each other, not only from the
company. Give it a clear purpose, a small structure that grows with demand,
consistent and documented moderation, and a visible loop from member feedback
to product changes.

## When to use

- Launching a Discord server, forum, Slack community or GitHub Discussions.
- Writing a code of conduct, moderation guidelines or a moderator handbook.
- Handling a conflict, a raid, or a member who breaks the rules.
- Designing programs: office hours, champions, events, showcases.
- "Is our community healthy?": choosing and reviewing metrics.

## When not to use

- Broadcast social channels: `social-media`.
- Developer advocacy strategy and docs: `developer-relations`.
- Support ticket queues and SLAs: `customer-support`.
- Maintainer governance for an open-source project: `open-source-maintenance`.

## Workflow

1. **Define purpose and fit.** Write who the community is for, why they join, why they stay, and what the company gets. Choose the platform from the table below.

   **Check:** A one-paragraph purpose statement exists, and the platform matches how members need to find answers later.

2. **Start with a small structure.** Begin with a few spaces: welcome and rules, introductions, help, showcase, announcements, off-topic. Add a channel only when a topic repeatedly crowds out another. Give moderators the least privilege they need and require two-factor authentication for every admin and moderator account.

   **Check:** Every channel has a one-line purpose in its description.

3. **Adopt a code of conduct.** Start from an established one (for example the Contributor Covenant) and adapt it: expected behaviour, unacceptable behaviour, how to report privately, what happens next, and who enforces it.

   **Check:** The code is pinned, linked from onboarding, and names a private reporting channel.

4. **Moderate consistently.** Use the ladder below, log every action with reason and evidence, and require a second moderator to review permanent bans. Use platform automoderation for spam, links from new accounts and slurs. Threats of violence, self-harm, child safety and other illegal content are escalated immediately through the platform's reporting process and your escalation policy, not handled with a warning.

   **Check:** The moderation log has an entry for every action, and the escalation contacts are current.

5. **Onboard new members.** A welcome message explains the purpose, rules and one first action (introduce yourself, ask a question, share a project). Use verification gates or rate limits for new accounts if raids or spam are a risk.

   **Check:** A test account can go from joining to first post in under five minutes.

6. **Run programs.** Choose a few: office hours, AMAs, showcases, challenges, champion or ambassador programs with written criteria and benefits, and an events calendar. Recognise helpful members publicly.

   **Check:** Each program has an owner, cadence and a success measure.

7. **Close the feedback loop.** Tag product feedback and bug reports, send a weekly digest to the product team, and report back publicly when something ships.

   **Check:** The digest goes out on schedule, and shipped items are announced to the community.

8. **Review health monthly** with the metrics below.

   **Check:** The review names one improvement for next month.

Announcements, mass mentions and direct messages to members are sent only after explicit user confirmation. Never mass-DM members or export member data to other tools without a clear basis and approval.

## Platform choice

| Platform | Strength | Limitation |
| :--- | :--- | :--- |
| Discord | Real-time chat, voice, events, roles | Content is not indexed by search engines and is hard to find later |
| Discourse or another forum | Searchable, long-form, good for SEO and support deflection | Slower; needs critical mass to feel alive |
| GitHub Discussions | Close to code, issues and releases | Developer-only; limited moderation tooling |
| Slack | Familiar for professional audiences | Free plans limit history; costly at scale |

Pair a chat platform with a searchable home (forum, Discussions or docs) so answers are not lost.

## Moderation ladder

| Step | Use for | Record |
| :--- | :--- | :--- |
| Note or reminder | First, minor off-topic or tone issue | Optional |
| Formal warning | Clear rule break | Yes |
| Timeout or mute | Repeated or heated rule breaks | Yes |
| Temporary ban | Serious or continued violation | Yes, with second-mod review |
| Permanent ban | Harassment, hate, doxxing, spam bots | Yes, with second-mod review |

## Health metrics

| Metric | What it tells you |
| :--- | :--- |
| New member activation (% posting within 7 days) | Onboarding quality |
| Time to first response on questions | Responsiveness |
| % questions answered, and % answered by non-staff | Self-sustaining help |
| Monthly active contributors | Depth beyond lurkers |
| Retention by join month | Lasting value |
| Moderation actions per 1,000 messages | Safety trend |
| Feedback items shipped | Influence on product |

Report member counts, but never as the main measure; joined-and-left members inflate them.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Launch with 30 channels | Start small and split on demand | Empty channels signal a dead community |
| Staff answer everything | Recognise and enable member helpers | The community stalls when staff are busy |
| Moderate by mood | Written ladder and log | Inconsistency reads as favouritism |
| Delete criticism | Respond and fix; remove only rule breaks | Censorship erodes trust faster than complaints |
| Only use chat | Add a searchable home | Members ask the same questions forever |
| Ignore feedback | Weekly digest and public follow-up | Members stop sharing when nothing changes |

## Verification checklist

- [ ] Purpose, platform and starting structure are written down.
- [ ] The code of conduct is pinned with a private reporting route.
- [ ] Moderators use two-factor authentication and the moderation log is kept.
- [ ] Escalation contacts for safety and illegal content are current.
- [ ] A feedback digest reaches product on schedule.
- [ ] No announcement or DM was sent without explicit user confirmation.

## Related

- Knowledge: `developer-relations`, `social-media`, `customer-support`, `open-source-maintenance`, `policy-drafting`.
- Agents: `marketing-strategist` (program design and growth review).
