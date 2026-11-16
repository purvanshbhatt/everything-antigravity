---
name: credential-sanitizer
description: "Detect, redact, and scrub API keys, OAuth tokens, GCP ADC keys, and private certificates from code, logs, and context."
---

# Credential Sanitizer

## Overview
Safeguards developer repositories and agent conversation context from accidental leakage of sensitive credentials, certificates, and API tokens.

## Detection Coverage
- **Google API Keys**: `AIza[0-9A-Za-z-_]{35}`
- **Anthropic API Keys**: `sk-ant-[a-zA-Z0-9_-]{40,}`
- **OpenAI API Keys**: `sk-[a-zA-Z0-9]{32,}`
- **AWS Keys & Secrets**: `AKIA[0-9A-Z]{16}`
- **GitHub Access Tokens**: `ghp_...`, `gho_...`, `ghs_...`
- **Private Key Blocks**: `-----BEGIN PRIVATE KEY-----`
- **Database Connection Strings**: URLs with embedded plaintext passwords.

## Sanitization Strategy
1. **In-Flight Masking**: Replace sensitive matches with `[REDACTED_<TYPE>]` before logging or passing context to external models.
2. **Pre-Commit Enforcement**: Hook into Git `pre-commit` to prevent accidental commits of `.env` files or hardcoded test keys.
3. **Environment Isolation**: Force retrieval of secrets via environment variables or cloud secret managers (Google Secret Manager, AWS Secrets Manager).
