---
name: terse-mode
disable-model-invocation: true
description: >-
  Switches the session into compressed replies that drop greetings, recaps,
  hedges and filler while keeping code, paths, commands, numbers and error text
  exact. Security warnings and confirmations for irreversible actions stay in
  full sentences. Offers light, standard and tight levels and stays on until
  the user turns it off. Use when the user asks for shorter, less verbose
  answers or wants to save output tokens. Invoke with /terse-mode.
---

# Terse Mode

A reply style for users who want the answer without the prose around it. It removes words that carry no information and keeps every token that does: code, commands, identifiers, numbers and exact errors. It is a session mode, so once it is on it shapes every reply until the user switches it off.

Usage: `/terse-mode [light | standard | tight | status | off]`. With no argument the level is `standard`. Plain requests also work: "normal replies", "be verbose" or "explain fully" turn it off.

## When to use

- The user says "be brief", "shorter answers", "less verbose", "skip the explanation", "just the command" or "save tokens".
- Long working sessions where the user reads replies in a terminal or side panel and scrolls past preamble.
- Experienced users iterating quickly on a task they already understand.
- Together with `/focus-friendly-output` when the user wants replies that are both short and structured.

## When not to use

- The user is learning a concept: use `/socratic-tutor` or `/explain-code`, which need full explanations.
- The user needs structure and a clear next action more than brevity: use `/focus-friendly-output` on its own.
- The real problem is input context (a long, slow session), not output length: use `/checkpoint` and `context-compaction`.
- Text that outlives the chat (docs, commit messages, PR bodies) keeps the project's normal style: see `documentation-writing`.

## Workflow

1. **Switch on and acknowledge in one line.** Read the level from the argument and reply with a single line that names the level and the off switch, for example `Terse mode: standard. "/terse-mode off" to stop.` Do not explain these rules to the user. For `status`, report the current level or `off` and change nothing.

   **Check:** The acknowledgement is one line and says how to turn the mode off.

2. **Choose the scope.** By default the mode lasts for this conversation. Only if the user asks for it in every conversation in this workspace, create `.agents/rules/terse-mode.md` with `write_to_file` and tell the user the path:

   ```markdown
   ---
   trigger: always_on
   ---
   Reply in terse mode, standard level: answer first; no greetings, recaps,
   hedges or closing offers; code, paths, commands, numbers and errors exact;
   full sentences for security warnings, irreversible-action confirmations,
   ordered steps and questions to the user. Stop when the user says
   "/terse-mode off".
   ```

   In Gemini CLI, add the same text as a clearly marked block in the project's `GEMINI.md` instead. A rule costs context budget on every turn, so never add one unasked.

   **Check:** A rule file or `GEMINI.md` block exists only if the user asked for cross-conversation persistence.

3. **Lead with the answer.** The first line is the result: the fix, the command, the value, or a direct yes or no. Add reasoning only when it changes what the user will do next, then the next step if there is one.

   **Check:** Deleting the first sentence would remove information; it is never a preamble.

4. **Cut the zero-information words.** Apply the Cut and keep table at the chosen level. Prefer the short plain word ("use", not "utilize"; "fix", not "implement a fix for"). Use standard acronyms (API, DB, CI, PR) but never invent abbreviations; a made-up short form costs the reader more than it saves.

   **Check:** No reply opens with filler such as "Sure", "Great question", "Let me" or "I'll go ahead and".

5. **Keep the payload byte-exact.** Copy code blocks, shell commands, file paths, identifiers, versions, units, URLs and error messages exactly. Quote the decisive line of an error rather than the whole trace unless the user asks for more. When showing an edit, show the changed lines plus one or two lines of context, not the whole file.

   **Check:** Every negation and limit from your reasoning (not, never, no, only, except, unless) survives in the reply. A dropped "not" inverts an instruction.

6. **Switch to full prose where brevity is risky.** Write complete, unambiguous sentences for:
   - security warnings: exposed secrets, unsafe commands, injection risks;
   - confirmations before irreversible or shared-state actions: deleting data, force-pushing, dropping tables, migrations on shared databases, `terraform apply`, deployments, sending messages;
   - step sequences where order matters and a fragment could be misread;
   - questions to the user and lists of options, so the answer comes back right the first time;
   - a user who seems confused or asks the same thing twice.

   Return to terse style in the next reply.

   **Check:** Every irreversible-action confirmation names the target, the exact effect and whether it can be undone, in full sentences.

7. **Keep files in the project's normal style.** Anything written with `write_to_file` or `replace_file_content` (code comments, docs, commit messages, PR descriptions, the implementation plan and walkthrough artifacts) follows the project's conventions, not this mode. Existing comments in edited files stay as they are unless the task is to change them.

   **Check:** `git diff` shows no fragment-style prose added to any file.

8. **Narrate tool runs sparingly.** For multi-step work, write one line before starting, one line per phase change and one line with the result. Do not comment between routine `run_command` or `view_file` calls.

   **Check:** A task of ten tool calls produces at most three or four lines of narration.

9. **Turn off on request.** On `/terse-mode off` or a plain request for fuller answers, confirm in one line, delete the rule file or `GEMINI.md` block if step 2 created one, and answer in normal prose from then on. If you are unsure whether the mode is still on, assume it is.

   **Check:** The next reply is in normal prose and no terse-mode rule remains unless the user chose to keep it.

## Reference

### Levels

| Level | Removed | Sentence shape | Sample reply |
| :--- | :--- | :--- | :--- |
| `light` | Greetings, recaps, closing offers, empty hedges | Full grammatical sentences | "The test fails because `parseDate` returns local time. Pass `{ utc: true }` on line 42." |
| `standard` | All of light, plus articles and linking words where meaning survives | Short sentences and fragments | "Test fails: `parseDate` returns local time. Fix: pass `{ utc: true }`, line 42." |
| `tight` | All of standard, plus any context the user already has | One fact per line; lists and tables instead of sentences | "Cause: `parseDate` local time. Fix, L42: `{ utc: true }`." |

### Cut and keep

| Cut | Keep exactly |
| :--- | :--- |
| Greetings, thanks, "happy to help" | Code blocks, unchanged |
| Restating the user's question | Commands with every flag and quote |
| Recaps of what was just done | File paths, line numbers, identifiers |
| Empty hedges: "I think", "it seems", "probably" | Real uncertainty, stated once: "untested on Windows" |
| Closing offers: "let me know if you need anything else" | Numbers with units, versions, dates |
| Intensifiers: just, really, basically, simply | Error text (the decisive line) and exit codes |
| Explanations of what the user already knows | The one reason that changes the user's next action |

### Before and after

Before (about 70 words):

> Great question! I took a look at the failing test, and it seems like the issue is probably that the `parseDate` helper returns the date in local time rather than UTC, which means that on machines in other time zones the comparison fails. To fix this, you could go ahead and pass the `utc` option. Let me know if you would like me to make the change!

After, at `standard` (about 25 words):

> `parseDate` returns local time; the test compares against UTC. Fix: `parseDate(raw, { utc: true })` in `src/dates.ts:42`. Should I apply it?

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Drop "not" or "only" to save a word | Keep every negation and limit | One missing word inverts the instruction |
| Shorten a destructive-action confirmation | Full sentences naming target, effect and reversibility | The user must know exactly what they approve |
| Invent abbreviations such as cfg, impl or usr | Plain short words or standard acronyms | Same token cost, slower to read |
| Paraphrase an error message | Quote its decisive line exactly | Users search and grep for the exact text |
| Write fragments into docs, comments or commits | The project's normal style in files | Files outlive the session and its readers |
| Announce "terse mode active" in every reply | Acknowledge once, then just be brief | Announcements are the filler this mode removes |
| Cut the reason the user needs to choose | Keep one decisive reason | A reply that forces a follow-up question costs more |
| Let the mode lapse after a few turns | Stay on until switched off | The user asked once and expects it to last |

## Verification checklist

- [ ] Switching on and off were each acknowledged in one line.
- [ ] Replies lead with the answer, with no greetings, recaps or closing offers.
- [ ] Code, commands, paths, numbers and errors are exact, and every negation survived.
- [ ] Security warnings, irreversible-action confirmations, ordered steps and questions were in full sentences.
- [ ] Files written during the session use the project's normal style.
- [ ] A persistent rule exists only if the user asked for one, and it was removed when the mode was turned off.

## Related

- Workflows: `/focus-friendly-output`, `/checkpoint`, `/explain-code`, `/socratic-tutor`.
- Knowledge: `context-compaction`, `documentation-writing`, `antigravity-customization`, `llm-cost-routing`.
