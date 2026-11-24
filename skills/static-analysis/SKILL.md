---
name: static-analysis
disable-model-invocation: true
description: >-
  Runs and tunes static analysis for bugs and security: Semgrep (registry
  rulesets, custom rules with tests, diff-aware scans), CodeQL, SonarQube
  quality gates and language-native analysers such as Bandit, gosec,
  staticcheck and clang-tidy, plus SARIF output, triage of true and false
  positives, suppressions with reasons and new-code-only CI gates. Use when
  adding SAST to CI, writing a custom rule, or drowning in scanner findings.
---

# Static Analysis

Static analysis is only useful if developers trust it. Gate on new,
high-confidence findings in changed code, triage every finding to true or
false positive with a reason, and turn recurring bug patterns from reviews and
incidents into custom rules with tests.

## When to use

- Adding SAST to a repo or CI, or choosing between Semgrep, CodeQL and SonarQube.
- A scanner produced hundreds of findings and someone has to triage them.
- A bug pattern keeps recurring and should become a rule.
- Code scanning alerts need explaining, fixing or suppressing.

## When not to use

- Formatting and style lint: use `linting-formatting`.
- Vulnerable dependencies: use `supply-chain-security` or `/dependency-upgrades`.
- A whole-codebase security assessment with threat context: use `/security-scan` or `security-audit`.
- Container image or cloud misconfiguration scanning: use `container-security` or `cloud-security-posture`.

## Workflow

1. **Pick tools by need.**

   | Tool | Strength | Use when |
   | :--- | :--- | :--- |
   | Semgrep | Fast, pattern rules that read like code, easy custom rules | Any repo; custom org rules; pre-commit |
   | CodeQL | Deep dataflow and taint tracking | GitHub repos; security-critical code |
   | SonarQube / SonarCloud | Quality gate on new code, maintainability metrics | Teams wanting one dashboard for bugs, smells and coverage |
   | Native analysers | Language-specific bug classes | Always, alongside one of the above |

   Native analysers: Bandit (`bandit -r src`), gosec (`gosec ./...`), staticcheck (`staticcheck ./...`), SpotBugs or Error Prone (Java), clang-tidy (C/C++), Clippy (Rust), Roslyn analyzers (.NET), PHPStan, Brakeman (Rails).

   **Check:** Each language in the repo has at least one bug-finding analyser plus one security-focused tool.

2. **Run a baseline scan with SARIF output.**

   ```bash
   semgrep scan --config p/default --sarif --output semgrep.sarif
   codeql database create codeql-db --language=python --source-root .
   codeql database analyze codeql-db codeql/python-queries --download --format=sarif-latest --output=codeql.sarif
   ```

   Compiled languages need a build command or build mode for CodeQL; check the current CodeQL docs for your language.

   **Check:** SARIF files exist, and you know the finding count by rule and severity.

3. **Triage.** Summarise findings by rule, then sample each rule. For each finding ask: is the source attacker-controlled, is the sink dangerous, is there a sanitiser or guard on the path, is the code reachable? For large batches, delegate rule groups to the `security-guard` subagent with the SARIF excerpt and the code paths.

   ```bash
   jq -r '.runs[].results[] | [.ruleId, .locations[0].physicalLocation.artifactLocation.uri, .locations[0].physicalLocation.region.startLine] | @tsv' semgrep.sarif | sort | uniq -c | sort -rn | head
   ```

   **Check:** Every HIGH or CRITICAL finding is labelled true positive, false positive or accepted risk, with a one-line reason.

4. **Fix true positives with tests.** Write a failing test that demonstrates the issue where practical, apply the smallest fix, and re-scan.

   **Check:** The finding disappears on re-scan and the test passes.

5. **Suppress false positives precisely.** Suppress inline with the rule ID (`# nosemgrep: <rule-id>`) and put the reason in a comment on the line above, or dismiss the CodeQL alert with a reason. If one rule produces mostly false positives, tune or disable it in config instead of scattering suppressions.

   **Check:** No blanket suppressions; each suppression names a rule and a reason.

6. **Write custom rules for recurring bugs** (example below), with test files, and run them in CI.

   **Check:** `semgrep --test rules/` passes, and the rule finds the original bug in history.

7. **Gate CI on new findings only.** Use diff-aware scanning (`semgrep scan --baseline-commit "$(git merge-base HEAD origin/main)" --error`), CodeQL pull request alerts, or Sonar's new-code quality gate. Upload SARIF to code scanning so results show inline on pull requests.

   **Check:** A pull request that introduces a known-bad pattern fails, and one that only touches unrelated code does not.

## Patterns

### Custom Semgrep rule with tests

```yaml
# rules/subprocess-shell-true.yaml
rules:
  - id: subprocess-shell-true
    languages: [python]
    severity: ERROR
    message: subprocess with shell=True and a non-literal command allows shell injection; pass an argument list
    patterns:
      - pattern: subprocess.$FUNC($CMD, ..., shell=True, ...)
      - pattern-not: subprocess.$FUNC("...", ..., shell=True, ...)
```

```python
# rules/subprocess-shell-true.py
import subprocess

# ruleid: subprocess-shell-true
subprocess.run(f"ls {user_dir}", shell=True)
# ok: subprocess-shell-true
subprocess.run(["ls", user_dir])
# ok: subprocess-shell-true
subprocess.run("ls -la", shell=True)
```

### Triage labels

| Label | Meaning | Action |
| :--- | :--- | :--- |
| True positive | Exploitable or a real bug | Fix with a test; severity sets the deadline |
| False positive | Rule is wrong here | Inline suppression with reason; tune the rule if frequent |
| Accepted risk | Real but mitigated elsewhere or out of scope | Document the mitigation and an owner; review on a date |
| Needs info | Cannot tell from code alone | Ask the owner; keep open |

### Metrics worth tracking

False-positive rate per rule (tune any rule above about 50 percent), median time to fix true positives by severity, and new findings per pull request. Total finding count alone says little.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Gate on every existing finding | Gate on new findings in changed code | Legacy debt blocks every merge and people disable the gate |
| Enable every ruleset available | Start with default or security sets, add deliberately | Noise destroys trust |
| `nosemgrep` without a rule ID or reason | Specific rule plus reason | Blanket suppression hides future true positives |
| Fix findings without understanding them | Trace source to sink first | Cosmetic fixes leave the vulnerability open |
| Treat a clean scan as "secure" | Combine with review and threat modelling | Scanners miss logic and authorisation bugs |
| Write rules with no tests | `ruleid` and `ok` annotated test files | Untested rules silently stop matching |

## Verification checklist

- [ ] Each language has a bug-finding analyser and a security-focused tool.
- [ ] All HIGH and CRITICAL findings are triaged with reasons.
- [ ] True positives fixed with tests; re-scan clean for them.
- [ ] Suppressions are specific and justified.
- [ ] CI gates on new findings only and uploads SARIF.
- [ ] Custom rules have passing tests.

## Related

- Agents: `security-guard`, `code-reviewer`, `silent-failure-hunter`.
- Workflows: `/security-scan`, `/code-review`, `/threat-modeling`.
- Knowledge: `linting-formatting`, `security-audit`, `supply-chain-security`, `api-security`, `ci-cd-github-actions`.
