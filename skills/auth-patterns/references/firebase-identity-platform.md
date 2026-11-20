# Firebase Auth and Google Cloud Identity Platform

Firebase Auth handles sign-in in the client SDKs. Identity Platform is the
Google Cloud upgrade of the same service; it adds multi-tenancy, SAML and OIDC
enterprise providers, blocking functions and an SLA. Confirm method names and
limits against the current Firebase Admin SDK docs for your language.

## The model

1. The client signs in with the Firebase SDK and receives a short-lived ID token (about one hour), which the SDK refreshes automatically.
2. The client sends the ID token to your backend in `Authorization: Bearer <token>`.
3. The backend verifies it with the Admin SDK on every request and derives the user from it, never from the request body.

```ts
// Node, firebase-admin (modular API)
import { getAuth } from 'firebase-admin/auth';

export async function requireUser(authorization?: string) {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
  if (!token) throw new UnauthorizedError();
  const decoded = await getAuth().verifyIdToken(token, true); // true = also check revocation
  return { uid: decoded.uid, role: decoded.role as string | undefined, tenant: decoded.firebase?.tenant };
}
```

Python: `auth.verify_id_token(id_token, check_revoked=True)`. Go:
`client.VerifyIDTokenAndCheckRevoked(ctx, idToken)`. Revocation checks add a
lookup; use them on sensitive operations at least.

## Roles with custom claims

- Set roles server-side with `getAuth().setCustomUserClaims(uid, { role: 'admin' })`. Claims are small (the payload limit is about 1000 bytes); keep roles and ids there, not profiles.
- Claims appear only in newly issued ID tokens. After changing claims, force a refresh on the client (`user.getIdToken(true)`) or wait for the next refresh.
- To cut access immediately, call `revokeRefreshTokens(uid)` and verify with the revocation check.

## Server-rendered apps: session cookies

Exchange a fresh ID token for a session cookie with
`createSessionCookie(idToken, { expiresIn })` (allowed range roughly 5 minutes
to 2 weeks). Set it `HttpOnly`, `Secure` and `SameSite`, and verify it on each
request with `verifySessionCookie(cookie, true)`. Protect the exchange
endpoint against CSRF.

## Security rules (Firestore, Realtime Database, Storage)

When clients read the database directly, the rules are your authorization layer.

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tenants/{tenantId}/docs/{docId} {
      allow read, write: if request.auth != null
        && request.auth.token.tenantId == tenantId;
    }
  }
}
```

The `tenantId` claim here is an example custom claim you set yourself. Test
rules with the Emulator Suite (`firebase emulators:start --only auth,firestore`)
and `@firebase/rules-unit-testing`, including denial cases.

## Identity Platform extras

- **Multi-tenancy:** each tenant has its own users and providers. The client sets `auth.tenantId` before sign-in; the backend uses the tenant-aware Admin API (`tenantManager().authForTenant(tenantId)`) and checks that the token's `firebase.tenant` matches the tenant in the URL or resource.
- **Blocking functions:** run code before a user is created or signed in, to enforce domain allow-lists or add claims. Keep them fast; they sit on the sign-in path.
- **MFA:** SMS and TOTP second factors are available; prefer TOTP or passkey-capable providers over SMS where possible.

## Pitfalls

| Pitfall | Fix |
| :--- | :--- |
| Treating the web API key as a secret, or as protection | It only identifies the project. Restrict it in the Google Cloud console and rely on rules and token verification |
| Confusing App Check with auth | App Check attests the app or device; it does not identify the user |
| Trusting `uid` sent in a request body | Use `decoded.uid` from the verified token |
| Allowing writes to any field in rules | Validate field names and types in rules, or write through the backend |
| Leaving email enumeration protection off | Turn it on in the Auth settings |
