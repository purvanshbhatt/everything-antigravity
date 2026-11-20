# Contributing to Everything Antigravity

Thanks for helping make Antigravity and Gemini CLI better to work with.

## Setup

```bash
git clone https://github.com/purvanshbhatt/everything-antigravity.git
cd everything-antigravity
node bin/eag.js install --link     # junction/symlink your checkout into Antigravity so edits apply live
```

Requires Node.js 18+. There are no other dependencies.

## Adding or changing a skill, agent or rule

1. Read [docs/AUTHORING.md](docs/AUTHORING.md). It defines the format and the quality bar, and lists the Antigravity tool names and rule triggers that are known to work.
2. Use `skills/code-review/SKILL.md` and `agents/code-reviewer.md` as reference examples.
3. Workflow skills (slash commands) end their description with `Invoke with /<name>.` and must not reuse Antigravity built-in names: `plan`, `learn`, `goal`, `boost`, `swarm`, `teamwork`, `grill-me`, `schedule`, `hooks`, `skills`, `plugin`, `agents`.
4. Run the checks:

   ```bash
   npm run validate      # must report 0 errors
   npm run catalog       # regenerate docs/CATALOG.md
   npm test
   ```

5. If you have Antigravity installed, also run `agy plugin validate ~/.gemini/config/plugins/everything-antigravity --strict` after `eag install`.

## Changing hooks

Hooks run inside every user's agent loop, so they must be fast, deterministic and fail-open.

- Never print `{}` from a pre-tool hook (Antigravity treats it as deny) and never exit non-zero. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Write the test first in `tests/js/hooks.test.js` or `tests/js/shield.test.js`, and check that it fails for the right reason before implementing.
- New guard rules need both a positive case and a false-positive case.

## Pull requests

- Keep changes focused. One skill or one fix per PR is ideal.
- Never weaken or delete existing tests to make a change pass.
- Include the output of `npm run validate` and `npm test` in the PR description.
