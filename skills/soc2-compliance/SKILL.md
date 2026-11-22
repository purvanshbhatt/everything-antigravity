---
name: soc2-compliance
description: >-
  Guides SOC 2 readiness for engineering teams: choosing Trust Services
  Criteria, scoping the system, gap assessment, policies, implementing and
  automating controls (access reviews, change management, vulnerability and
  incident management), evidence collection, and working with the auditor
  through Type I and Type II. Use when a customer asks for a SOC 2 report or
  the team is preparing for an audit. Not legal advice.
---

# SOC 2 Compliance

SOC 2 is an attestation by an independent CPA firm that your controls meet the
AICPA Trust Services Criteria. Engineering's job is to make controls real,
automatic and provable, so evidence falls out of normal work instead of a
scramble before the audit window.

> Not legal or audit advice. Scope, control design and report decisions belong to the organization and its CPA firm; confirm interpretations with them.

## When to use

- A prospect or customer requires a SOC 2 report or security questionnaire.
- Planning readiness: scope, criteria, policies, controls, tooling, timeline.
- Mapping existing engineering practices (CI, IAM, on-call) to controls and evidence.
- Preparing for or responding to auditor requests during a Type I or Type II.

## When not to use

- Health data obligations: use `hipaa-compliance`; card data: `pci-dss`; personal data rights: `gdpr-privacy`.
- Finding technical vulnerabilities: use `security-audit` and `cloud-security-posture`.
- Writing public privacy policies or terms: use `policy-drafting`.

## Workflow

1. **Decide the target.** Choose report type (Type I: control design at a point in time; Type II: design and operating effectiveness over a period, often 3 to 12 months) and criteria. Security (the Common Criteria) is always included; add Availability, Confidentiality, Processing Integrity or Privacy only when customers need them.

   **Check:** A one-page decision record names report type, criteria, target dates and the executive owner.

2. **Scope the system.** List products, infrastructure (cloud projects, clusters, databases), supporting tools (IdP, source control, CI, ticketing, MDM), people and subservice organizations (for example your cloud provider, usually carved out and covered by its own SOC report).

   **Check:** A system description draft and an inventory of in-scope assets and vendors exist.

3. **Run a gap assessment.** Map current practices to the criteria (table below) and list missing controls. Delegate the mapping and evidence gathering to the `compliance-auditor` subagent if available, with the inventory as input.

   **Check:** Each criterion has a control, an owner and a status: in place, partial, missing.

4. **Write policies people follow.** Information security, access control, change management, incident response, business continuity, vendor management, data classification and retention, acceptable use, risk assessment. Keep them short and true to practice; auditors test what the policy says.

   **Check:** Each policy is approved, versioned, and states a review cadence.

5. **Implement controls as code where possible.** SSO and MFA everywhere; branch protection with required reviews and status checks; deploys only from CI; IaC for infrastructure; automated vulnerability scans with fix SLAs; centralized logging with alerting; backups with tested restores; HR-to-IdP deprovisioning.

   **Check:** Each control produces a machine-generated record (config export, log, ticket) without manual effort.

6. **Automate evidence.** Use a compliance automation platform or scripts that export evidence on a schedule. Store exports with timestamps in an access-controlled location.

   ```bash
   gh api repos/<org>/<repo>/branches/main/protection > evidence/branch-protection-$(date +%F).json
   gcloud projects get-iam-policy <PROJECT> --format=json > evidence/iam-<PROJECT>-$(date +%F).json
   ```

   **Check:** Evidence for each control covers the whole observation window, not just today.

7. **Readiness check, then audit.** Do a mock walkthrough of every control with its owner. Select a CPA firm; agree scope and window. Do not change in-scope controls during the window without telling the auditor. Ask the user before sending any evidence or system description outside the organization.

   **Check:** Every sample request can be answered from stored evidence within a day.

8. **Operate continuously.** Quarterly access reviews, annual risk assessment and policy review, vendor reviews, tabletop incident exercise, and remediation of exceptions found by the auditor.

## Reference

### Common Criteria map (Security category)

| Series | Topic | Engineering evidence examples |
| :--- | :--- | :--- |
| CC1 | Control environment | Org chart, code of conduct, background checks |
| CC2 | Communication and information | Policies published, security training records, system description |
| CC3 | Risk assessment | Risk register, threat models |
| CC4 | Monitoring activities | Internal control reviews, scanner dashboards |
| CC5 | Control activities | Policies mapped to controls, segregation of duties |
| CC6 | Logical and physical access | SSO/MFA config, access reviews, offboarding tickets, encryption settings |
| CC7 | System operations | Logging, alerting, vulnerability scans, incident tickets and postmortems |
| CC8 | Change management | Branch protection, PR approvals, CI results, deploy logs |
| CC9 | Risk mitigation | Vendor reviews, insurance, business continuity plans |

### Control evidence sampling: what auditors usually ask for

| Control | Typical sample |
| :--- | :--- |
| Change management | A list of production changes in the window, then PR, review and CI evidence for a sample |
| Offboarding | Terminations from HR, then the matching account removal timestamps |
| Access review | Each quarterly review with reviewer sign-off and resulting removals |
| Vulnerability management | Scan reports and tickets showing fixes within the SLA |
| Incident response | Incident tickets, timelines and postmortems |
| Backups | Backup job logs and at least one restore test record |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Copy a policy template you do not follow | Write policies that describe actual practice | Auditors test operation; mismatches become exceptions |
| Collect screenshots by hand before the audit | Scheduled, timestamped exports | Type II needs evidence across the whole window |
| Allow admin bypass of branch protection | Enforce for admins; document break-glass use | Bypass breaks the change-management control |
| Add every criterion "to look complete" | Only criteria customers need | Each criterion adds controls and audit cost |
| Treat the report as the goal | Treat controls as security practice | A clean report on paper does not prevent incidents |

## Verification checklist

- [ ] Report type, criteria, scope and owner are recorded.
- [ ] Every in-scope criterion maps to a control with an owner and evidence source.
- [ ] Policies are approved, versioned and match practice.
- [ ] Evidence collection is automated across the observation window.
- [ ] No evidence or system description left the organization without user confirmation.
- [ ] The not-legal-advice caveat was given and the CPA firm confirmed scope.

## Related

- Knowledge: `gdpr-privacy`, `hipaa-compliance`, `pci-dss`, `policy-drafting`, `cloud-security-posture`, `secrets-management`, `backup-dr`, `incident-response`.
- Workflows: `/threat-modeling`, `/postmortem`.
- Agents: `compliance-auditor`, `security-guard`.
