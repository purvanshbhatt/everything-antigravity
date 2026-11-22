---
name: conference-talks
description: >-
  Prepares conference and meetup talks: choosing a talk-worthy idea, CFP
  abstracts reviewers accept, a narrative with one takeaway, slides readable
  from the back row, demos that cannot fail (recorded fallback, offline data,
  scripted state), timing, rehearsal and Q&A. Use when the user is submitting
  to a CFP, building a talk or live demo, or rehearsing a presentation.
---

# Conference Talks

A good talk changes how the audience thinks about one thing. Build it around
a single takeaway, prove it with a story or demo, and engineer the demo so it
still works on bad Wi-Fi with a borrowed adapter.

## When to use

- "Help me write a CFP", "turn this blog post into a talk", "plan a live demo".
- Internal tech talks, meetups, conference sessions, lightning talks and workshops' opening talks.
- Rehearsal feedback and timing cuts.

## When not to use

- Multi-hour courses or workshops: `curriculum-design`.
- General slide design for business decks: `presentation-slides`.
- The written version: `technical-blogging`.

## Workflow

1. **Pick an idea worth a slot.** Strong talks come from a hard-won lesson, a surprising result, a migration story with numbers, or a technique the audience can use on Monday. Check the event's audience level and tracks.

   **Check:** You can state the takeaway in one sentence the audience will remember next week.

2. **Write the CFP.** Title that names the outcome; abstract in three parts (the problem, what you will show, what attendees leave with); audience level; outline with timings; why you (the experience behind it). Reviewers reject vendor pitches and vague "intro to X" talks.

   **Check:** The abstract is within the CFP's word limit and states a concrete takeaway.

3. **Structure the narrative.** One big idea, at most three supporting points. A common arc: problem (why it matters to them), journey (what you tried, including failures), insight, how to apply it, recap. Plan one memorable moment: a demo, a before/after number, a striking visual.

   **Check:** Each section maps to the takeaway; anything that doesn't is cut.

4. **Make slides for the back row.** One idea per slide; large type (around 30 pt or more as a rule of thumb); high contrast; code at most ~12 lines with the relevant lines highlighted; diagrams built up step by step; no paragraphs to read aloud. Put details in speaker notes and a companion post.

   **Check:** Every slide is readable at 25% zoom on your laptop.

5. **Engineer the demo to be unbreakable.**
   - Record a full video of the demo as a fallback.
   - Run everything locally: local containers, seeded data, no dependency on venue Wi-Fi or a live third-party API.
   - Pin versions; tag each demo stage in git (`demo-1`, `demo-2`) so you can jump ahead.
   - Script commands (a text file or a demo runner) instead of typing from memory.
   - Large terminal font, light theme for projectors, notifications off, a clean browser profile, no secrets on screen.

   **Check:** The demo ran start to finish with networking disabled.

6. **Rehearse with a timer.** Run it aloud at least three times, once in front of someone. Mark the time at each section; cut 10% if you overrun. Know your skip points.

   **Check:** The final rehearsal fits the slot with about 10% to spare.

7. **Prepare for Q&A.** List the ten hardest questions and short answers. Repeat each question for the room and the recording. "I don't know; I'll follow up" is a valid answer.

   **Check:** Hard-question list exists with answers or follow-up plans.

8. **Publish the follow-through.** Slides, repo and links at a short URL on the last slide. Publishing slides or posts is outward-facing: get the user's explicit approval of what is shared, and scan for secrets first (`eag shield --file <export>`).

   **Check:** The user approved the shared materials; the shield scan is clean.

## Reference

| Slot length | Supporting points | Demo budget |
| :--- | :--- | :--- |
| 5 min (lightning) | 1 | Recorded clip only |
| 20-25 min | 2-3 | One short live demo, recorded fallback |
| 40-45 min | 3 | One or two demos with checkpoints |

Day-of checklist: adapters (HDMI, USB-C), charger, clicker, mirrored vs presenter view tested on the venue screen, water, offline copy of slides (PDF), recorded demo video on the laptop and a USB drive.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Cover everything you know | One takeaway, three points maximum | Audiences retain very little from dense talks |
| Live-code from memory | Scripted commands and git checkpoints | Typos under pressure eat minutes |
| Depend on venue Wi-Fi or live APIs | Local, seeded, recorded fallback | Conference networks fail routinely |
| Read your slides | Slides show, you tell | Reading aloud makes you redundant |
| Run over time | Cut ahead; know skip points | Overruns lose goodwill and the Q&A |

## Verification checklist

- [ ] One-sentence takeaway; every section supports it.
- [ ] CFP abstract within limits with a concrete outcome.
- [ ] Slides readable at 25% zoom; code highlighted and short.
- [ ] Demo works offline, has checkpoints and a recorded fallback.
- [ ] Three timed rehearsals; final run under the slot.
- [ ] Shared materials approved and secret-scanned.

## Related

- Knowledge: `presentation-slides`, `curriculum-design`, `technical-blogging`, `developer-relations`, `data-storytelling`, `editing`, `video-production-pipeline`.
