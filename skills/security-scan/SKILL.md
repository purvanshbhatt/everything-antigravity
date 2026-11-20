---
name: security-scan
description: >-
  Runs a layered security scan of a repository or diff: secrets (eag shield,
  gitleaks), dependency CVEs (npm, pnpm, pip-audit, govulncheck, cargo audit,
  osv-scanner), static analysis (semgrep, bandit, eslint security rules),
  config review (Docker, IaC, CORS, headers) and prompt-injection surfaces in
  LLM features. Returns severity-ranked findings with fixes. Use before a
  release, after adding dependencies, or on request. Invoke with /security-scan.
---

# Security Scan

Run cheap automated layers first, then spend human-grade attention where they
point. Each layer catches what the others miss: scanners find known patterns,
config review finds deployment mistakes, and only reading the code finds broken
authorization or prompt-injection paths. This replaces EAG v1's `/audit`.

## When to use

- Before a release, a public launch, or opening a repository.
- After adding or upgrading dependencies, or adding an LLM feature, a file upload, auth, or a new external integration.
- The user says "security scan", "audit for vulnerabilities", "check for leaked secrets", "are we safe to ship".
- A CVE announcement mentions something in the stack.

## When not to use

- Reviewing one diff for all defect types: use `/code-review` (it includes a security pass).
- Hardening agent tooling itself (sandboxes, egress, hook policies): use the `sandbox-isolation` and `agent-shield` knowledge skills.
- Auditing the Antigravity setup's own config: use `/harness-audit`.
- Incident response for a confirmed leak: rotate the credential first, then run this to find others.

## Workflow

Commands use `eag`. If it is not on `PATH`, run `node <plugin-root>/bin/eag.js <command>`
instead, where `<plugin-root>` is two levels above this SKILL.md. Never install a
missing scanner without asking; report it as "skipped: not installed" with the install hint.

1. **Scope and detect the stack.** Diff scan: `git diff --name-only --diff-filter=ACMR origin/main...HEAD`. Full scan: `git ls-files`. Detect ecosystems from manifests (`package.json`, lockfiles, `requirements*.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Dockerfile`, `*.tf`, Kubernetes YAML) and LLM call sites with `grep_search` for `generateContent`, `genai`, `chat.completions`, `messages.create`, `langchain`, `llamaindex`.

   **Check:** You know the scope (diff or full), the ecosystems, and whether LLM features exist.

2. **Secrets.**

   ```bash
   git diff --name-only --diff-filter=ACMR origin/main...HEAD | while read -r f; do eag shield --file "$f" || echo "^ finding in $f"; done
   gitleaks git --redact --no-banner          # history; older gitleaks: gitleaks detect --redact --no-banner
   ```

   ```powershell
   git diff --name-only --diff-filter=ACMR origin/main...HEAD | ForEach-Object { eag shield --file $_; if ($LASTEXITCODE -ne 0) { "^ finding in $_" } }
   gitleaks git --redact --no-banner
   ```

   Also confirm `.gitignore` covers `.env*` (except `.env.example`), key files and local credentials. A real secret in history must be rotated; removing it from history needs a force push and user consent, and does not un-leak it.

   **Check:** Every finding is classified real, test fixture, or false positive, with values redacted.

3. **Dependency CVEs.** Run what applies:

   | Ecosystem | Command |
   | :--- | :--- |
   | npm | `npm audit --omit=dev` (add `--json` for parsing) |
   | pnpm | `pnpm audit --prod` |
   | yarn | `yarn npm audit --all --recursive` (Berry) or `yarn audit` (Classic) |
   | bun | `bun audit` (recent Bun versions) |
   | Python | `pip-audit` in the project's virtual environment, or `pip-audit -r requirements.txt` |
   | Go | `govulncheck ./...` (reports only reachable vulnerabilities) |
   | Rust | `cargo audit` |
   | Any, lockfile-based | `osv-scanner scan source -r .` (v2; v1: `osv-scanner -r .`) |

   For each HIGH or CRITICAL, find the dependency path (`npm explain <pkg>`, `go mod why <module>`, `cargo tree -i <crate>`) and whether the vulnerable code is reachable. Never run `npm audit fix --force` or major upgrades without consent; they can break builds.

   **Check:** Each HIGH or CRITICAL has a path, a reachability note, and a fixed version or mitigation.

4. **Static analysis.**

   ```bash
   semgrep scan --config auto --error          # or --config p/owasp-top-ten
   bandit -r <python-src> -ll                  # medium severity and above
   gosec ./...                                 # Go, if installed
   ```

   JavaScript or TypeScript: if `eslint-plugin-security` is in the ESLint config, run the project's lint script; otherwise note it as a suggestion. Triage each hit by reading the code; drop false positives with a reason.

   **Check:** Every remaining hit has been read in context and is confirmed or dismissed.

5. **Config review.** Read, and use tools if installed (`hadolint Dockerfile`, `checkov -d .`, `trivy config .`):

   | Area | Look for |
   | :--- | :--- |
   | Dockerfile | Runs as root, `latest` tags, secrets in `ENV` or `ARG`, `ADD` of remote URLs, no `.dockerignore` |
   | IaC (Terraform, Kubernetes) | Public buckets, `0.0.0.0/0` ingress on admin ports, wildcard IAM, privileged pods, no resource limits, plaintext secrets |
   | CORS | `Access-Control-Allow-Origin: *` with credentials, origin reflected without an allowlist |
   | Headers and cookies | Missing CSP, HSTS, `X-Content-Type-Options`, `frame-ancestors`; cookies without `Secure`, `HttpOnly`, `SameSite` |
   | App config | Debug mode in production, verbose errors with stack traces, default credentials |

   **Check:** Each config file in scope was read or scanned, and findings cite `file:line`.

6. **Prompt-injection surfaces** (only if LLM features exist). Trace every untrusted input that reaches a prompt: user messages, retrieved documents, web pages, file uploads, email, tool and MCP outputs. For each path, check:
   - Can injected text trigger tools with side effects (send, delete, pay, write files) without a human confirmation?
   - Is model output rendered as HTML or Markdown (image-URL exfiltration, XSS), or executed (SQL, shell, code)?
   - Are secrets or other users' data present in the context the model sees?
   - Is untrusted content clearly delimited and labelled as data in the prompt?
   Run `eag shield --file` on prompt templates and a sample of ingested corpus files.

   **Check:** Each LLM entry point has a data-flow note and a verdict: mitigated, partially mitigated, or exposed.

7. **Triage, rank and delegate the deep pass.** Deduplicate across layers, then rate severity with the [severity rubric](references/severity-rubric.md). Delegate to the `security-guard` subagent when the scope includes auth or session handling, crypto, multi-tenant isolation, payment flows, or more than five HIGH findings: give it the findings table, the files, and the output contract "confirmed or rejected per finding, with an exploit sketch and a patch".

   **Check:** Every finding has severity, evidence, and an exact fix or mitigation.

8. **Report and stop.** Produce the report in the output format from the same reference file. Do not apply fixes automatically; offer to fix in severity order, and ask before dependency upgrades, history rewrites or config changes.

   **Check:** The report leads with the verdict and the CRITICAL and HIGH items, and lists skipped layers.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Paste a found secret into the report | Show the file, line, type and a redacted prefix | The report itself becomes a leak |
| Report 300 scanner hits raw | Triage, deduplicate, rank; drop false positives with reasons | Nobody fixes item 47 of an unranked list |
| Delete a leaked key from the file and move on | Rotate it, then clean history with consent | The key is already in clones, forks and CI logs |
| `npm audit fix --force` to get to zero | Upgrade deliberately with tests, or document a mitigation | Forced major upgrades break builds and hide behaviour changes |
| Treat a CVE as critical without checking reachability | Check the dependency path and usage | Unreachable CVEs crowd out real risk |
| Skip LLM features because scanners are quiet | Trace untrusted input to prompts and tools by hand | No scanner finds prompt injection reliably |
| Install scanners silently | Ask, or report the layer as skipped | Installing runs third-party code on the user's machine |

## Verification checklist

- [ ] Scope (diff or full) and ecosystems are stated.
- [ ] Secrets, dependencies, static analysis, config and LLM layers each ran or are listed as skipped with a reason.
- [ ] No secret value appears anywhere in the output.
- [ ] Every CRITICAL and HIGH has evidence, reachability where relevant, and a concrete fix.
- [ ] The deep pass was delegated to `security-guard` when the criteria applied.
- [ ] No fix, upgrade or history rewrite happened without consent.

## Related

- Workflows: `/code-review`, `/pr-ready`, `/harness-audit`, `/verify`, `/deep-work`.
- Knowledge: `security-audit`, `agent-shield`, `credential-sanitizer`, `sandbox-isolation`, `auth-patterns`, `docker-containers`, `terraform-iac`, `kubernetes-gke`, `prompt-engineering`.
- Agents: `security-guard` (deep review), `cloud-devops-engineer` (IaC fixes), `gemini-ai-engineer` (LLM feature mitigations).
