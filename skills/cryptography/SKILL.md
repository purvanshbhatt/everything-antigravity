---
name: cryptography
disable-model-invocation: true
description: >-
  Applied cryptography for application engineers: choosing primitives (AEAD,
  hashes, MACs, signatures, key exchange), password hashing parameters,
  secure randomness, envelope encryption and key management with Cloud KMS
  and Tink, TLS configuration, constant-time comparison, post-quantum
  planning and the common mistakes reviewers catch. Use when encrypting data,
  storing passwords, signing requests or tokens, or reviewing crypto code.
---

# Applied Cryptography

Use a well-reviewed library's high-level API, pick primitives from a short
approved list, and spend your effort on key management. Almost every real
crypto bug is misuse (nonce reuse, wrong mode, keys in code, non-constant-time
comparison), not a broken algorithm.

## When to use

- Encrypting fields, files or backups; designing envelope encryption.
- Storing or verifying passwords; generating tokens, IDs or reset codes.
- Signing webhooks, API requests, tokens or release artifacts.
- Reviewing code that imports a crypto library or configures TLS.

## When not to use

- Session, OAuth and JWT flow design: use `auth-patterns`.
- Storing and rotating application secrets: use `secrets-management`.
- Certificates, DNS and TLS termination setup: use `dns-tls` and `nginx-proxy`.
- Implementing a new cipher or protocol: do not; involve a cryptographer.

## Workflow

1. **Name the goal before the algorithm.** Confidentiality, integrity, authenticity, password verification, key agreement or non-repudiation each map to a different primitive (table below).

   **Check:** Each crypto call site has a one-line comment stating which goal it serves.

2. **Pick a high-level library.** Tink (multi-language, KMS-integrated), libsodium bindings, the Python `cryptography` package's recipes and AEAD classes, Go's standard library and `x/crypto`, Node's `crypto`/WebCrypto. Avoid raw block-cipher modes.

   **Check:** `grep_search` finds no `ECB`, `MD5`/`SHA1` used for security, `DES`, `RC4`, `Math.random`/`random.random` for secrets, or hand-written padding.

3. **Encrypt with AEAD and unique nonces.**

   ```python
   import os
   from cryptography.hazmat.primitives.ciphers.aead import AESGCM

   key = AESGCM.generate_key(bit_length=256)     # in production: a DEK from KMS, not generated inline
   aead = AESGCM(key)
   nonce = os.urandom(12)                          # 96-bit, never reused with the same key
   ct = aead.encrypt(nonce, plaintext, b"record:42")   # associated data binds context
   stored = nonce + ct                             # keep key version alongside
   pt = aead.decrypt(stored[:12], stored[12:], b"record:42")
   ```

   **Check:** Nonces are random per message (or a counter that never repeats), associated data binds the ciphertext to its record, and the key version is stored with the ciphertext.

4. **Hash passwords with a slow, salted KDF.**

   ```python
   from argon2 import PasswordHasher
   ph = PasswordHasher()                 # Argon2id; tune memory and time to your hardware
   stored_hash = ph.hash(password)
   ph.verify(stored_hash, password)      # raises on mismatch
   if ph.check_needs_rehash(stored_hash):
       stored_hash = ph.hash(password)   # upgrade parameters on next login
   ```

   **Check:** Parameters meet at least the OWASP minimums below and hashing takes tens to a few hundred milliseconds on production hardware.

5. **Manage keys with envelope encryption.** A key-encryption key (KEK) lives in Cloud KMS or an HSM and never leaves it; data-encryption keys (DEKs) are generated per object or tenant, wrapped by the KEK, and stored next to the data. Set rotation schedules on KEKs; rotation creates new versions, and old versions stay available for decryption until data is re-wrapped. Destroying a key version makes its data unrecoverable; require explicit user confirmation.

   **Check:** No plaintext long-term key exists in code, config, images or environment variables; IAM allows encrypt/decrypt only to the workloads that need it.

6. **Compare secrets in constant time.** Python `hmac.compare_digest`, Node `crypto.timingSafeEqual` (equal-length buffers), Go `subtle.ConstantTimeCompare`.

   **Check:** No `==` comparisons of MACs, tokens or signatures remain.

7. **Configure TLS conservatively.** TLS 1.2 minimum, 1.3 preferred, modern AEAD suites, certificate verification always on (no `verify=False`, `InsecureSkipVerify`, `rejectUnauthorized: false` outside tests).

   **Check:** A TLS scanner against staging reports no legacy protocols or weak suites.

8. **Plan for post-quantum.** Inventory where long-lived confidentiality depends on RSA or elliptic-curve key exchange. NIST published FIPS 203 (ML-KEM), 204 (ML-DSA) and 205 (SLH-DSA) in 2024; hybrid key exchange is already deployed in major TLS stacks. Prefer crypto-agile designs with versioned algorithms; check current library and platform support.

## Reference

### Approved choices

| Goal | Use | Avoid |
| :--- | :--- | :--- |
| Symmetric encryption | AES-256-GCM, ChaCha20-Poly1305, XChaCha20-Poly1305 (random nonces) | ECB, unauthenticated CBC/CTR, custom MAC-then-encrypt |
| Integrity of data | SHA-256/512, SHA-3, BLAKE2/BLAKE3 | MD5, SHA-1 |
| Message authentication | HMAC-SHA-256 | Plain hash of key concatenated with message |
| Password storage | Argon2id, scrypt, bcrypt, PBKDF2 (when FIPS is required) | Fast hashes, unsalted hashes, reversible encryption |
| Key derivation from a key | HKDF | Reusing one key for several purposes |
| Signatures | Ed25519, ECDSA P-256, RSA-PSS (3072+) | RSA PKCS#1 v1.5 for new designs, DSA |
| Key agreement | X25519, ECDH P-256, hybrid with ML-KEM where supported | Static RSA key transport |
| Random secrets | `secrets` (Python), `crypto.randomBytes` (Node), `crypto/rand` (Go) | `random`, `Math.random`, time-seeded PRNGs |

### Password hashing minimums (OWASP Password Storage Cheat Sheet; verify current values)

| Algorithm | Minimum |
| :--- | :--- |
| Argon2id | 19 MiB memory, 2 iterations, parallelism 1 |
| scrypt | N=2^17, r=8, p=1 |
| bcrypt | Work factor 10 or more; input limited to 72 bytes |
| PBKDF2-HMAC-SHA256 | 600,000 iterations |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Reuse a GCM nonce with the same key | Random 96-bit nonce per message, rotate keys before volume limits | Nonce reuse reveals plaintext relations and allows forgeries |
| Hardcode keys or keep them in env vars forever | KMS-wrapped DEKs, workload identity | Keys in code end up in git history and images |
| `sha256(password)` | Argon2id or scrypt with per-user salt | Fast hashes are cracked at billions per second |
| Encrypt without authentication | AEAD | Unauthenticated ciphertext is malleable |
| Invent a token format | Standard formats with pinned algorithms | Custom formats repeat known mistakes |
| Disable certificate verification to fix an error | Fix the trust store or hostname | Disabling verification removes TLS's protection |

## Verification checklist

- [ ] Each call site states its goal and uses an approved primitive via a high-level API.
- [ ] Nonces never repeat per key; associated data binds context; key versions are stored.
- [ ] Passwords use Argon2id/scrypt/bcrypt with parameters at or above minimums and rehash on upgrade.
- [ ] Keys live in KMS or HSM; no plaintext long-term keys in code, images or env.
- [ ] Secret comparisons are constant-time; TLS verification is never disabled outside tests.
- [ ] Key destruction or rotation steps had explicit user confirmation.

## Related

- Knowledge: `auth-patterns`, `secrets-management`, `dns-tls`, `security-audit`, `supply-chain-security`, `fintech-ledgers`.
- Workflows: `/code-review`, `/security-scan`.
- Agents: `security-guard`.
