---
name: ux-research
description: >-
  Plans and runs UX research: choosing methods by question, recruiting with
  screeners and consent, interview guides about past behaviour, moderated
  usability tests with task success, SEQ and SUS, unbiased surveys with sample
  sizes, and synthesis from transcripts into affinity clusters, evidence-backed
  insights, personas and jobs to be done. Use when validating a problem,
  testing a prototype, writing a survey, or synthesizing interview notes.
---

# UX Research

Research reduces the risk of building the wrong thing or building it unusably.
Start from the decision the research must inform, choose the cheapest method
that can answer it, ask about real past behaviour rather than opinions, and
keep every insight traceable to evidence.

## When to use

- Validating that a problem exists before building.
- Testing whether people can complete tasks in a prototype or live product.
- Writing a survey or screener, or estimating sample size.
- Turning interview transcripts or test notes into insights and personas.

## When not to use

- Designing the flows and screens: use `ui-ux-design`.
- Quantitative behaviour at scale and funnels: use `product-analytics`; controlled experiments: `ab-testing`.
- Broader problem and opportunity discovery: use `product-discovery`.
- Desk research from published sources: use `/research-synthesis`.

## Workflow

1. **State the decision and questions.** "We will decide whether to build X; we need to know how teams currently do Y and where it fails." List 3-5 research questions and pick the method:

   | Question type | Method | Typical size |
   | :--- | :--- | :--- |
   | Why and how do people do this today? | Interviews, contextual inquiry | 5-8 per segment |
   | Can people use this design? | Moderated usability test | About 5 per round, iterate |
   | How many, how often, which preference? | Survey | Depends on margin of error |
   | How do people group or find content? | Card sort, tree test | 15-30+ |
   | What happens over weeks? | Diary study | 10-15 |

   **Check:** Each research question maps to a method and the decision it informs.

2. **Recruit ethically.** Screener with behavioural criteria ("used X in the last month"), exclusions (employees, competitors, recent participants), a quota per segment, and fair incentives. Consent covers recording, data use, storage and retention, and withdrawal. Store personal data separately from notes and pseudonymize participants (P1, P2).

   **Check:** Signed consent exists for every session and notes use participant codes only.

3. **Write the interview guide.** Warm-up, then past behaviour: "Tell me about the last time you...", "Walk me through what happened next", "What did you try before?", "What made that hard?". Probes: "Why was that important?", "Can you show me?". Avoid leading questions, hypotheticals ("Would you use...?") and asking users to design the solution. Close with "What else should I have asked?". About 45-60 minutes.

   **Check:** No question in the guide can be answered yes or no, and none mentions your solution.

4. **Plan usability tests.** Realistic scenarios without UI words ("You want to change the delivery date of your last order"), success criteria per task, think-aloud instructions, and metrics: task success, time on task, errors, Single Ease Question after each task, System Usability Scale after the session. Pilot with one colleague first.

   SUS scoring: ten items rated 1-5; odd items contribute (score - 1), even items (5 - score); sum and multiply by 2.5 for a 0-100 score. Around 68 is a commonly cited average.

   **Check:** The pilot ran and ambiguous tasks were rewritten.

5. **Write unbiased surveys.** One concept per question, neutral wording, balanced scales with a neutral or "not applicable" option, randomized option order, a screener and an attention check, short length. Sample size for a proportion at 95 % confidence and ±5 % margin is about 385 for large populations (n = 1.96² × 0.25 / 0.05²). Pilot with five people.

   **Check:** Each question maps to a research question; no double-barrelled or leading items.

6. **Conduct and capture.** One moderator, one note-taker; timestamped notes using a template (task, observation, quote, severity); record with consent. Debrief for 10 minutes after each session.

   **Check:** Notes for each session exist within 24 hours with participant codes and timestamps.

7. **Synthesize.** Break notes into atomic observations (one fact, a participant code, a timestamp or quote). Cluster by affinity, then write insights as pattern + reason + implication ("4 of 6 admins export to spreadsheets because filters cannot be saved, so saved views would remove a weekly manual step"). Rate evidence strength by how many participants and how directly observed. For many transcripts, delegate coding to parallel subagents with a shared codebook, then merge and reconcile. Never invent or paraphrase quotes as if verbatim.

   **Check:** Every insight cites participant codes and at least one verbatim quote or observation.

8. **Model users only from evidence.** Personas describe behaviours, goals and constraints observed in research, not demographics invented for colour. Jobs to be done: "When <situation>, I want to <motivation>, so I can <outcome>".

   **Check:** Each persona attribute traces back to research data.

9. **Share findings.** A short report artifact: decision, method and participants, top 3-5 insights with evidence, usability issues ranked by severity, recommendations, open questions. Add clips or quotes with consent. File insights in a searchable research repository.

   **Check:** The report answers the original research questions and states what remains unknown.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| "Would you use this?" | Ask about the last time they faced the problem | Stated intent poorly predicts behaviour |
| Leading questions ("How much do you love...") | Neutral, open prompts | Participants please the interviewer |
| Testing with colleagues | Recruit representative users | Insiders know the jargon and the system |
| One loud participant becomes the insight | Patterns across participants with evidence strength | Anecdotes mislead roadmaps |
| Paraphrased "quotes" | Verbatim quotes with participant codes | Fabricated evidence destroys trust |
| Keep recordings with personal data forever | Retention limits and pseudonymized notes | Privacy obligations and risk |

## Verification checklist

- [ ] Decision and research questions written; method matches each question.
- [ ] Screener, consent and pseudonymization in place.
- [ ] Guide and tasks free of leading and hypothetical questions; pilot done.
- [ ] Survey sample size and margin of error stated.
- [ ] Insights cite participants and verbatim evidence.
- [ ] Report answers the questions and lists open unknowns.

## Related

- Workflows: `/research-synthesis`.
- Knowledge: `ui-ux-design`, `product-discovery`, `product-analytics`, `ab-testing`, `gdpr-privacy`, `customer-support`.
- Agents: `ux-designer`, `product-manager`, `deep-researcher`.
