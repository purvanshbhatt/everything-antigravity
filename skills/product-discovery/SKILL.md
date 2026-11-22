---
name: product-discovery
description: >-
  Runs product discovery to decide what is worth building: outcome framing,
  opportunity mapping, recruiting and running customer interviews about past
  behaviour, synthesis with verbatim evidence, assumption mapping across value,
  usability, feasibility and viability, and cheap tests such as fake doors,
  concierge and prototype sessions. Use when the user has an idea to validate,
  asks how to interview customers, or wants to de-risk a feature before a PRD.
---

# Product Discovery

Discovery reduces the chance of building the wrong thing before engineering
time is spent. It tests four risks: value (will they want it), usability (can
they use it), feasibility (can we build it) and viability (does it work for the
business).

## When to use

- "Is this idea worth building?", "how do I validate this?", "help me interview customers".
- A feature request arrives with strong opinions and little evidence.
- Interview notes or call transcripts need to become themes and decisions.
- Before writing a PRD for anything that costs more than a few weeks.

## When not to use

- Formal usability studies, large surveys or personas: `ux-research`.
- Market sizing and industry analysis: `market-research`.
- The problem is validated and needs scoping: `product-requirements`.
- Measuring the impact of a shipped change: `ab-testing` or `product-analytics`.

## Workflow

1. **Frame the outcome and the decision.** Write the target outcome (a behaviour or metric), the decision discovery will inform (build, drop, change direction) and a timebox.

   **Check:** A one-line decision question and a deadline exist, for example "By *<date>*, decide whether to build *<X>* for *<segment>*."

2. **Map the opportunity space.** Build an opportunity solution tree: outcome, then opportunities (needs, pains and desires phrased from the customer's view), then candidate solutions, then assumption tests. Keep it in a Doc, Sheet or artifact.

   **Check:** At least three opportunities, and at least two candidate solutions for the opportunity you pursue.

3. **Recruit participants.** Sources: existing customers, recent churners, trial users who stalled, waitlists, communities. Screen on behaviour ("did *<job>* in the last month"), not demographics. Start with about five to eight people per segment and stop when new interviews stop producing new themes. Draft outreach messages for the user; send nothing until the user confirms the recipients and the text. Get consent before recording, and store notes according to `gdpr-privacy`.

   **Check:** A screener, a consent line and a schedule exist; every participant passed the screener.

4. **Interview about past behaviour.** Ask for specific recent stories, not opinions about the future. Use the guide below. Do not demo or pitch until the last minutes, if at all.

   **Check:** Each set of notes contains at least one specific past event: what they did, what it cost, and what they tried instead.

5. **Synthesize with evidence.** Put one observation per row in a Sheet (participant, verbatim quote, behaviour, pain, workaround, intensity 1-3). Cluster into themes and count participants per theme. You can delegate first-pass coding of transcripts to a subagent, but verify every quote against the source.

   **Check:** Each theme cites at least two participants with verbatim quotes; no theme rests on a paraphrase only.

6. **Map assumptions.** List the assumptions behind the leading solution under the four risks. Place them on an importance-by-evidence grid and test the important, low-evidence ones first.

   **Check:** The three riskiest assumptions each have a planned test.

7. **Run the cheapest test that could change the decision.** Pick from the test matrix below. Write pass and fail thresholds before collecting data.

   **Check:** The success threshold was recorded before the test started.

8. **Decide and hand off.** Write a one-page discovery brief: decision, evidence, remaining risks, and what would make you reverse the decision. Feed it into `product-requirements`.

   **Check:** The brief states a decision (not "more research needed" without a scoped next test).

## Interview guide

| Phase | Prompts | Avoid |
| :--- | :--- | :--- |
| Context | "Tell me about your role and how *<job>* fits into your week." | Asking about your product |
| Last time | "Walk me through the last time you *<job>*. What happened first?" | "Do you usually...?" (invites generalizing) |
| Dig | "What made that hard? What did you do next? What did it cost you in time or money?" | Accepting "it's annoying" without a story |
| Current solutions | "What do you use today? What have you tried and dropped? What do you pay?" | "Would you switch to...?" |
| Priority | "Where does this rank against other problems you have this quarter?" | Leading: "Isn't that frustrating?" |
| Close | "Who else should I talk to? May I follow up?" | Pitching or asking "would you buy this?" |

Compliments, feature requests and predictions are weak signals. Past behaviour, money already spent and workarounds people built are strong signals.

## Test matrix

| Test | Risk tested | Cost | Signal to measure |
| :--- | :--- | :--- | :--- |
| Fake door (button or landing page leading to a waitlist) | Value | Low | Click-through and signups; tell users honestly that it is not available yet |
| Concierge (deliver the outcome manually) | Value, viability | Medium | Repeat use, willingness to pay |
| Wizard of Oz (real front end, human back end) | Value, usability | Medium | Task completion, retention over a few weeks |
| Clickable prototype usability session | Usability | Low to medium | Task success and where people get stuck |
| Technical spike | Feasibility | Varies | Works on real data within the constraints |
| Pre-sale or letter of intent | Viability | Medium | Committed payment or signed intent |
| Survey after interviews | Prevalence of known themes | Low | Share of respondents with the problem |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Ask "would you use this?" | Ask about the last time they faced the problem | People predict their future behaviour poorly and are polite in interviews |
| Interview only friends and fans | Screen on recent behaviour; include churners | Friendly samples confirm what you already believe |
| Run discovery to justify a decision already made | Pre-register the decision and pass/fail thresholds | Validation theatre wastes time and misleads stakeholders |
| Pursue the first solution | Compare at least two solutions per opportunity | The first idea is rarely the best |
| Summarize without quotes | Keep verbatim quotes linked to participants | Paraphrases drift toward the researcher's view |
| Run a fake door that misleads or charges | Disclose after the click; never take payment details | Deceptive tests damage trust and may breach consumer law |

## Verification checklist

- [ ] The decision question and timebox were written before research started.
- [ ] Participants passed a behaviour-based screener and consented to recording.
- [ ] Outreach was sent only after the user confirmed recipients and text.
- [ ] Every theme has quotes from at least two participants.
- [ ] The riskiest assumptions were tested with thresholds set in advance.
- [ ] The discovery brief states a decision and what would reverse it.

## Related

- Knowledge: `ux-research`, `market-research`, `competitive-analysis`, `product-requirements`, `product-analytics`, `ab-testing`, `roadmap-prioritization`, `gdpr-privacy`.
- Workflows: `/research-synthesis`.
- Agents: `product-manager`, `ux-designer`, `deep-researcher`.
