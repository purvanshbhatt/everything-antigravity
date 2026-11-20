# Pull Request Body Template

Use the repository's own `.github/pull_request_template.md` when it exists, and
map these sections onto it. Delete any section that would be empty rather than
writing "N/A", except "Risk and rollback", which is always required.

```markdown
## Summary
<2-3 sentences: what this PR does, from the user's or caller's point of view>

## Why
<the problem or goal; link the issue: Closes #123>

## Changes
- <grouped by area, intent first: "Billing: prorate plan changes mid-cycle (`src/billing/prorate.ts`)">
- <reading order for large PRs: "Start with `prorate.ts`, then the route, then tests">

## Testing
| Gate | Command | Result |
| :--- | :--- | :--- |
| Types | `npm run typecheck` | pass |
| Lint | `npm run lint` | pass |
| Tests | `npm test` | 412 passed, 0 failed |
| E2E | `npx playwright test billing` | 6 passed |

Manual check: <steps a reviewer can repeat, with expected result>

## Screenshots
<before / after for any UI change; recordings for flows>

## Risk and rollback
- Risk: <what could break, for whom, how likely; data or migration impact>
- Rollback: <revert this PR | disable flag `billing.prorate` | run down-migration `<name>`>
- Monitoring: <metric, log or alert to watch after deploy>

## Notes for reviewers
- <decisions worth challenging, known limitations, follow-ups (with issue links)>
```

## Writing rules

- Lead with intent, not mechanics. The diff already shows the lines.
- Every "works" claim in Testing has a command and a result.
- Breaking changes go first in Summary, in bold, with the migration path.
- Never paste secrets, internal hostnames or customer data into PR text.
