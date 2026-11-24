---
name: human-step-wizard
disable-model-invocation: true
description: >-
  Builds a resumable, interactive walkthrough script for setup steps only a
  person can do: vendor console clicks, creating API keys or OAuth clients,
  adding CI secrets, DNS changes at a registrar, billing approvals and
  cutovers. Each step prompts, reads secrets with masked input, validates what
  it can and saves progress. Use when a task stalls on a manual step or the
  user says "walk me through it". Invoke with /human-step-wizard.
---

# Human Step Wizard

Some steps need a person: their login, their MFA device, their payment card, their judgment. Instead of a wall of instructions in chat, generate a small script the user runs in their own terminal. It walks them through one step at a time, checks each result where it can, and remembers where they stopped. The agent never sees a secret value at any point.

**Secret rule.** Secret values travel from the user's keyboard straight to their destination (a secret manager, `gh secret set` on stdin, a git-ignored `.env`). The wizard never echoes them, never logs them, never writes them to its progress file, and the agent never reads them back. If a step would require the agent to handle a secret, redesign the step.

## When to use

- A task is blocked on something the agent cannot do: sign in to a vendor console, approve a charge, create an OAuth client, verify a domain, press a physical key.
- Onboarding or environment setup needs several manual steps in a fixed order, with values that later steps depend on.
- A cutover or migration needs a human to flip switches at agreed times, with checks between them.
- The user asks "walk me through it", "what do I click", or "I'll do the console part".

## When not to use

- The agent can do the step itself with existing CLI auth (`gcloud`, `gh`, `az`, `aws`): just run it with `run_command`, asking first if it changes shared state.
- One manual step with no follow-up: give the instruction in chat.
- A recurring operational procedure for on-call staff: write a runbook with `runbooks-oncall`.
- Moving secrets into a manager or designing rotation: `secrets-management`.
- A secret has already leaked: `credential-sanitizer`.

## Workflow

1. **Split agent work from human work.** List every step of the task. For each, decide whether the agent can do it with its own tools. A step is human-only when it needs the user's identity or MFA, a payment, a legal or business decision, physical access, or a console with no usable API or CLI. The browser agent may read public docs to find exact console paths, but it never signs in or types credentials.

   **Check:** Every wizard step has a written reason why the agent cannot do it.

2. **Write the step spec and get approval.** Produce a table (see Patterns) as an implementation plan artifact: id, title, where to go, what to do, what value comes back, whether it is secret, where the value goes, how to validate, and how to undo. Order steps so each one's inputs exist before it runs.

   **Check:** The user approved the spec, including where every secret will be stored.

3. **Pick the script form and the progress file.** Default to one zero-dependency Node script, because it runs the same on Windows, macOS and Linux. Use a bash plus PowerShell pair only if the project has no Node. Put the script where the user wants it (for example `scripts/setup/<task>-wizard.mjs`) and the progress file at `.wizard/<task>.json`, then add `.wizard/` to `.gitignore`.

   ```bash
   git check-ignore -v .wizard/oauth-staging.json
   ```

   **Check:** `git check-ignore` reports the progress file as ignored.

4. **Generate the script** with `write_to_file`, starting from [the Node template](references/node-wizard.md). Required behaviour: a banner with the step count and rough time; one step at a time, with the URL and exact actions; commands `done`, `skip`, `back` and `quit`; masked input for secrets that refuses to run without a TTY; validation after each step; progress saved after every step; resume at the first incomplete step; and flags `--dry-run` (print all steps, prompt for nothing), `--from <id>` and `--reset`.

   **Check:** `node scripts/setup/<task>-wizard.mjs --dry-run` prints every step in order and exits 0 without prompting.

5. **Validate without seeing the value.** Each step gets the strongest check that does not reveal a secret: the value matches an expected shape (prefix and length), a read-only call succeeds with it, or the destination lists the item by name. Print only pass or fail. Good checks: `gh secret list` shows the name; `gcloud secrets versions list NAME --limit=1` shows a version; `Resolve-DnsName` or `dig` shows the record; `curl -s -o /dev/null -w "%{http_code}"` returns 200. Mark steps with no automatic check as "confirm manually" and say why.

   **Check:** No validation prints, logs or returns a secret value; every step has a check or a stated reason it has none.

6. **Hand the command to the user.** Tell them the exact command to run in their own terminal. Do not run the wizard through `run_command`: it is interactive, and its output would land in the agent's context. Stay available for questions while they work.

   **Check:** The user confirms they started it, or reports where they got stuck.

7. **Resume the agent's part.** Read the progress file with `view_file`; it holds step ids, timestamps and non-secret values only. Continue with the agent-side work that was waiting (deploy, migrate, run the integration test), and send the user back to `--from <id>` for any failed step.

   **Check:** The progress file shows every required step done, and the downstream check (a deploy, a smoke test) passes.

8. **Keep or retire the wizard.** If the procedure will recur (new environments, new teammates), offer to commit the script as a runbook, without the progress file. Otherwise delete it after the user agrees.

   **Check:** The user chose; nothing under `.wizard/` is staged (`git status --short`).

## Patterns

### Step spec

| Id | Step | Where | Value returned | Secret | Goes to | Validate | Undo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| consent | Configure the OAuth consent screen | Cloud console, APIs and Services | none | no | none | manual confirm (no read API) | edit the screen |
| client | Create a web OAuth client | Cloud console, Credentials | client ID; client secret | ID no; secret yes | ID in `.wizard`; secret in Secret Manager via stdin | `gcloud secrets versions list` shows a version | delete the client |
| ci | Add the client ID as a CI variable | repository settings | none | no | CI variables | `gh variable list` shows the name | delete the variable |

### Masked input by platform

| Platform | Read without echo | Send without touching disk |
| :--- | :--- | :--- |
| Node | raw-mode stdin reader (in the template) | the template's `run('gcloud', [..., '--data-file=-'], { input: v })` |
| bash | `read -rs -p "Client secret: " v; echo` | `printf '%s' "$v" \| gh secret set NAME; unset v` |
| PowerShell 7 | `$s = Read-Host "Client secret" -AsSecureString` | `ConvertFrom-SecureString $s -AsPlainText \| gh secret set NAME` |

Pass secrets on stdin, never as command-line arguments: arguments show up in process lists and shell history.

### Progress file

```json
{
  "task": "oauth-staging",
  "started": "2026-11-23T10:02:11Z",
  "steps": {
    "consent": { "status": "done", "at": "2026-11-23T10:09:40Z" },
    "client": { "status": "done", "at": "2026-11-23T10:15:02Z", "values": { "clientId": "1234-example.apps.googleusercontent.com" } },
    "ci": { "status": "pending" }
  }
}
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Ask the user to paste a key into chat | Masked input piped straight to its destination | Chat transcripts are stored and may be shared |
| Wizard a step the agent could run | Run it with `run_command` and confirm if it mutates | Every manual step is a chance for a typo |
| Pass a secret as a CLI argument | Pipe it on stdin | Arguments leak through process lists and history |
| Save secrets in the progress file "for resume" | Save only the fact that the step is done | The progress file outlives the session |
| A 40-line instruction dump | One step per screen with a check after it | People skip lines; checks catch it at the step that failed |
| Validate by printing the value | Check shape, a read-only call, or a listing by name | Printing defeats masking |

## Verification checklist

- [ ] Every wizard step has a reason it is human-only.
- [ ] The step spec was approved before the script was written.
- [ ] `--dry-run` works; the progress file is git-ignored and holds no secrets.
- [ ] Secrets are read masked, piped on stdin, and never echoed, logged or returned to the agent.
- [ ] Each step has a validation or an explicit manual confirmation.
- [ ] The user ran the wizard in their own terminal, and downstream checks passed.

## Related

- Knowledge: `secrets-management`, `credential-sanitizer`, `agent-shield`, `cli-development`, `bash-scripting`, `powershell-scripting`, `runbooks-oncall`, `ci-cd-github-actions`.
- Workflows: `/release-management`, `/verify`.
- Agents: `security-guard` (review the script's secret handling before the user runs it).
