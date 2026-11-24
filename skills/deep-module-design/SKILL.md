---
name: deep-module-design
disable-model-invocation: true
description: >-
  Designs and refactors toward deep modules, where a small interface hides a
  lot of behaviour: finds shallow wrappers, pass-through layers, leaked
  internals and change amplification, ranks the deepening opportunities and
  proposes interface-first refactors with tests and migration steps. Use when
  a codebase feels like many tiny files, one change touches many modules, or
  agents and new hires struggle to navigate it.
---

# Deep Module Design

A module is deep when its interface is much simpler than what it does. Callers learn a few names and get a lot of behaviour; the hard parts stay in one place. This skill gives a shared vocabulary for judging depth and a procedure for moving a codebase toward fewer, deeper modules without breaking it.

## When to use

- A simple feature needed edits in five or more files across several layers.
- The code has many one-method classes, `*Manager`/`*Helper`/`*Util` files, or services that only forward calls.
- Callers must know internal details: call order, retry rules, cache keys, config flags or error types from a library underneath.
- Tests break whenever internals move, because they test private seams rather than behaviour.
- An agent keeps opening ten files to answer "how does X work?".

## When not to use

- Choosing services, layers or deployment boundaries for a whole system: use `software-architecture`.
- Modelling a complex business domain and its language: use `domain-driven-design`.
- Removing dead code and duplicates: use `/refactor-clean`.
- Mechanics of changing risky code safely (strangler, branch by abstraction): use `safe-refactor` alongside this skill.

## Vocabulary

| Term | Meaning | Smell that reveals it |
| :--- | :--- | :--- |
| Depth | Behaviour hidden divided by interface a caller must learn | Interface as long as the implementation |
| Shallow module | Adds a name but little behaviour | Wrapper whose methods each call one method below |
| Pass-through | A method or layer that forwards arguments unchanged | Same signature on two or three layers |
| Information leakage | One design decision known by two or more modules | Change a format or rule and edit several modules together |
| Temporal coupling | Callers must call things in a fixed order | `init()` before `load()` before `use()`, documented in comments |
| Change amplification | One logical change needs many edits | Co-change in Git history across modules |
| Seam | A place where behaviour can be swapped without editing callers | Where tests and fakes plug in |
| Pull complexity down | The module absorbs a hard case instead of pushing it to every caller | Callers each repeat the same retry, default or error mapping |

Depth is not size. A 3,000-line module that mixes unrelated jobs is a god module, not a deep one. Each deep module should own one decision that callers no longer have to think about.

## Workflow

1. **Map the surface.** For the area in scope, list each module's public symbols and who calls them. Delegate a large area to the `codebase-explorer` subagent and ask for a table of module, exported names, caller count and callers.

   ```bash
   go doc -short ./internal/billing            # Go: exported identifiers
   git grep -n "^export " -- 'src/billing/*.ts' # TS/JS: exports per file
   git grep -n "__all__" -- 'app/billing/'      # Python: declared public names
   ```

   **Check:** You have a table with every module in scope, its public names and its callers.

2. **Find change amplification in history.** List files that change together. Pairs that always co-change across module boundaries mark a leaked decision.

   The snippet treats the first two path segments (`src/billing`) as the module and prints the module pairs that changed together most often. It runs the same way in bash and PowerShell.

   ```bash
   git log --since=6.months --name-only --pretty=format:--- -- src/ | node -e "
   const commits = require('fs').readFileSync(0, 'utf8').split('---').map((c) => [...new Set(c.split(/\r?\n/).filter(Boolean).map((f) => f.split('/').slice(0, 2).join('/')))]);
   const pairs = {};
   for (const mods of commits) for (const a of mods) for (const b of mods) if (a < b) pairs[a + ' + ' + b] = (pairs[a + ' + ' + b] || 0) + 1;
   console.log(Object.entries(pairs).sort((x, y) => y[1] - x[1]).slice(0, 15).map(([k, v]) => v + '  ' + k).join('\n'));
   "
   ```

   Read three or four commits behind each top pair to name the decision they share.

   **Check:** You can name the three decisions whose changes spread the furthest, with commit examples.

3. **Score the candidates.** For each shallow module, pass-through layer or leaked decision, record callers affected, co-change frequency and how much complexity callers repeat today. Rank by benefit over risk and pick at most three to work on.

   **Check:** The ranked list is in an implementation plan artifact, and each entry names the decision the new module will own.

4. **Design the interface first, twice.** For the top candidate, write two different interface sketches: signatures and doc comments only. Then write the caller code each one implies for two real call sites. Pick the one with fewer concepts at the call site, not the one that is easier to implement.

   **Check:** The chosen interface lets the real callers drop at least one concept: an option, a call-order rule, an error type or a helper.

5. **Pin behaviour at the new boundary.** Write tests against the new interface that capture current behaviour, including errors and edge cases. Where the old code has no tests, add characterization tests first and run them on the old code.

   **Check:** The new tests pass against a thin adapter over the old code before any internals move.

6. **Move internals behind the interface.** Implement the deep module by absorbing the wrappers, defaults, retries and error mapping that callers repeat. Keep old entry points as deprecated shims that call the new module.

   **Check:** The full suite passes and the shims are the only remaining users of the old internals.

7. **Migrate callers, then delete.** Move callers in small commits. Each commit must leave the build green. Remove each shim when `grep_search` shows no callers. Ask the user before removing anything that is part of a published API.

   **Check:** The public symbol count for the area dropped, the pass-through layers are gone, and callers changed only in ways the interface promised.

## Patterns

### Shallow versus deep

```ts
// Shallow: every caller assembles the same pieces and must know the rules.
const token = await auth.getToken(scope);
const key = idempotency.newKey(orderId);
const res = await retry(() => http.post('/charges', body, { token, headers: { 'Idempotency-Key': key } }), { attempts: 3 });
if (res.status === 402) throw new CardDeclined(res.body.code);

// Deep: one call; auth, idempotency, retries and error mapping live inside.
const receipt = await payments.charge({ orderId, amount, currency: 'EUR' });
```

The deep version owns four decisions. Changing the retry policy or the provider's error codes is now a one-module edit.

### Moves that add depth

| Situation | Move |
| :--- | :--- |
| Layers that forward the same call | Collapse them; keep the layer that adds behaviour |
| Callers repeat defaults or validation | Pull them into the module; expose fewer options |
| Library types leak through your API | Translate to your own types and errors at the boundary |
| Required call order | Make construction return a ready object, or hide the sequence in one method |
| Many tiny classes for one concept | Merge into one module with a small public surface and private helpers |
| Special cases exposed to callers | Define them out of existence: an empty result instead of an error, idempotent deletes |
| A config flag that every caller sets the same way | Make it the default; keep the option only if a real caller differs |

### Depth helps agents too

- An agent reads the interface file and doc comments first. A small, documented surface answers most questions without opening the implementation.
- Fewer exports mean `grep_search` returns fewer, more relevant hits.
- Tests at the module boundary give the agent a fast loop: change internals, run one test file.
- Keep one entry file per module (`index.ts`, `__init__.py`, `mod.rs`, the package doc in Go) and put the module's purpose in its first comment.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Split code into many small classes to look clean | Group by the decision being hidden | Tiny modules push composition work onto every caller |
| Add a layer that only renames calls | Delete it or give it real behaviour | Every layer costs a file to read and a name to learn |
| Expose every option "for flexibility" | Choose good defaults; add options when a caller needs one | Each option is part of the interface forever |
| Merge unrelated code to reduce file count | Keep one decision per module | A god module is large, not deep |
| Change the interface without tests in place | Pin behaviour first, then move | Refactors without a safety net change behaviour silently |
| Test private helpers directly | Test through the public interface | Internal tests block the refactor they should enable |

## Verification checklist

- [ ] Each changed module owns a named decision that callers no longer handle.
- [ ] Public symbols in the area went down, or stayed level while callers got simpler.
- [ ] No pass-through layer remains without a stated reason.
- [ ] Tests exercise the new interface and passed against the old code before migration.
- [ ] Every commit in the migration left the build and tests green.
- [ ] Removed published APIs were confirmed with the user and noted in the changelog.

## Related

- Knowledge: `software-architecture`, `domain-driven-design`, `safe-refactor`, `tech-debt`, `typescript-patterns`, `python-patterns`.
- Workflows: `/refactor-clean`, `/code-review`, `/tdd`, `/explain-code`.
- Agents: `codebase-explorer`, `code-architect`, `refactor-cleaner`.
