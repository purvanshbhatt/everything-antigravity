# Security Policy

## Supported Versions
EAG receives regular updates. We recommend tracking the `main` branch.

## Reporting Vulnerabilities
If you discover a security vulnerability or credential leak within this repository, please report it privately via GitHub Security Advisories or contact the repository maintainers directly. Do not open public issues for sensitive security reports.

## Automated Guardrails
EAG includes `AgentShield` (`src/agent_shield.py`) to actively detect credential leaks, prompt injections, and unsafe terminal commands. Run `python3 src/cli.py shield` to inspect code prior to submission.
