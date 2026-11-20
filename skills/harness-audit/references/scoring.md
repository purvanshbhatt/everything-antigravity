# Harness Audit: Scoring Rubric and Report Template

## Rubric (100 points)

Start each category at its maximum and deduct per finding. A category never goes
below 0.

| Category | Max | Deductions |
| :--- | :--- | :--- |
| Name collisions | 20 | -10 per skill or agent shadowing a built-in; -5 per name defined by two sources; -3 per duplicated MCP server |
| Rules budget | 15 | -5 if always-on is 8k-14k estimated tokens; -15 if over 14k; -5 per file over 24 KB; -1 per file over 4 KB (max -4) |
| Hook health | 15 | -15 if the `eag doctor` smoke test fails; -5 per hook reported broken; -3 if the profile is `minimal` without a stated reason |
| MCP hygiene | 15 | -5 if 40-80 enabled tools; -10 if over 80; -2 per unused server (max -6); -5 if any inline credential |
| Plugin health | 10 | -5 per locally developed plugin failing `agy plugin validate --strict`; -2 per plugin installed twice or pinned to a stale copy |
| v1 leftovers | 10 | -5 per v1 command file shadowing a built-in; -2 per other v1 leftover (max -5) |
| Project rules | 10 | -10 if neither `AGENTS.md` nor `GEMINI.md` exists; -4 if present but missing build/test commands; -2 if over 6 KB |
| Secrets in harness config | 5 | -5 if `eag shield` flags any harness config file |

Grades: A 90-100, B 75-89, C 60-74, D below 60.

## Effort scale for fixes

| Effort | Meaning |
| :--- | :--- |
| S | Under 5 minutes, one command or one file |
| M | 5-30 minutes, a few files or a short rewrite |
| L | Over 30 minutes, needs decisions or coordination |

Order fixes by points recovered divided by effort (S=1, M=3, L=8).

## Report template

```markdown
# Harness Audit (<YYYY-MM-DD>) - Score <n>/100 (<grade>)

Antigravity setup: <n> plugins, <n> skills (<n> global, <n> workspace, <n> plugin),
<n> agents, <n> MCP servers / <n> tools, EAG <version>, profile <profile>.

## Scores
| Category | Score | Main finding |
| :--- | ---: | :--- |
| Name collisions | 15/20 | `review` skill defined by two plugins |
| Rules budget | 10/15 | always-on about 9.8k tokens (49% of 20k) |
| Hook health | 15/15 | all hooks pass smoke test |
| MCP hygiene | 5/15 | 92 tools enabled; `jira` and `figma` unused here |
| Plugin health | 10/10 | - |
| v1 leftovers | 5/10 | `commands/boost.md` shadows built-in `/boost` |
| Project rules | 6/10 | `AGENTS.md` lacks the test command |
| Secrets in harness config | 5/5 | - |

## Prioritized fixes
1. **[+10, S]** Disable unused MCP servers `jira`, `figma` (ask first: used by other projects?).
   - Change: <exact command or setting>
2. **[+5, S]** Remove v1 `commands/boost.md` from <path>.
3. **[+5, M]** Move the long examples out of `<rule file>` into a skill.

## Findings detail
### <Category>
- <finding> - evidence: `<command or path>`

## Not checked
- <anything skipped and why, e.g. `agy` not installed>
```

Never include secret values. Name the server and key instead.
