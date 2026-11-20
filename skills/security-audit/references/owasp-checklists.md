# OWASP checklists

The 2025 web list reorganised the 2021 one. Use whichever your organisation
reports against; the checks below cover both. Mapping is approximate.

## OWASP Top 10 (web)

| 2021 | 2025 | What to check |
| :--- | :--- | :--- |
| A01 Broken Access Control | A01 Broken Access Control (now includes SSRF) | Object-level authz on every read and write; tenant scoping in queries; no privilege from client-supplied fields (`role`, `isAdmin`); CORS not reflecting arbitrary origins with credentials; directory traversal in file paths |
| A05 Security Misconfiguration | A02 Security Misconfiguration | Debug off, default credentials removed, verbose errors off, cloud buckets private, security headers, least-privilege IAM, XXE disabled in XML parsers |
| A06 Vulnerable and Outdated Components | A03 Software Supply Chain Failures | Lockfiles, SCA scans, SBOM, pinned CI actions, provenance and signatures, build system access control |
| A02 Cryptographic Failures | A04 Cryptographic Failures | TLS everywhere; no MD5/SHA-1 for security; Argon2id/bcrypt for passwords; keys in a KMS or secret manager; random from a CSPRNG; no home-made crypto |
| A03 Injection | A05 Injection | Parameterized SQL; no shell string building (`shell=True`, backticks); template autoescaping; NoSQL operator injection (`$where`, `$ne`); LDAP, XPath; XSS via `innerHTML`/`dangerouslySetInnerHTML` |
| A04 Insecure Design | A06 Insecure Design | Threat model exists; business-logic limits (coupon reuse, negative quantities, race on balance); rate limits on expensive flows |
| A07 Identification and Authentication Failures | A07 Authentication Failures | MFA available; credential stuffing protection; session rotation; secure reset flow; JWT validation |
| A08 Software and Data Integrity Failures | A08 Software or Data Integrity Failures | Unsafe deserialization; unsigned updates or plugins; CI pipelines that run untrusted PR code with secrets |
| A09 Security Logging and Monitoring Failures | A09 Security Logging and Alerting Failures | Auth events, authz failures and admin actions logged with actor and request ID; alerts wired to a human; no secrets or PII in logs |
| A10 Server-Side Request Forgery | (merged into A01) | See SSRF below |
| (n/a) | A10 Mishandling of Exceptional Conditions | Fail closed on errors; no stack traces to users; exceptions in authz or payment paths cannot skip checks; resource cleanup on error |

## SSRF checklist

- Is any URL, hostname, IP, webhook target, image URL, PDF renderer input or import source user-controlled?
- Allowlist schemes (`https` only) and destination hosts where possible.
- Resolve the hostname, reject private, loopback, link-local and metadata ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16` including `169.254.169.254`, `::1`, `fc00::/7`, `fe80::/10`), then connect to the resolved IP to avoid DNS rebinding.
- Disable redirects, or re-validate every redirect target.
- Run fetchers in an egress-restricted network segment. On Google Cloud the metadata server requires the `Metadata-Flavor: Google` header, which blocks naive SSRF but not attacker-controlled headers.

## Deserialization checklist

| Language | Dangerous | Safe alternative |
| :--- | :--- | :--- |
| Python | `pickle.loads`, `yaml.load` without SafeLoader, `marshal`, `shelve` on untrusted data | `json`, `yaml.safe_load`, `defusedxml` for XML |
| Java | `ObjectInputStream.readObject`, XStream and Jackson default typing | JSON with explicit types, `ObjectInputFilter` allowlists |
| .NET | `BinaryFormatter`, `NetDataContractSerializer`, `TypeNameHandling.All` | `System.Text.Json` |
| PHP | `unserialize` on user data | `json_decode` |
| JavaScript | `node-serialize`, `eval`/`new Function` on input | `JSON.parse` plus schema validation |
| Ruby | `Marshal.load`, `YAML.load` on old Psych | `JSON.parse`, `YAML.safe_load` |

## Logging hygiene

- Never log passwords, tokens, API keys, session IDs, full card numbers, secrets in URLs or full request bodies; use structured logging with a redaction list.
- Log security events: login success and failure, MFA changes, password resets, permission denials, admin actions, data exports.
- Include request or trace ID, actor ID, tenant, source IP; use UTC timestamps.
- Neutralise CR/LF in user-supplied values to prevent log injection (structured JSON logging does this).
- Restrict log access; logs often contain more personal data than the database.

## OWASP Top 10 for LLM Applications (2025)

| ID | Risk | What to check |
| :--- | :--- | :--- |
| LLM01 | Prompt Injection | Untrusted content (web pages, emails, issues, PR comments, retrieved documents, tool outputs) is delimited and treated as data; side-effecting tools need human confirmation; the model cannot widen its own permissions |
| LLM02 | Sensitive Information Disclosure | No secrets or other users' data in prompts or retrieval scope; per-user authz applied before retrieval; output filtering for PII where required |
| LLM03 | Supply Chain | Model and dataset provenance; pinned model versions; vetted plugins, MCP servers and tool packages |
| LLM04 | Data and Model Poisoning | Controlled fine-tuning and RAG ingestion sources; review of user-contributed content before it enters indexes |
| LLM05 | Improper Output Handling | Model output is escaped before HTML rendering, parameterized before SQL, never passed to `eval` or a shell; URLs and markdown images from output can exfiltrate data |
| LLM06 | Excessive Agency | Minimal tools and scopes; read-only by default; per-action approval for destructive or outward-facing operations; sandboxed execution |
| LLM07 | System Prompt Leakage | No secrets or authz logic in system prompts; assume they will be revealed |
| LLM08 | Vector and Embedding Weaknesses | Tenant isolation in vector stores; access control on retrieved chunks; protection against embedding inversion for sensitive data |
| LLM09 | Misinformation | Grounding with citations; human review for high-stakes output; evaluations for factuality |
| LLM10 | Unbounded Consumption | Token, request and cost limits per user; timeouts; max tool-call loops; budget alerts |

For agent runtimes specifically, combine this list with `agent-shield` (hook guardrails, injection signatures) and `sandbox-isolation` (what a compromised agent can reach).
