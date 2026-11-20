---
name: auth-patterns
description: >-
  Designs and reviews authentication and authorization: OAuth 2.1 and OIDC
  authorization code with PKCE, session cookies versus JWTs, cookie flags,
  CSRF, refresh token rotation, argon2id password storage, MFA and passkeys,
  RBAC/ABAC checks at every boundary, multi-tenant isolation, and Firebase Auth
  or Identity Platform. Use when adding login, tokens, roles or tenant scoping,
  or when reviewing code for IDOR and JWT flaws.
---

# Authentication and Authorization Patterns

Prove who the caller is with a standard protocol and a vetted library, then
check what they may do on every request, at every layer that touches data.
Most real breaches are missing authorization checks, not broken crypto.

## When to use

- Adding sign-in, sign-up, SSO, social login, password reset, MFA or passkeys.
- Choosing between session cookies and JWTs, or wiring an API to an identity provider.
- Adding roles, permissions, sharing, or tenant scoping to data access.
- Reviewing code for IDOR, privilege escalation, token handling or session bugs.
- Integrating Firebase Auth or Google Cloud Identity Platform with a backend.

## When not to use

- A whole-codebase security assessment: use `/security-scan` and the `security-guard` agent.
- Secrets in code, logs or prompts: use `credential-sanitizer`.
- API surface design (resources, versioning, errors): use `api-design`.
- Agent sandboxing and tool permissions: use `sandbox-isolation` or `agent-shield`.

## Workflow

1. **Map actors, clients and boundaries.** List every client type (server-rendered web, SPA, mobile, CLI, service-to-service) and every place that reads or writes protected data: HTTP handlers, server actions, GraphQL resolvers, queue consumers, cron jobs, file downloads and admin tools.

   **Check:** You have a table of client type to flow (see below), and a list of entry points that need an authorization check.

2. **Use a provider and a vetted library; never hand-roll crypto.** Pick the identity provider already in the stack (Firebase Auth or Identity Platform, Auth0, Okta, Keycloak, Cognito, Entra ID). Use the framework's OIDC library and a maintained JWT library. Pin the versions the project already uses, and read their docs for the exact API.

   **Check:** No custom token signing, password hashing or random-token code exists outside a vetted library call.

3. **Implement the flow.** Use authorization code with PKCE (S256) for every interactive client, plus `state` and the OIDC `nonce`. Register exact redirect URIs. For browser apps, prefer a backend-for-frontend that keeps tokens server-side and gives the browser only a session cookie. Details: [OAuth and OIDC](references/oauth-oidc.md).

   **Check:** The tests cover a tampered `state`, a replayed code, a wrong `nonce` and an unregistered redirect URI, and all of them are rejected.

4. **Manage sessions deliberately.** Pick a model from the table below. Rotate the session id at login and on privilege change. Enforce idle and absolute timeouts. Logout must invalidate server-side state, not just delete the cookie. Rotate refresh tokens on every use, and revoke the whole token family when an old one is reused.

   **Check:** After logout or password change, the old session or refresh token is rejected (tested).

5. **Authorize at every boundary, deny by default.** Route every decision through one function or policy engine (`authorize(subject, action, resource)`), scope every query by tenant and owner, and return 404 for resources the caller may not see. See the pattern below.

   **Check:** For every entry point in step 1, a test shows that a user from another tenant, and a user with a lower role, get 403 or 404.

6. **Harden credentials and abuse paths.** Hash passwords with argon2id, rate-limit sign-in, reset and MFA endpoints, use the same error message for unknown users and wrong passwords, make reset tokens random, single-use, short-lived and hashed at rest, and offer passkeys or TOTP for MFA. Use CSRF protection for cookie-authenticated, state-changing requests.

   **Check:** Brute-force and enumeration tests pass, and a stored password hash starts with `$argon2id$`.

7. **Review adversarially.** Delegate to the `security-guard` subagent with the diff, the entry-point list and the threat model. Run `/security-scan`. Walk the vulnerability table below.

   **Check:** Every finding is fixed or explicitly accepted by the user.

## Patterns

### Flow by client type

| Client | Flow | Token storage |
| :--- | :--- | :--- |
| Server-rendered web app | Auth code + PKCE, confidential client | Server-side session; browser gets an opaque `HttpOnly` cookie |
| SPA | Auth code + PKCE through a backend-for-frontend | Tokens on the BFF; the browser holds only a session cookie |
| Native mobile app | Auth code + PKCE in the system browser (AppAuth or the platform SDK) | Keychain or Keystore |
| CLI or TV | Device authorization grant, or auth code + PKCE with a loopback redirect | OS credential store |
| Service to service | Client credentials, or workload identity (no static keys) | Memory; fetch from the secret manager |

The implicit grant and the resource owner password grant are removed in OAuth 2.1. Don't use them.

### Sessions versus JWTs

| | Server-side session | Self-contained JWT access token |
| :--- | :--- | :--- |
| Revocation | Immediate (delete the row) | Only at expiry, unless you add a denylist |
| Lookup cost | One store read per request | Signature check only |
| Size | Small opaque id | Grows with claims |
| Best for | First-party web apps | APIs called by many services; short TTL (5-15 min) plus refresh |

Never keep tokens in `localStorage` or `sessionStorage`; any XSS can read them.

### Cookie recipe

```text
Set-Cookie: __Host-session=<opaque random id>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=28800
```

The `__Host-` prefix forces `Secure`, `Path=/` and no `Domain`, which blocks
subdomain overrides. `SameSite=Lax` blocks most cross-site POSTs, but add a
CSRF token or verify `Origin` (or `Sec-Fetch-Site`) on every state-changing
request anyway: sibling subdomains count as same-site.

### Authorization in the data path

```ts
export async function updateDocument(ctx: RequestContext, id: string, input: DocInput) {
  const doc = await db.document.findFirst({
    where: { id, tenantId: ctx.tenantId },          // tenant comes from the verified token, never the body
  });
  if (!doc) throw new NotFoundError();              // 404 hides existence across tenants
  if (!authorize(ctx.user, 'document:edit', doc)) throw new ForbiddenError();
  return db.document.update({ where: { id: doc.id }, data: pick(input, ['title', 'body']) }); // no mass assignment
}
```

Defence in depth for multi-tenant Postgres: row-level security keyed on a
per-transaction setting.

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;   -- applies to the table owner too
CREATE POLICY tenant_isolation ON documents
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
-- per request, inside the transaction: SELECT set_config('app.tenant_id', $1, true);
```

Superusers and roles with `BYPASSRLS` skip policies, so the app must connect as a dedicated non-owner role.

| Model | Use when | Tools |
| :--- | :--- | :--- |
| RBAC | A few stable roles per tenant | Role claim plus a permission map in code |
| ABAC | Decisions depend on attributes (owner, department, time, region) | OPA/Rego, Cedar, or a policy module |
| ReBAC | Sharing and hierarchies (folders, orgs, teams) | OpenFGA, SpiceDB (Zanzibar-style) |

### Password storage

Use argon2id. OWASP's minimum is 19 MiB memory, 2 iterations and parallelism 1; library defaults are often stronger. Rehash on login when parameters change (`argon2-cffi` exposes `check_needs_rehash`). If FIPS forces it, use PBKDF2-HMAC-SHA256 with a high iteration count, per the current OWASP Password Storage Cheat Sheet. Check new passwords against breached-password lists, and follow the current NIST SP 800-63B rules on length; don't impose composition rules or forced rotation.

### Vulnerabilities to hunt

| Vulnerability | Trigger | Fix |
| :--- | :--- | :--- |
| IDOR / BOLA | Changing `/orders/123` to `/orders/124` returns another user's data | Owner and tenant in every query; 404 on miss |
| JWT algorithm confusion | `alg: none`, or an HS256 token signed with the RS256 public key | Pin `algorithms` in verify; check `iss`, `aud` and `exp` |
| Trusting token headers | `jku`, `x5u` or `kid` used to fetch keys from attacker URLs | Keys only from your configured JWKS URL |
| Mass assignment | `role: "admin"` in a profile update body | Allow-list writable fields |
| Open redirect | `?next=https://evil.example` after login | Allow only relative paths or listed hosts |
| Session fixation | Session id unchanged across login | Issue a new id at login |
| Token leakage | Tokens in URLs, logs, `Referer` or error trackers | Headers or cookies only; redact logs |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Check permissions only in the UI or route middleware | Check in the service or data layer too | Jobs, GraphQL and internal calls bypass the route layer |
| Read `userId` or `tenantId` from the request body | Derive them from the verified session or token | Clients control the body |
| Decode JWTs without verifying them | Verify signature, `iss`, `aud`, `exp` and the algorithm | `decode` trusts attacker input |
| Long-lived access tokens | 5-15 min access tokens plus rotated refresh tokens | Stolen tokens stay valid until expiry |
| Hash passwords with SHA-256 or MD5 | argon2id via a library | Fast hashes fall to GPU cracking |
| Different errors for "no such user" and "wrong password" | One generic message and constant-time comparison | Account enumeration |

## Verification checklist

- [ ] Every client type uses auth code + PKCE, device flow or client credentials; none uses implicit or password grants.
- [ ] Tokens are verified with pinned algorithms, issuer and audience.
- [ ] Cookies are `Secure`, `HttpOnly`, `SameSite`, and use `__Host-` where possible; CSRF is covered.
- [ ] Every entry point has a cross-tenant and lower-role negative test.
- [ ] Logout, password change and refresh-token reuse revoke access (tested).
- [ ] Passwords use argon2id, and sign-in, reset and MFA are rate-limited.
- [ ] Firebase or Identity Platform specifics are checked: [Firebase notes](references/firebase-identity-platform.md).

## Related

- Workflows: `/security-scan`, `/code-review`, `/tdd`, `/blueprint`.
- Knowledge: `security-audit`, `api-design`, `database-design`, `credential-sanitizer`, `frontend-react-nextjs`, `python-fastapi`, `golang-services`.
- Agents: `security-guard`, `code-reviewer`, `database-architect`.
