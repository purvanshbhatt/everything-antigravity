---
name: instinct-capture
description: >-
  Distills a correction, a solved non-obvious bug, or a confirmed preference
  into an instinct (trigger "when X", action "do Y", evidence, scope, starting
  confidence), deduplicates it against existing instincts, and records it with
  the EAG CLI so future sessions start with it. Use right after the user
  corrects the agent, after a hard bug is fixed, or when the user says
  "remember this". Invoke with /instinct-capture.
---

# Instinct Capture

Instincts are small, confidence-weighted lessons that the SessionStart hook
injects into future conversations (up to 6, confidence 0.7 or higher). Capture
few and capture well: one sharp instinct that prevents a repeated mistake is
worth more than ten that restate common sense.

## When to use

- The user corrected you: "no, we use pnpm here", "don't mock the database in these tests".
- You solved a bug whose cause was non-obvious and likely to recur (a toolchain trap, an environment quirk).
- The user confirmed a preference: "yes, always put migrations in their own PR".
- You found a project convention that is not written down and cost you time.
- The user says "remember this", "learn this", "next time do X".

## When not to use

- Reviewing, reinforcing, pruning or promoting existing instincts: use `/instincts`.
- A multi-step procedure that already repeats: use `/skill-create`; instincts are one trigger and one action.
- A hard constraint every session must obey: propose a line in the project's `AGENTS.md` or `GEMINI.md` instead.
- A one-off fact about the current task (a ticket number, today's branch): that belongs in `/session-save`.
- Something a linter, formatter or type-checker already enforces.

## Workflow

Commands use `eag`. If it is not on `PATH`, run `node <plugin-root>/bin/eag.js <command>`
instead, where `<plugin-root>` is two levels above this SKILL.md.

1. **Name the lesson in one sentence** and the moment that taught it: the correction, the bug, or the confirmation. If you cannot state what you would do differently next time, there is no instinct.

   **Check:** You can point to the exact message, error or commit that is the evidence.

2. **Distill trigger and action.**
   - Trigger: `When <observable situation>`; specific enough that a future agent can recognize it from files, commands or the user's words.
   - Action: one imperative behaviour, `do Y` or `never Z, do Y instead`.
   - Evidence: what happened, with a date and a file, test, commit or error string.
   - Scope: `project` if it depends on this repository's stack, paths or conventions; `global` only for the user's cross-project preferences or truly universal toolchain facts. When unsure, choose `project`.

   **Check:** The trigger names something observable, and the action is a single behaviour.

3. **Choose a starting confidence** from the table in Patterns. Never start above 0.7; confidence above that must be earned with `eag instincts reinforce`.

   **Check:** The confidence matches the strength of the evidence, not how strongly you feel.

4. **Deduplicate.**

   ```bash
   eag instincts list --min 0 --json
   ```

   Compare by meaning, not wording.
   - Same lesson already recorded: run `eag instincts reinforce <id>` instead of adding.
   - Existing instinct contradicts the new one: show both to the user; on confirmation run `eag instincts weaken <id>` on the old one, then add the new one.
   - Existing one is a narrower case of the new one: add the general one only if the evidence covers the general case; otherwise reinforce the narrow one.

   **Check:** You can say which existing instinct, if any, is closest and why this is not a duplicate.

5. **Scan the text for secrets, then add.**

   ```bash
   eag shield --text "When running integration tests in this repo, start the db with docker compose up -d db first"
   eag instincts add --trigger "When running integration tests in this repo" --action "Start Postgres with 'docker compose up -d db' first; tests do not start it" --confidence 0.6 --scope project --evidence "2026-11-19: 14 tests failed with ECONNREFUSED 5432 until db started"
   ```

   The command is the same in PowerShell. Avoid double quotes inside values (use single quotes inside), because Windows PowerShell 5.1 mangles embedded double quotes passed to native programs. From a subdirectory or another repository, add `--project <repo-root>`.

   **Check:** `add` printed an id, and `eag instincts list` shows the instinct with the intended scope and confidence.

6. **Tell the user in one line:** `Learned (project, 0.6): When <trigger> -> <action>. id <id>.` Mention that it will be injected automatically once it reaches 0.7, and that `/instincts` can weaken or remove it.

   **Check:** The user saw the exact text that was stored.

## Patterns

### Starting confidence

| Evidence | Start at |
| :--- | :--- |
| Inferred from a single episode, not yet confirmed | 0.5 |
| Non-obvious bug, root cause verified by a test or reproduction | 0.6 |
| User confirmed a preference when asked ("yes, always") | 0.65 |
| User gave an explicit correction or standing instruction | 0.7 (injected from the next session) |

### Good and bad instincts

| Bad | Why it fails | Good |
| :--- | :--- | :--- |
| "Write good tests" | No trigger, no specific action, common sense | "When adding a repository method in `src/db/`, add an integration test in `tests/db/` against the docker Postgres; the team rejects mocked-DB tests" |
| "The build was broken" | A fact about the past, not a behaviour | "When `pnpm build` fails with `Cannot find module '@app/shared'`, run `pnpm -r build --filter @app/shared` first; workspace packages are not prebuilt" |
| "Use pnpm" (scope global) | True for this repo only | Same text with scope `project` |
| "When editing code, be careful with dates" | Trigger too broad to recognize | "When parsing dates from the billing API, treat them as UTC; responses omit the offset" |
| "Always ask before running migrations, and use Conventional Commits, and prefer small PRs" | Three lessons in one | Three separate instincts, each with its own evidence |
| "API key for staging is sk-..." | Stores a secret | Never store; reference the env var name if needed |

### Capture budget

At most three instincts per session. If more seem worth capturing, the
session's lessons probably belong in a skill (`/skill-create`) or project rules.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start at 0.9 because the user sounded certain | Start at 0.7 maximum and let reinforcement raise it | Inflated confidence crowds better instincts out of the six injected slots |
| Add without listing existing instincts | Run `eag instincts list --min 0 --json` and compare | Duplicates split confidence and waste injection slots |
| Record "what happened" | Record "when X, do Y" | Future agents act on behaviours, not stories |
| Make everything global | Default to `project` | Global instincts leak one repo's conventions into every other repo |
| Store tokens, hostnames of private systems, or customer data | Reference env var names; run `eag shield --text` | Instinct files are plain text and injected into every session |
| Capture lessons the linter or type-checker already enforces | Skip them | They spend context without changing behaviour |

## Verification checklist

- [ ] The trigger is observable and the action is a single behaviour.
- [ ] Evidence names a date and a concrete file, test, commit or error.
- [ ] Scope is `project` unless the lesson is truly cross-project.
- [ ] Starting confidence is 0.7 or lower and matches the evidence table.
- [ ] Existing instincts were checked; a duplicate was reinforced rather than re-added.
- [ ] `eag shield --text` passed, `eag instincts add` printed an id, and the user saw the stored text.

## Related

- Workflows: `/instincts` (review, prune, promote), `/skill-create`, `/session-save`, `/checkpoint`, `/deep-work`.
- Knowledge: `antigravity-customization`, `prompt-engineering`, `credential-sanitizer`.
