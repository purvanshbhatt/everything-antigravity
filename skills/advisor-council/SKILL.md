---
name: advisor-council
disable-model-invocation: true
description: >-
  Puts a high-stakes decision before a council of independent advisors, each
  with a distinct lens such as skeptic, operator, user advocate, contrarian or
  domain expert. They answer in isolation, review each other's anonymized
  answers, and a chair writes a verdict with a confidence level, the strongest
  dissent and the conditions that would change it. Use for real trade-offs
  with stakes, not simple questions. Invoke with /advisor-council.
---

# Advisor Council

One reasoning pass tends to anchor on its first framing and then argue for it. A council forces several framings to exist before any of them wins: advisors with different priorities answer without seeing each other, critique each other blind, and a chair weighs the arguments rather than counting votes. The result is a recommendation that shows its strongest objection instead of hiding it.

Usage: `/advisor-council <decision>`, ideally with the options and constraints, for example `/advisor-council "Postgres or DynamoDB for the events store; 3 engineers, launch in 8 weeks"`.

## When to use

- A decision with at least two viable options, a real cost of being wrong and uncertainty that more facts alone will not remove.
- The user says "pressure-test this", "should we X or Y?", "poke holes in this plan", "I'm torn" or "what am I missing?".
- Choices that are hard to reverse: architecture, vendors, pricing, hiring, a launch or a rewrite.
- The user or the agent already leans one way and wants that lean challenged before committing.

## When not to use

- A factual question with a findable answer: research it with `/research-synthesis` or `/recency-research`.
- A trivial or easily reversed choice: answer directly with a short recommendation.
- The decision is made and needs recording: `/architecture-decision`.
- A design that needs writing up for review rather than debating: `/write-spec`.

## Workflow

1. **Gate and frame the decision.** Confirm it passes the When to use test; if not, say so and answer directly. Write a one-page brief: the decision in one sentence, the options (add "do nothing" or "delay" when that is realistic), constraints with numbers (budget, team, deadline), what is already known, how reversible each option is, and what "good" looks like in six months. Ask the user up to three questions only where the answer would change the brief.

   **Check:** The brief has at least two real options and states reversibility for each.

2. **Seat three to five advisors.** Choose lenses from the catalog under Reference so they disagree in useful ways. The default seats are Skeptic, Operator, User advocate and Contrarian, plus one Domain expert matched to the decision. Write what each lens cares about and what it distrusts in one line each.

   **Check:** No two seats would plausibly give the same answer for the same reason.

3. **Run the independent round.** Every advisor gets the same brief, its own lens, and the answer format under Reference, capped at about 200 words. In Antigravity, delegate each seat to its own subagent and run them in parallel, so no advisor sees another's answer. A matching EAG subagent can take a domain seat (`security-guard`, `database-architect`, `sre-engineer`, `product-manager`, `code-architect`). For model diversity, give seats different models where your setup allows it, for example custom subagents whose frontmatter sets `model: flash` or `model: pro` (see `subagent-delegation`). Without subagents, write each answer in sequence and do not revise earlier answers after writing later ones.

   **Check:** Each answer follows the format, takes a clear position and cites facts from the brief.

4. **Run a blind cross-review.** Shuffle the answers and label them A to E with no lens names. Give all of them to each advisor again (or to one fresh reviewer subagent) and ask for: a ranking by strength of reasoning rather than by agreement, the weakest claim in each answer in one line, and any risk that no answer raised.

   **Check:** Every answer received a ranking and a named weakest claim, and missing risks were collected.

5. **Write the chair's verdict.** As chair, weigh arguments by the evidence behind them, not by vote count. Use the verdict template: a recommendation with a confidence level and the reason for that level, the points of agreement, the strongest dissent stated in its best form, the observable conditions that would flip the recommendation, and the cheapest next step that would reduce the remaining uncertainty. Never present the verdict as certain, and never blend options into a compromise nobody argued for.

   **Check:** The verdict names a single recommendation, a confidence level, a dissent and at least one flip condition.

6. **Present and record.** Show the verdict first, then a short table of each seat's position and confidence, then the full answers only if the user asks. For technical decisions, offer to record the outcome with `/architecture-decision`, using the council's options and dissent as its alternatives and consequences.

   **Check:** The user can see who disagreed and why without reading every answer.

## Reference

### Lens catalog

| Lens | Asks | Seat it when |
| :--- | :--- | :--- |
| Skeptic | How does this fail? Which assumption is weakest? | Always |
| Operator | What does it cost to run, monitor and fix at 3 a.m.? | Infrastructure, tooling and vendor choices |
| User advocate | What does the user gain, lose or feel? | Product, UX, pricing, migrations users notice |
| Contrarian | What if the unpopular option is right? | Whenever the room already leans one way |
| Domain expert | What does a specialist (security, data, legal, finance) see that generalists miss? | The decision has specialist risk |
| Long horizon | How does this look in two years, at ten times the scale? | Architecture, platform bets, hiring |
| Pragmatist | What is the smallest reversible step we could take first? | High uncertainty, reversible options exist |

### Advisor brief and answer format

```markdown
You are the <Lens> advisor on a decision council. Take a clear position; do not hedge.
Decision: <one sentence>
Options: A) ... B) ... C) ...
Context: <constraints with numbers, deadline, reversibility, known facts>
Your lens: <what you care about> / <what you distrust>

Answer in at most 200 words:
Position: <one option>
Reasons: <up to 3 bullets, each tied to a fact in the context>
Biggest risk of my position: <one line>
What would change my mind: <an observable fact or result>
Confidence: low | medium | high
```

### Cross-review prompt

```markdown
Below are anonymous answers A-E to the same decision brief.
1. Rank them by strength of reasoning, not by whether you agree.
2. For each, name its weakest claim in one line.
3. Name any material risk that none of them raised.
```

### Verdict template

```markdown
## Council verdict: <decision>
Recommendation: <option>. Confidence: <low | medium | high>, because <one line>.
Agreement: <what most seats shared>
Strongest dissent (<lens>): <the best version of the opposing case>
Switch if: <observable condition that would flip the recommendation>
Next step to reduce uncertainty: <spike, experiment, data pull, customer call>
Seats: Skeptic B (medium) · Operator A (high) · User advocate A (medium) · Contrarian B (low) · Security A (high)
Cross-review: strongest answer <label>; risk nobody raised: <...>
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Convene a council for a trivial or factual question | Answer or research it directly | Ceremony without stakes wastes time and tokens |
| Let advisors read each other before answering | Isolated first round, parallel subagents | Early answers anchor later ones |
| Seat lenses that agree by construction | Pick lenses that pull in different directions | Five copies of one view only add confidence, not insight |
| Decide by majority vote | Weigh evidence and reasoning | Three weak arguments do not beat one strong one |
| Average the options into a compromise | Recommend one option; state the dissent | Blends often inherit the costs of both sides |
| Drop the losing view from the verdict | Keep the strongest dissent in its best form | The dissent tells the user what to watch |
| Present the verdict as certain | Give a confidence level and flip conditions | The council reduces uncertainty; it does not remove it |
| Let advisors write long essays | Fixed format, about 200 words each | Length hides weak reasoning and costs context |

## Verification checklist

- [ ] The decision passed the gate: two or more real options, real stakes, real uncertainty.
- [ ] Three to five seats with distinct lenses answered independently in the fixed format.
- [ ] A blind cross-review ranked the answers and named each one's weakest claim.
- [ ] The verdict has one recommendation, a confidence level, the strongest dissent, flip conditions and a next step.
- [ ] The user saw each seat's position, and technical decisions were offered `/architecture-decision`.

## Related

- Workflows: `/architecture-decision`, `/research-synthesis`, `/recency-research`, `/write-spec`, `/orchestrate`, `/deep-work`.
- Knowledge: `subagent-delegation`, `software-architecture`.
- Agents: `code-architect`, `security-guard`, `database-architect`, `sre-engineer`, `product-manager`.
