---
name: meeting-facilitation
disable-model-invocation: true
description: >-
  Plans and runs meetings that end in decisions: the meet-or-async test,
  outcome-based agendas, roles, facilitation techniques, decision records
  (DACI), action tracking, async alternatives, retrospectives and recurring
  meeting audits, using Google Calendar, Meet and Docs. Use when the user asks
  for an agenda, to run a workshop or retro, capture decisions, or cut meeting
  load.
---

# Meeting Facilitation

A meeting is worth holding when it produces a decision, alignment or a
relationship that a document cannot. Define the outcome first, invite only
the people needed for it, and leave with a written record of what was decided
and who does what next.

## When to use

- "Write an agenda for...", "run a workshop / kickoff / retro".
- A decision keeps getting reopened, or meetings end without one.
- Turning meeting notes into decisions and actions.
- Reducing meeting load or replacing status meetings with async updates.

## When not to use

- Sprint cadence and status reporting: `agile-project-management`.
- Recording an architecture decision in the repo: `/architecture-decision`.
- Incident reviews: `/postmortem`.
- 1:1s and performance conversations: `people-operations`.
- Building the slides for a presentation: `presentation-slides`.

## Workflow

1. **Apply the meet-or-async test.** Pure information sharing goes to a doc, an email or a recorded video. Decisions with disagreement or high ambiguity, creative work that benefits from live exchange, and relationship building justify a meeting.

   **Check:** You can state, in one sentence, why this cannot be async.

2. **Define the outcome and the decider.** Write the outcome as a finished state ("Decide between options A and B for launch pricing"), and name who decides and how (decider after input, consensus, or vote).

   **Check:** The agenda header contains the outcome and the decider.

3. **Write the agenda.** Phrase each item as a question, with an owner, a time box and the expected output (decision, input, information). Attach a pre-read. Invite the decider and the contributors; everyone else gets the notes. Send at least a day ahead for decision meetings.

   **Check:** Time boxes add up to less than the slot, leaving five minutes for actions.

4. **Prepare the pre-read** in a Google Doc: context, options with trade-offs, a recommendation, open questions. Keep it to a page or two.

   **Check:** Someone new to the topic could understand the options from the pre-read alone.

5. **Facilitate.** Open with the outcome and agenda. For decision meetings, start with a few minutes of silent reading and comments on the pre-read. Use round-robin so quiet voices are heard, park off-topic items in a visible list, keep time, and restate each decision as it is made. Pick techniques from the table below.

   **Check:** Each agenda item ends with its stated output or an explicit "deferred because...".

6. **Record decisions and actions** using the template below. Each action has one owner and a due date.

   **Check:** No action is owned by "team" or "everyone".

7. **Follow up within a day.** Draft the notes and send them to attendees and affected stakeholders only after the user confirms; move actions into the tracker. Never create, change or cancel calendar invites without explicit user confirmation.

   **Check:** Notes are in the shared folder and actions are on the board.

8. **Audit recurring meetings quarterly.** For each series, ask: what did it decide or unblock last month? Cancel, shorten, reduce attendance or convert to async.

   **Check:** Every surviving recurring meeting has a written purpose and owner.

Recording and transcription: tell participants before recording or turning on automatic notes, and respect objections. Consent rules for recording differ between jurisdictions, and some require everyone's consent.

## Techniques

| Need | Technique |
| :--- | :--- |
| Generate many ideas without anchoring | Silent writing first (in the doc or on sticky notes), then share |
| Involve everyone in a large group | 1-2-4-All: alone, pairs, fours, then whole group |
| Narrow options | Dot voting with a fixed number of votes each |
| Check agreement quickly | Fist-to-five; anyone at 0-2 explains their concern |
| Break a stalemate | Name the decider, timebox discussion, decide, record dissent |
| Remote meeting | Cameras optional, use chat for parallel input, call on people by name |

## Decision record

```markdown
## Decision: <title> (<date>)
- Driver: <who runs the process>  Approver: <who decides>
- Contributors: <consulted>  Informed: <told after>
- Context: <why this needed deciding>
- Options considered: A <trade-offs>; B <trade-offs>
- Decision: <what was chosen>  Rationale: <why>
- Dissent noted: <who, concern>
- Revisit if: <condition>
- Actions: <owner> - <action> - <due>
```

## Retrospectives

Run five stages: set the stage (purpose, safety check), gather data (timeline or notes), generate insights (patterns and causes), decide what to do (one to three actions), close. Keep it blameless: discuss systems and decisions, not individuals.

| Format | Good for |
| :--- | :--- |
| Start / Stop / Continue | Quick, regular retros |
| 4Ls (Liked, Learned, Lacked, Longed for) | End of a project or phase |
| Sailboat (wind, anchors, rocks, island) | Surfacing risks and goals |
| Timeline | Long projects or after incidents |

## Async alternatives

| Instead of | Use |
| :--- | :--- |
| Status meeting | Written weekly update in a shared doc, with comments for questions |
| Demo to a large group | Recorded walkthrough plus a comment thread |
| Brainstorm with 10 people | Comment-enabled doc open for 48 hours, then a short meeting to decide |
| FYI announcement | Email or channel post with a clear "action needed: none" |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Agenda of topics ("Pricing") | Questions with outputs ("Which price for launch?") | Topics invite discussion without conclusion |
| Invite everyone who might care | Decider and contributors; notes for the rest | Each extra person adds cost and slows decisions |
| Decide in the meeting, write nothing | Decision record within a day | Unwritten decisions get relitigated |
| Present slides that could be read | Silent reading of a pre-read | Reading is faster than listening and leaves time to discuss |
| Recurring meetings that never end | Quarterly audit | Calendars fill with meetings nobody owns |
| Record without telling people | Announce and get consent | Trust and legal requirements |

## Verification checklist

- [ ] The meeting passed the meet-or-async test.
- [ ] The agenda states outcome, decider, questions and time boxes.
- [ ] A pre-read was shared in advance for decision meetings.
- [ ] Decisions are recorded with rationale; every action has one owner and a date.
- [ ] Notes and invites were sent only after explicit user confirmation.
- [ ] Participants were told before any recording or transcription.

## Related

- Knowledge: `agile-project-management`, `people-operations`, `knowledge-management`, `presentation-slides`.
- Workflows: `/architecture-decision`, `/postmortem`.
- Agents: `chief-of-staff` (agenda prep, note-to-action follow-up).
