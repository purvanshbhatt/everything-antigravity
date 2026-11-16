---
name: security-audit
description: "Conduct comprehensive security reviews, OWASP Top 10 vulnerability assessments, dependency CVE checks, and AST static analysis."
---

# Comprehensive Security Audit

## Overview
Perform deep security audits of application source code, API endpoints, authentication flows, and third-party dependencies.

## Audit Vector Matrix
1. **Injection & Input Validation**:
   - SQL / NoSQL Injection: parameterized queries vs raw string interpolations.
   - Command Injection: avoiding `shell=True` in Python `subprocess`, sanitizing user inputs.
   - Cross-Site Scripting (XSS): escaping HTML and enforcing strict Content Security Policies (CSP).
2. **Authentication & Authorization**:
   - Token validation: proper JWT signing key verification, expiration enforcement, replay prevention.
   - Broken Object Level Authorization (BOLA): ensuring user permissions are verified per resource request.
3. **Software Supply Chain**:
   - Automated dependency auditing (`pip audit`, `npm audit`).
   - Checking pinned versions and flagging known CVEs.

## Output Format
Generate structured vulnerability reports categorizing findings by severity (Critical, High, Medium, Low) with concrete remediation diffs.
