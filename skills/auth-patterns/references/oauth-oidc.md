# OAuth 2.1 and OpenID Connect

OAuth 2.1 consolidates OAuth 2.0 and its security best current practice: PKCE
for every authorization code flow, exact redirect URI matching, no implicit
grant, no resource owner password grant, and refresh tokens that are
sender-constrained or rotated for public clients. Check the current IETF
status of the OAuth 2.1 draft and your provider's docs for specifics.

## Authorization code with PKCE

1. The client creates a random `code_verifier` (43-128 characters from the unreserved set) and derives `code_challenge = BASE64URL(SHA256(code_verifier))`.
2. The client creates random `state` (CSRF protection for the callback) and, for OIDC, a random `nonce`. Store both, plus the verifier, server-side or in a short-lived, encrypted, `HttpOnly` cookie.
3. Redirect to the authorization endpoint with `response_type=code`, `client_id`, the exact `redirect_uri`, `scope` (include `openid` for OIDC), `state`, `nonce`, `code_challenge` and `code_challenge_method=S256`.
4. On callback, reject the request unless `state` matches. If the provider returns an `iss` parameter (RFC 9207), check it matches the expected issuer.
5. Exchange the code at the token endpoint with `code_verifier` (and client authentication for confidential clients).
6. Validate the ID token (below), then create your own session. Don't use the ID token as an API access token.

Generating the PKCE pair in Node:

```ts
import { randomBytes, createHash } from 'node:crypto';

const verifier = randomBytes(32).toString('base64url');                 // 43 chars
const challenge = createHash('sha256').update(verifier).digest('base64url');
```

Prefer your OIDC library's helpers (for example `openid-client` in Node,
Authlib in Python, `coreos/go-oidc` with `golang.org/x/oauth2` in Go); they
handle discovery, PKCE, `state`, `nonce` and ID token validation.

## Validating tokens

ID token (OIDC), at the client:

- Signature verified against the provider's JWKS (from `/.well-known/openid-configuration`).
- `iss` equals the expected issuer exactly; `aud` contains your `client_id`; `azp` checked when there are several audiences.
- `exp` in the future (allow small clock skew), `iat` reasonable, `nonce` equals the stored value.

Access token (JWT format), at the resource server:

- Signature with an allow-listed algorithm, `iss`, `aud` equal to this API, `exp` and `nbf`.
- Required scopes or permissions for this operation.
- Opaque tokens: call the provider's introspection endpoint and cache the result briefly.

Node with `jose`:

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';

const ISSUER = 'https://auth.example.com/';
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}.well-known/jwks.json`));

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: ISSUER,
    audience: 'api://orders',
    algorithms: ['RS256'],
  });
  return payload;
}
```

Python with PyJWT:

```python
import jwt

jwks = jwt.PyJWKClient("https://auth.example.com/.well-known/jwks.json")

def verify_access_token(token: str) -> dict:
    key = jwks.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        key.key,
        algorithms=["RS256"],
        audience="api://orders",
        issuer="https://auth.example.com/",
    )
```

Read the JWKS URL from the provider's discovery document rather than guessing
its path.

## Backend-for-frontend (BFF) for SPAs

The SPA talks only to its own backend over a first-party session cookie. The
BFF runs the authorization code flow as a confidential client, stores access
and refresh tokens server-side, and attaches the access token when it proxies
API calls. XSS can still act as the user while the page is open, but it can't
steal long-lived tokens.

## Refresh token rotation

- Issue a new refresh token on every refresh and invalidate the old one.
- Track tokens as a family. If an already-used token is presented, revoke the whole family and force sign-in: that indicates theft.
- Store only a hash of each refresh token, with its family id, user, client, expiry and absolute lifetime.
- Bind refresh tokens to the client (and to DPoP or mTLS keys where supported).

## Other grants

| Grant | Use for | Notes |
| :--- | :--- | :--- |
| Client credentials | Service-to-service | Prefer workload identity or federation over static secrets |
| Device authorization | CLIs, TVs and other input-constrained devices | Poll politely and honour `slow_down` |
| Token exchange (RFC 8693) | Delegation between services | Narrow the audience and scope on each hop |

## Logout

- Delete your session server-side and clear the cookie.
- Revoke the refresh token at the provider when it supports revocation (RFC 7009).
- Use RP-initiated logout at the provider when the user expects single sign-out.

## Callback test cases

| Case | Expected |
| :--- | :--- |
| `state` missing or different | Reject, no session |
| Code reused | Token endpoint error, no session |
| Wrong `code_verifier` | Token endpoint error |
| ID token with a wrong `nonce`, `aud` or `iss` | Reject |
| `redirect_uri` not registered exactly | Provider refuses |
| Expired ID token | Reject |
