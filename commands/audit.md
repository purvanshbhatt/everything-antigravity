# /audit - Full Spectrum Security & Vulnerability Scan

## Purpose
Runs automated security auditing using `AgentShield` across the workspace: secret detection, prompt injection scanning, dependency CVE checks, and unsafe shell execution patterns.

## Execution Sequence
1. Run `python3 src/agent_shield.py` on changed files.
2. Scan dependencies using language-appropriate tools (`pip audit`, `npm audit`).
3. Verify permissions on exposed scripts and configuration files.
4. Output structured vulnerability table with remediation steps.
