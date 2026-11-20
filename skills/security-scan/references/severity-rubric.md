# Security Scan: Severity Rubric and Output Format

## Severity rubric

| Severity | Meaning | Examples |
| :--- | :--- | :--- |
| CRITICAL | Exploitable now, remotely or by any user, with high impact | Live production secret in the repo; SQL injection on a public endpoint; RCE via deserialization; LLM tool that deletes data on injected instructions |
| HIGH | Exploitable with modest preconditions, or high impact with some barrier | Missing authorization check (IDOR); reachable CVE with a public exploit; wildcard IAM on a deploy role; CORS reflecting any origin with credentials |
| MEDIUM | Real weakness needing unusual conditions, or defence in depth missing on a sensitive path | Missing CSP; container runs as root; unreachable but high-score CVE in a direct dependency; verbose errors in production |
| LOW | Hardening and hygiene | `latest` image tags; missing `SameSite` on a non-session cookie; outdated but unaffected dependency |
| INFO | Observations and skipped layers | Scanner not installed; test fixture secrets correctly marked |

Raise one level when the asset is regulated data (payments, health, credentials)
or multi-tenant; lower one level when the finding is only reachable from an
already-privileged admin context. State the adjustment and the reason.

## Output format

```markdown
# Security Scan (<YYYY-MM-DD>) - <scope: diff origin/main...HEAD | full repository>

## Verdict: BLOCK RELEASE | FIX BEFORE RELEASE | OK WITH FOLLOW-UPS
<one sentence: the most important risk and the action>

## Summary
| Layer | Tool(s) | Result |
| :--- | :--- | :--- |
| Secrets | eag shield, gitleaks | 1 real (rotated: no), 2 test fixtures |
| Dependencies | npm audit, osv-scanner | 0 critical, 2 high (1 reachable) |
| Static analysis | semgrep | 3 confirmed, 11 dismissed |
| Config | hadolint, manual | 2 medium |
| LLM surfaces | manual trace | 1 exposed path |
| Skipped | bandit | not installed (`pipx install bandit`) |

## Findings
1. **[CRITICAL] <title>** - `path/file.ext:line`
   - Evidence: <what was found; secrets redacted to a 4-character prefix>
   - Impact: <who can do what>
   - Fix: <exact patch, upgrade target, or config change>
   - Reference: <CWE-, CVE-, or GHSA- id where applicable>
2. **[HIGH] ...**

## Dismissed (false positives)
- <tool rule id> at `file:line`: <reason>

## Follow-ups
- <hardening items and owners>
```

Never include a full secret, token, private key or connection string in the
output. Name the type, location and a redacted prefix only.
