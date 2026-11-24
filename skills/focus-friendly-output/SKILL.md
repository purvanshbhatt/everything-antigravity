---
name: focus-friendly-output
disable-model-invocation: true
description: >-
  Switches the session into an attention-friendly reply style: the single next
  action comes first, then short numbered chunks, explicit checkpoints that
  show progress, a quick recap after breaks and a parked list for tangents,
  with full detail moved lower instead of deleted. Stays on until the user
  turns it off. Use when the user loses track in long replies, gets
  interrupted often or asks for one step at a time. Invoke with
  /focus-friendly-output.
---

# Focus-Friendly Output

A reply style for readers whose attention is the scarce resource: people with ADHD, people working through interruptions, or anyone tired late in a long session. Every reply answers "what do I do now?" in its first line, then delivers the rest in small pieces with visible progress. No technical content is removed; detail moves lower, where it can be read on demand.

Usage: `/focus-friendly-output [on | status | off]`. With no argument it turns on. Run `/terse-mode` as well when the user wants the chunks compressed too.

## When to use

- The user says "one step at a time", "too much text", "I lost track", "what do I do next?", "keep it simple" or mentions ADHD.
- Multi-step tasks the user carries out by hand (setup, migrations, releases), where a skipped step is costly.
- Sessions with frequent breaks or context switches, where the user needs to re-enter quickly.
- Together with `/terse-mode` when replies should be both short and structured.

## When not to use

- The user wants the fewest words and no scaffolding: `/terse-mode` on its own.
- The user wants a deep explanation to read end to end: `/explain-code`.
- The user wants to learn by working it out: `/socratic-tutor`.
- Durable documents such as runbooks and READMEs: `documentation-writing`. This mode shapes chat replies, not files.

## Workflow

1. **Switch on and say how to stop.** Acknowledge in one line, for example `Focus mode on: next step first, one chunk at a time. "/focus-friendly-output off" to stop.` Only if the user wants it in every conversation, write `.agents/rules/focus-friendly-output.md` with `write_to_file` (frontmatter `trigger: always_on`, body summarizing the reply shape in steps 2-8), or a marked block in `GEMINI.md` for Gemini CLI.

   **Check:** The acknowledgement is one line, and a persistent rule exists only on request.

2. **Put the next action first.** Line one of every reply is `Next:` followed by one concrete action that starts with a verb and names the exact thing: the command to run, the file to open, the value to check or the question to answer. When the next move is the agent's, say so: `Next (me): running the auth tests.` Security warnings and irreversible-action confirmations go above `Next:`, in full sentences.

   **Check:** The first line can be acted on without reading anything else.

3. **Chunk the rest.** Show at most five numbered steps at a time. For longer procedures, group steps into stages and expand only the current one (`Stage 2 of 4: database`). Keep one idea per line and paragraphs to three lines at most. Bold at most one item per reply: the thing not to miss. Put each command the user runs in its own code block, ready to copy.

   **Check:** No paragraph is longer than three lines and no more than five steps are visible at once.

4. **Move detail down, never out.** Put explanations, alternatives, background and long logs under a final `Details` heading. Keep every warning, caveat and fact the user needs; only its position changes. A caveat that decides whether a step is safe stays next to that step.

   **Check:** The reply without its Details section is still enough to act on, and nothing needed was dropped.

5. **Show progress with checkpoints.** After each chunk of work, add a checkpoint line such as `Checkpoint: 3 of 7 done. Database migrated, tests green.` Keep a running checklist with `[x]` and `[ ]`, and mirror it in the Antigravity task list artifact for long tasks so progress survives scrolling. Name finished milestones plainly ("Migration done; that was the risky part.") without gushing.

   **Check:** Every reply that changes progress shows how much is done and how much is left.

6. **Ask one question at a time.** When a decision is needed, ask a single question with at most three options, one line each, the recommended option first and labeled. A question is never buried mid-reply: it sits right after `Next:` or is the `Next:` itself.

   **Check:** Each reply contains at most one question for the user.

7. **Park tangents.** When something interesting but off the path appears (a refactor idea, an unrelated warning in the logs), add it to a `Parked` list at the bottom instead of pursuing it. At the end of the task, ask whether to pick any parked item up. Anything that affects the safety or correctness of the current step is raised at once, not parked.

   **Check:** The reply follows one thread, and side issues appear only under Parked.

8. **Re-enter after breaks.** When the user returns after a gap, says "where was I" or switches back from other work, open with a three-line recap: the goal, what is done, the next action. If the break spanned conversations, run `/session-resume` first.

   **Check:** The recap fits in three lines and ends with the next action.

9. **Turn off on request.** On `/focus-friendly-output off` or a request for normal replies, confirm in one line, remove the rule file or `GEMINI.md` block if step 1 created one, and return to the usual style.

   **Check:** The next reply has no `Next:` line or checkpoint scaffolding.

## Reference

### Reply template

```text
Next: run `npm test -- src/auth` and paste the last 10 lines.

Stage 2 of 3: fix token refresh
1. Open `src/auth/refresh.ts`.
2. ...

Checkpoint: 4 of 9 done. Login works; refresh still fails.

Details
- Why refresh fails: the expiry is compared in seconds against milliseconds ...

Parked
- `src/utils/` has two date helpers that do the same thing.
```

### Before and after

Before: one 14-line paragraph that weighs three possible causes, mentions two unrelated warnings and ends with "so you will want to run the migration, then restart the worker, and keep an eye on the logs."

After:

```text
Next: run the migration.
  npm run migrate

Then:
1. Restart the worker: `npm run worker`.
2. Wait for the log line "listening on queue jobs".

Checkpoint: 2 of 4 done.

Details
- Cause: the worker reads the new `jobs.priority` column, which only exists after the migration.
- Ruled out: queue credentials (the connection succeeds) and the Node version.

Parked
- Two deprecation warnings from the logging library.
```

### Combining with terse mode

| Modes on | Reply shape |
| :--- | :--- |
| Focus only | `Next:` line, chunks in normal sentences, Details with full explanations |
| Terse only | Answer first, compressed sentences, no fixed scaffolding |
| Both | `Next:` line and checkpoints kept; chunk text and Details compressed as `/terse-mode` describes |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Open with context and leave the action for the end | `Next:` on line one | The action is what the reader came for |
| Delete detail to make the reply shorter | Move it under Details | The user may need it on a second read |
| Ask three questions in one reply | One question, recommended option first | Usually one gets answered and the rest are lost |
| Show a wall of 15 steps | Stages, with only the current one expanded | Long lists lead to skipped steps |
| Chase every side issue | Park it and offer it at the end | Tangents break the thread |
| Talk down ("don't worry, this is easy!") | Plain, neutral wording | Condescension costs trust and attention |
| Celebrate with emoji and exclamation marks | Name the milestone plainly | Noise competes with the next action |
| Comment on the user's attention or diagnose them | Shape the replies, not the person | The mode is a style choice, nothing more |

## Verification checklist

- [ ] Every reply starts with a concrete `Next:` line, with any warning or confirmation above it.
- [ ] No more than five steps visible, paragraphs of three lines or fewer, at most one question per reply.
- [ ] Checkpoints show done and remaining counts whenever progress changed.
- [ ] Detail was moved under Details and no needed caveat was dropped.
- [ ] Tangents were parked and offered at the end of the task.
- [ ] On and off were acknowledged in one line; a persistent rule exists only on request and was removed on off.

## Related

- Workflows: `/terse-mode`, `/session-resume`, `/checkpoint`, `/socratic-tutor`, `/explain-code`.
- Knowledge: `documentation-writing`, `context-compaction`, `antigravity-customization`.
