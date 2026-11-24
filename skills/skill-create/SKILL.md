---
name: skill-create
disable-model-invocation: true
description: >-
  Creates a new Antigravity skill from patterns that repeat in a project: mines
  git history (recurring commit types, frequently co-changed files), existing
  conventions and docs, drafts a SKILL.md to the EAG authoring standard in the
  workspace or global skills directory, validates its frontmatter, and tests it
  with a fresh agent. Use when the same multi-step procedure keeps recurring.
  Invoke with /skill-create.
---

# Skill Create

A good project skill is a procedure the team already follows, written down so
an agent follows it too. Mine it from evidence (history, scripts, CI, docs)
rather than inventing it, write it to the same standard as EAG's own skills,
and prove it works by watching a fresh agent use it.

## When to use

- The same multi-step change keeps happening: "add an endpoint", "add a feature flag", "release a package".
- The user says "make a skill for this", "teach the agent how we do X", "turn this into a command".
- `/instincts` promoted an instinct and the scaffold needs real content.
- A new teammate (human or agent) keeps getting the same procedure wrong.

## When not to use

- A one-line rule ("always use pnpm"): propose it for `AGENTS.md` or `GEMINI.md`, or use `/instinct-capture`.
- A single lesson still being proven: use `/instinct-capture`.
- Contributing a skill to EAG itself: follow `docs/AUTHORING.md` in the EAG repository and run `eag validate`.
- Auditing which skills are installed or colliding: use `/harness-audit`.

## Workflow

`<skill-dir>` below is the directory containing this SKILL.md; the helper
scripts live in its `scripts/` folder and need only Node.

1. **Confirm a skill is the right container.** A skill earns its place when the procedure has three or more steps, has happened at least three times, and has commands or checks worth writing down. Pick a kebab-case name that is not an Antigravity built-in (`plan`, `learn`, `goal`, `boost`, `swarm`, `teamwork`, `grill-me`, `schedule`, `hooks`, `skills`, `plugin`, `agents`) and not an installed skill (check `.agents/skills/`, `~/.gemini/config/skills/`, and `agy plugin list --json`).

   **Check:** You can name three past occurrences (commits, PRs or conversations) of the procedure.

2. **Mine git history.**

   ```bash
   git log --no-merges --pretty=format:%s -n 500 | sed -nE 's/^([a-z]+)(\([^)]*\))?!?:.*/\1\2/p' | sort | uniq -c | sort -rn | head -20
   git log --no-merges --name-only --pretty=format: -n 500 | grep -v '^$' | sort | uniq -c | sort -rn | head -25
   git log --no-merges --name-only --pretty=format:@@@ -n 300 | node <skill-dir>/scripts/cochange.js --top 20
   git log --stat -n 10 --grep "<keyword>"      # read real examples of the procedure
   ```

   ```powershell
   git log --no-merges --pretty=format:%s -n 500 | ForEach-Object { if ($_ -match '^([a-z]+)(\([^)]*\))?!?:') { $Matches[1] + $Matches[2] } } | Group-Object | Sort-Object Count -Descending | Select-Object -First 20 Count, Name
   git log --no-merges --name-only --pretty=format: -n 500 | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | Select-Object -First 25 Count, Name
   git log --no-merges --name-only --pretty=format:@@@ -n 300 | node <skill-dir>/scripts/cochange.js --top 20
   ```

   Recurring `type(scope)` pairs show which procedures repeat; co-changed pairs with high coupling show which files a procedure must touch together (for example a route, its schema, its test and the API docs).

   **Check:** You have the file set the procedure touches and two or three example commits to model the steps on.

3. **Mine conventions and docs.** Read `AGENTS.md`, `GEMINI.md`, `CONTRIBUTING.md`, `README.md`, the scripts in `package.json`, `Makefile`, `justfile` or `pyproject.toml`, and CI workflows (for example `.github/workflows/*.yml`); these hold the commands the team really runs. Note anything the examples did that the docs do not mention.

   **Check:** Every command you plan to put in the skill appears in the repository or is a standard tool command.

4. **Choose where it lives.** Workspace: `.agents/skills/<name>/` (shared with everyone via the repository). Global: `~/.gemini/config/skills/<name>/` (personal, every project). Ask if the choice is not obvious; project procedures go in the workspace.

   **Check:** The target directory does not already exist.

5. **Draft the SKILL.md** with `write_to_file`, using the skeleton in Patterns. Frontmatter has exactly `name` (equal to the directory name) and `description` (third person, what and when, the phrases users actually type, 450 characters or fewer, ending with `Invoke with /<name>.`). Each workflow step is an action with concrete commands and ends with a `**Check:**` line. Show the PowerShell form where it differs. Keep it 4-12 KB; move long tables or examples into `references/` and link them.

   **Check:** Each step traces back to an example commit, a script, or a doc from steps 2-3.

6. **Validate.**

   ```bash
   node <skill-dir>/scripts/check-skill.js .agents/skills/<name> --workflow
   ```

   Fix every `ERROR`; fix `WARN` lines unless you can say why they do not apply.

   **Check:** The script exits 0.

7. **Test with a fresh agent.** In a new conversation, or by delegating to a subagent with no context from this one, give a realistic request phrased the way a user would, without naming the skill. Confirm three things: the skill was selected, the steps were followed in order, and every command worked. Then try `/<name>` explicitly. If it was not selected, rewrite the description with the user's actual phrasing and repeat.

   **Check:** A fresh agent completed a real instance of the procedure using the skill, and you saw the evidence.

8. **Hand over.** Show the user the path and a short summary. For workspace skills, offer to commit it (`docs(agents): add <name> skill`) and commit only on a yes.

   **Check:** The user knows the skill exists, how it is triggered, and whether it is committed.

## Patterns

### SKILL.md skeleton

```markdown
---
name: add-endpoint
description: >-
  Adds a REST endpoint to the orders service: route, schema, handler, tests and
  API docs, following the team's conventions. Use when the user asks to add or
  expose an endpoint or API route. Invoke with /add-endpoint.
---

# Add Endpoint

<two or three sentences: purpose and the main risk this procedure prevents>

## When to use
- ...
## When not to use
- ... (name the better skill)

## Workflow
1. **<Action>.** <commands>
   **Check:** <how to confirm>

## Patterns
<one excellent example, decision table>

## Anti-patterns
| Don't | Do instead | Why |

## Verification checklist
- [ ] ...

## Related
- ...
```

### Container decision

| Evidence | Container |
| :--- | :--- |
| One behaviour, one trigger, still being proven | Instinct (`/instinct-capture`) |
| One-line constraint that must always hold | Project rules file |
| Multi-step procedure seen three or more times | Skill (this workflow) |
| Bounded investigation with a fixed output format | Agent definition (see `antigravity-customization`) |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Write the procedure from imagination | Model it on real commits, scripts and CI | Invented steps drift from what the team actually does |
| Describe it as "helps with endpoints" | Use the words users type and say when it applies | The router picks skills from the description alone |
| Teach the model generic knowledge | Spend words on this project's commands, files and traps | Generic advice costs context and changes nothing |
| Hard-code bash-only commands | Add the PowerShell form where it differs | Teammates may be on Windows |
| Ship without a fresh-agent test | Watch a context-free agent use it | Authors cannot see what their own skill leaves out |
| Name it after a built-in such as `plan` or `learn` | Pick a unique kebab-case name | Built-ins shadow or are shadowed, unpredictably |

## Verification checklist

- [ ] The procedure has three or more recorded occurrences.
- [ ] Commands come from the repository or standard tooling; none are invented.
- [ ] Frontmatter has exactly `name` and `description`; `check-skill.js` exits 0.
- [ ] Every workflow step ends with a `**Check:**` line.
- [ ] A fresh agent selected and followed the skill on a realistic request.
- [ ] Any commit was approved by the user.

## Related

- Workflows: `/instinct-capture`, `/instincts`, `/harness-audit`, `/update-docs`, `/codebase-onboard`.
- Knowledge: `antigravity-customization`, `prompt-engineering`, `agent-evals`, `git-workflow`, `documentation-writing`.
- Agents: `codebase-explorer` (to map the files a procedure touches in a large repository).
