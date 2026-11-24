---
name: security-audit
description: >-
  Audits code and config for OWASP Top 10, secrets, authz gaps, injection and dependency risk, with ranked fixes.
---

# Security Audit

Find the vulnerabilities an attacker would use first, prove each with a
concrete path, and rate them consistently. Start from trust boundaries and
data flows, not from a scanner's output.

## When to use

- Auditing an application, a new endpoint, an auth flow or a feature that calls an LLM.
- Threat-modelling a design before it is built.
- Reviewing dependencies, container images and CI for supply-chain risk.
- Rating and writing up findings so they get fixed in the right order.

## When not to use

- Running the end-to-end scan workflow on a repo: use `/security-scan` (it applies this skill).
- Leaked keys in code or history: use `credential-sanitizer`.
- Agent runtime guardrails and hook tuning: use `agent-shield`; isolation of agent execution: `sandbox-isolation`.
- Designing login, sessions, OAuth and tokens from scratch: use `auth-patterns`.

## Workflow

1. **Scope and inventory.** List entry points (routes, RPCs, queues, webhooks, CLI, LLM tools), data stores, third parties, and roles. Use `grep_search` for route decorators and handlers. For a large codebase, delegate the inventory to the `codebase-explorer` subagent.

   **Check:** You have a table of entry points with their auth requirement and the data each one touches.

2. **Threat-model with STRIDE in 30 minutes.** Sketch the data flow with trust boundaries (internet to edge, edge to service, service to database, app to LLM, LLM to tools). For each element crossing a boundary, ask the six STRIDE questions below and note concrete threats.

   **Check:** Every trust boundary has at least one threat considered and a control (or a gap) named.

3. **Run the automated baseline** (cheap, catches known issues; never the whole audit):

   ```bash
   semgrep scan --config p/owasp-top-ten --config p/secrets
   osv-scanner scan source -r .          # v2 syntax; v1 is: osv-scanner -r .
   npm audit --omit=dev                  # or: pnpm audit --prod / pip-audit / govulncheck ./... / cargo audit
   trivy fs --scanners vuln,secret,misconfig .
   eag shield --file <path>              # secrets and prompt-injection signatures (see agent-shield)
   ```

   **Check:** Each tool's high and critical results are triaged as true positive, false positive (with reason) or accepted risk.

4. **Review by hand against the checklists.** Walk each entry point through [OWASP checklists](references/owasp-checklists.md): access control on every object, injection sinks, SSRF, deserialization, auth and sessions, headers, logging. For LLM features, apply the LLM Top 10 section.

   **Check:** Every authenticated route has a server-side authorization check you can point to by file and line.

5. **Prove each finding.** Give the request, input or sequence that triggers it, and the impact. Exploit only in a local or test environment you control; never against production or third-party systems without written permission from the user.

   **Check:** Each Critical or High finding has a reproducible trigger and an exact fix.

6. **Rate and report** with the severity rubric below. Delegate a second opinion on Critical findings to the `security-guard` subagent. Present the report as an Antigravity artifact.

   **Check:** Findings are ordered by severity, each with location, trigger, impact, fix and verification step.

## Reference

### STRIDE quick method

| Threat | Question at each boundary | Typical control |
| :--- | :--- | :--- |
| Spoofing | Can someone pretend to be another user or service? | Strong authn, mTLS or signed tokens, webhook signatures |
| Tampering | Can data be modified in transit or at rest? | TLS, integrity checks, authz on writes, immutable logs |
| Repudiation | Can someone deny an action? | Audit log with actor, time, request ID |
| Information disclosure | Can data leak through responses, errors, logs, side channels? | Field-level authz, error hygiene, encryption |
| Denial of service | Can someone exhaust CPU, memory, connections, money? | Rate limits, timeouts, size limits, budgets |
| Elevation of privilege | Can a user reach admin functions or another tenant? | Deny-by-default authz, tenant scoping in queries |

### Authn and authz review points

- Authorization on every request at the object level (`WHERE id = $1 AND tenant_id = $2`), not only on the route; this is where IDOR/BOLA lives.
- Deny by default; admin routes behind a separate check; no authorization decisions in the client.
- Sessions: rotate on login, `Secure; HttpOnly; SameSite=Lax` cookies, server-side invalidation on logout and password change.
- Tokens: verify signature and algorithm (reject `none`, pin expected `alg`), `exp`, `aud`, `iss`; short-lived access tokens; refresh-token rotation.
- Password storage with Argon2id, scrypt or bcrypt; rate-limit login, reset and MFA endpoints.

### Supply chain

- Lockfiles committed; installs in CI use frozen modes (`npm ci`, `pnpm install --frozen-lockfile`, `pip install --require-hashes`, `go mod verify`).
- SBOM per release (`syft scan dir:. -o cyclonedx-json`, or `trivy fs --format cyclonedx --output sbom.json .`) and vulnerability scan of the SBOM.
- Pin GitHub Actions to full commit SHAs; least-privilege `permissions:`; audit workflows with `zizmor`.
- Provenance: build attestations (SLSA, `gh attestation verify`), signed images (`cosign verify`), `npm audit signatures` for registry signatures.
- New dependencies: check maintenance, install scripts, typosquats, and whether a few lines of code would do.

### Headers baseline

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{random}'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
```

Roll out CSP with `Content-Security-Policy-Report-Only` first. `frame-ancestors` supersedes `X-Frame-Options`.

### Severity rubric

| Severity | Criteria | Examples | Fix by |
| :--- | :--- | :--- | :--- |
| Critical | Remote, unauthenticated or low-privilege; full data access, RCE or account takeover at scale | SQL injection on a public route, leaked prod cloud key, auth bypass | Now; block release |
| High | Significant data or privilege impact needing some precondition | IDOR across tenants, SSRF to metadata, stored XSS in admin UI | Before release |
| Medium | Limited impact or hard to exploit | Reflected XSS with CSP, missing rate limit on login, verbose errors | Within a sprint |
| Low | Defence in depth, minimal direct impact | Missing header, outdated library with no reachable vuln | Backlog |
| Info | Observation, no direct risk | Hardening suggestion | Optional |

Raise severity one level for regulated or highly sensitive data; lower it one level when exploitation requires an already-privileged insider. Use CVSS for external reporting if required.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Paste scanner output as the audit | Triage, prove and rate each finding | Scanners miss logic flaws and drown real issues in noise |
| Check auth only at the router | Object-level checks in data access | IDOR is the most common serious API flaw |
| Blocklist-based SSRF filtering | Allowlist destinations, resolve and check IPs, re-check after redirects | Encodings, DNS rebinding and redirects bypass blocklists |
| `pickle`, `yaml.load`, Java native serialization on untrusted input | JSON with schema validation, `yaml.safe_load` | Deserialization of attacker data is code execution |
| Trust LLM output as code, SQL or a URL | Treat it as untrusted input: validate, parameterize, sandbox | Prompt injection turns the model into an attacker proxy |
| Test exploits against production | Local or isolated test environment, with permission | Real damage and legal exposure |

## Verification checklist

- [ ] Entry points, roles and data stores are inventoried.
- [ ] A STRIDE pass covers every trust boundary.
- [ ] Dependency, secret and static scans ran and results were triaged.
- [ ] Every authenticated route has a verified object-level authorization check.
- [ ] LLM features were checked against the OWASP LLM Top 10.
- [ ] Each Critical and High finding has a trigger, impact, exact fix and verification step.
- [ ] No exploitation was attempted outside an environment the user approved.

## Related

- Workflows: `/security-scan`, `/code-review`, `/pr-ready`.
- Knowledge: `credential-sanitizer`, `agent-shield`, `sandbox-isolation`, `auth-patterns`, `api-design`, `docker-containers`, `ci-cd-github-actions`.
- Agents: `security-guard`, `code-reviewer`, `silent-failure-hunter`.
