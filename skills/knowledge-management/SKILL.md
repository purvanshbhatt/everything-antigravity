---
name: knowledge-management
disable-model-invocation: true
description: >-
  Builds team knowledge bases people actually use: content inventory,
  information architecture by audience and task, Diataxis doc types,
  docs-as-code with review and link checks, ownership and freshness metadata,
  decision logs, and pruning stale pages. Use when a wiki is sprawling or
  stale, when setting up a handbook, docs site or decision log, or when
  knowledge lives only in chat threads and people's heads.
---

# Knowledge Management

A knowledge base works when people find the right answer faster than they can
ask a colleague. That takes structure organised around readers' tasks, an
owner for every page, and a habit of moving answers out of chat into durable
docs.

## When to use

- "Our wiki is a mess", "nobody can find anything", "set up an engineering handbook".
- Migrating between wiki tools or into docs-as-code.
- Starting a decision log or making tribal knowledge durable before people leave.

## When not to use

- Writing one specific document: `documentation-writing` or `technical-blogging`.
- Recording one architecture decision: `/architecture-decision`.
- Writing operational runbooks: `runbooks-oncall`.
- Mapping a codebase: `/codebase-onboard`.

## Workflow

1. **Inventory what exists.** Export or crawl the current pages: title, path, owner, last edited, views if available. For docs-as-code repos, list files with `find_by_name` and read git history for last-modified dates (`git log -1 --format=%cs -- <file>`).

   **Check:** A spreadsheet or table lists every page with owner and last-edited date.

2. **Interview for top tasks.** Ask 5-10 people from each audience (new hires, engineers, support, on-call) what they looked for in the last month and where they found it. Pull the most-asked questions from chat and support tickets.

   **Check:** You have a ranked list of the top 20 questions with their current answer location (or "none").

3. **Design the information architecture.** Organise top-level navigation by audience and task, not by org chart. Inside each area use Diataxis types (table below). Write page titles in the words people search with.

   **Check:** Each top-20 question has a findable home within two clicks or one search.

4. **Set ownership and freshness rules.** Every page carries metadata: `owner` (a team, not a person), `last_reviewed`, `status` (current, draft, deprecated). In repos, enforce ownership with CODEOWNERS on docs paths.

   ```yaml
   ---
   title: Rotate the payments API key
   owner: team-payments
   last_reviewed: 2026-10-14
   status: current
   ---
   ```

   **Check:** 100% of pages in scope have an owning team.

5. **Migrate and prune.** Move high-value pages first, merge duplicates, and archive (don't delete) stale pages with a pointer to the replacement. Add redirects for moved URLs. Bulk deletion or archiving changes what others can find: list the pages and get explicit user confirmation first.

   **Check:** No broken inbound links; duplicates reduced to one canonical page each.

6. **Automate hygiene.** Link checking, Markdown lint and a freshness report in CI.

   ```bash
   lychee --no-progress "docs/**/*.md"
   npx markdownlint-cli2 "docs/**/*.md"
   python scripts/stale_docs.py      # pages whose last_reviewed is older than 180 days
   ```

   ```python
   import datetime, pathlib, re
   cutoff = datetime.date.today() - datetime.timedelta(days=180)
   for p in pathlib.Path("docs").rglob("*.md"):
       m = re.search(r"^last_reviewed:\s*(\d{4}-\d{2}-\d{2})", p.read_text(encoding="utf-8"), re.M)
       if not m or datetime.date.fromisoformat(m.group(1)) < cutoff:
           print(f"{p}\t{m.group(1) if m else 'missing'}")
   ```

   **Check:** CI fails on broken links; the stale report goes to page owners on a schedule.

7. **Build capture habits.** A "promote the answer" ritual: when a question is answered in chat twice, the answerer links or writes the doc. Decision records for every significant decision. A short weekly or monthly review of the stale report.

   **Check:** Repeat questions in chat are answered with links rather than retyped explanations.

8. **Measure.** Search queries with no results, top exits, time-to-answer in onboarding, support deflection, and the stale-page count trend.

   **Check:** At least two metrics are tracked with a baseline.

## Reference

| Diataxis type | Serves | Example title |
| :--- | :--- | :--- |
| Tutorial | Learning by doing | "Deploy your first service" |
| How-to guide | A specific task | "Rotate the payments API key" |
| Reference | Looking up facts | "Environment variables" |
| Explanation | Understanding why | "Why we use event sourcing for orders" |

| Tool shape | Good for | Watch out for |
| :--- | :--- | :--- |
| Docs-as-code (MkDocs, Docusaurus, Starlight) | Engineering docs reviewed with code | Non-engineers may not contribute |
| Hosted wiki | Cross-functional handbooks | Drift without ownership metadata |
| Decision log (ADRs in repo) | Why things are the way they are | Needs a habit, not a tool |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Mirror the org chart in navigation | Organise by audience and task | Readers don't know which team owns their question |
| Pages owned by individuals | Owned by teams | People leave; teams persist |
| Delete stale pages silently | Archive with a pointer, after confirmation | Silent deletion breaks links and trust |
| Big-bang migration of everything | Migrate top tasks first, archive the long tail | Most pages are rarely read |
| Rely on search alone | Titles and synonyms that match user words | Search only finds what is named the way people search |

## Verification checklist

- [ ] Inventory with owners and dates exists.
- [ ] Top questions mapped to findable pages.
- [ ] Every page has owner, last_reviewed and status metadata.
- [ ] Link check, lint and freshness report run automatically.
- [ ] Archive and deletion actions were confirmed by the user.
- [ ] Metrics have a baseline.

## Related

- Knowledge: `documentation-writing`, `editing`, `runbooks-oncall`, `meeting-facilitation`.
- Workflows: `/architecture-decision`, `/codebase-onboard`.
- Agents: `doc-updater`, `technical-writer`.
