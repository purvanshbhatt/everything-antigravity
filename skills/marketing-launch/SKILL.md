---
name: marketing-launch
description: >-
  Runs a multi-channel launch for a product, major release or open-source
  project: positioning check, asset list (landing copy, OG image, demo GIF or
  video, per-channel announcement posts, docs), T-minus timeline, launch-day
  runbook and post-launch metrics review. Drafts everything for approval and
  never posts on the user's behalf. Use when the user says launch, announce,
  go public, Product Hunt or Show HN. Invoke with /marketing-launch.
---

# Marketing Launch

Plan, prepare and run a launch so that every channel points to a product that
works for a stranger on first try, and measure whether it produced activated
users rather than a one-day traffic spike. The agent drafts and checks; the
user approves and publishes.

## When to use

- A new product, v1.0, major version or significant feature is going public.
- The user mentions Product Hunt, Show HN, a launch week, or "announce this".
- An open-source project is moving from private to public.

## When not to use

- Positioning is undecided: run `brand-discovery` first, then come back.
- Ongoing growth work after launch (loops, experiments): `growth-marketing`.
- A single piece of copy (one post, one README): `copywriting`.
- Shipping the code itself: `/pr-ready` and `/verify` come before this.

## Workflow

1. **Define the launch.** Record what is launching, the launch tier (table below), the date and time zone, the goal metric (for example "300 activated users within 14 days", not "lots of stars"), the audience and channels, and who will be online on the day. Create an Antigravity task-list artifact for the rest of the workflow.

   **Check:** The launch has one goal metric with a number and a date, and named people covering the launch-day hours.

2. **Run the positioning check.** Load the brand brief. Confirm the one-liner, the primary alternative, three value pillars with proof, and the best-fit audience. If any is missing, run a short `brand-discovery` pass. Then test the first-run path as a stranger: install from the public registry or sign up in a clean environment, follow only the public quickstart, and reach the aha moment. Delegate this to the `e2e-runner` subagent or use `/e2e` for web signup flows.

   **Check:** The one-liner passes the swap test in `copywriting`, and a clean-environment run of the quickstart reaches first value with no undocumented step.

3. **Produce the assets.** Build the asset list below as a table with owner, spec and status. Use the linked skills for each asset. Tag every outbound link with UTMs (`utm_source=<channel>&utm_medium=social|community|email&utm_campaign=<launch-slug>`).

   **Check:** Every asset is drafted, every link resolves with a 200, and the OG preview renders correctly in a link debugger.

4. **Lay out the T-minus timeline** (table below) with dates filled in, and share it as an artifact.

   **Check:** Every task has an owner and a date, and nothing critical is scheduled for launch day itself.

5. **Pass the readiness gate at T-1.** Confirm: deploy freeze in place; capacity headroom for a traffic spike (static pages cached, rate limits set); error monitoring and a status page; analytics and signup events verified end-to-end; support channel staffed; rollback plan; all posts approved by the user.

   **Check:** Every gate item is ticked or explicitly waived by the user.

6. **Run launch day** with the runbook below. The agent prepares, monitors and drafts replies; the user publishes posts and replies. Posting to any public channel, emailing a list, tagging a release or publishing a package needs explicit user confirmation for each action.

   **Check:** Every comment or question in the first six hours has a reply, and errors and signups are checked hourly.

7. **Review metrics** at T+1, T+7 and T+30 against the goal (template below). Write a retrospective artifact, capture reusable lessons with `/instinct-capture`, and save the session with `/session-save`.

   **Check:** The review compares the goal with the actual result per channel, and lists at least three follow-up actions with owners.

## Launch tiers

| Tier | What | Channels |
| :--- | :--- | :--- |
| 1 | New product, v1.0, public open-sourcing | All: site, Show HN, Product Hunt, Reddit, social, newsletters, email, docs, release |
| 2 | Major feature or major version | Blog/changelog, social, email, community, docs, release |
| 3 | Minor feature or improvement | Changelog, release notes, community post |

## Asset list

| Asset | Spec | Use |
| :--- | :--- | :--- |
| Landing page or hero update | Headline, subhead, CTA, proof, FAQ | `copywriting` |
| README hero | One-liner, badges, demo, copy-paste quickstart | `copywriting`, `doc-updater` |
| OG and social images | 1200x630, readable at thumbnail size, no small text | `image-processing-canvas`, `ai-image-generation` |
| Demo GIF or video | 10-30 s, shows the aha moment, captions, no audio required | `/video-render`, `remotion-motion-graphics`, `ffmpeg-multimedia` |
| Docs and quickstart | Tested in a clean environment, versioned | `/update-docs`, `documentation-writing` |
| Release notes and changelog | Breaking changes first, migration steps | `copywriting` |
| Announcement posts | One per channel, tailored (see below) | `copywriting`, `marketing-strategist` |
| Pricing page (if paid) | Tiers, limits, FAQ | `pricing-strategy` |
| SEO and metadata gate | Titles, canonicals, OG tags, sitemap | `seo-audit` |
| Email to existing users | Plain text, one CTA, unsubscribe link | `copywriting` |

## Channel post specs

| Channel | Format |
| :--- | :--- |
| Show HN | Title `Show HN: <Name> - <what it does in plain words>`; link to something people can try now, not a waitlist; the maker's first comment covers backstory, how it works, limitations and what feedback you want; no superlatives; never ask for upvotes |
| Product Hunt | Name, tagline within the form's limit, gallery (first image is the hook), demo video, maker comment; the PH day starts at 12:01 a.m. Pacific; ask for feedback, not upvotes |
| Reddit | Only subreddits whose rules allow it; text post with context and disclosure ("I built this"); different wording per subreddit |
| X, Bluesky, LinkedIn | Native video first, then problem, then link in the post or first reply; one thread, no tag spam |
| GitHub release | Tag, release notes, assets and checksums; pin a Discussion for feedback |
| Discord or community | Announcement plus a dedicated feedback channel or thread |

## T-minus timeline

| When | Tasks |
| :--- | :--- |
| T-21 | Launch defined, positioning check done, asset list assigned |
| T-14 | First drafts of all copy; demo recorded; quickstart tested in a clean environment |
| T-10 | Beta users or friends try the quickstart; fix every stumble |
| T-7 | Final copy; OG images; UTMs; Product Hunt page drafted; newsletter pitches sent |
| T-3 | Load and error-monitoring check; support rota; FAQ of expected objections |
| T-1 | Readiness gate; deploy freeze; all posts approved and queued as drafts |
| T-0 | Runbook below |
| T+1 / T+7 / T+30 | Metrics reviews and retrospective |

## Launch-day runbook

1. Ship: deploy, tag the release, publish the package, flip docs (each with user confirmation). Verify install from the public registry.
2. Publish the primary channel first (Product Hunt at 12:01 a.m. Pacific, or Show HN when the team can stay online for six or more hours), then the maker comment.
3. Stagger the remaining channels over the day rather than posting everywhere in the same minute.
4. Every hour: error rate, signup and activation events, top questions. Draft replies for the user; fix doc gaps immediately.
5. If something breaks: post a short, honest update in the same thread, fix or roll back, then follow up.
6. End of day: snapshot traffic by source, signups, activations and open issues.

## Metrics review template

```markdown
## Launch review: <name> T+<n>
Goal: <metric, target, date>  Result: <actual>  Verdict: hit | partial | missed
| Channel | Visits | Signups/installs | Activated | Activation % | Notes |
Qualitative: top 5 feedback themes with quotes; top objections; bugs found
Caveats: stars and downloads are attention, not usage; dark social shows as direct
Actions: <owner, action, date> x3+
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Launch before testing the quickstart as a stranger | Run it in a clean environment at T-14 and T-1 | Launch traffic is wasted on a broken first run |
| Ask friends to upvote, or coordinate voting | Ask for honest feedback and comments | HN and PH penalise voting rings and can bury the post |
| Post identical text to every channel | Tailor each post to the channel's norms | Communities remove copy-paste promotion |
| Launch on every channel in the same hour | Stagger and staff each one | Unanswered threads lose momentum and goodwill |
| Measure success by stars or upvotes | Measure activated users against the goal | Attention spikes fade; activated users compound |
| Let the agent publish posts directly | Draft for the user, who approves and posts | Public posts are irreversible and speak for the user |

## Verification checklist

- [ ] The goal metric has a number and a date.
- [ ] The quickstart was verified from the public registry in a clean environment.
- [ ] Every asset is complete, every link returns 200, and OG previews render.
- [ ] UTMs are on every outbound link.
- [ ] The readiness gate passed at T-1.
- [ ] Every public post, email, tag and package publish was confirmed by the user.
- [ ] T+7 review written, with actions and owners, and lessons captured.

## Related

- Knowledge: `brand-discovery`, `copywriting`, `growth-marketing`, `seo-audit`, `pricing-strategy`, `documentation-writing`, `image-processing-canvas`, `ai-image-generation`, `remotion-motion-graphics`, `ffmpeg-multimedia`.
- Workflows: `/video-render`, `/update-docs`, `/e2e`, `/verify`, `/pr-ready`, `/instinct-capture`, `/session-save`.
- Agents: `marketing-strategist` (positioning and post drafts), `multimedia-producer` (demo video), `doc-updater`, `e2e-runner` (stranger-path test), `performance-optimizer` (traffic readiness).
