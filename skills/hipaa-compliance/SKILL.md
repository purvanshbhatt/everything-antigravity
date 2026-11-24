---
name: hipaa-compliance
disable-model-invocation: true
description: >-
  HIPAA for engineers: identifying PHI, covered entities versus business
  associates, BAAs with every vendor in the PHI path, Security Rule technical
  safeguards (access control, audit logs, integrity, authentication,
  transmission security), de-identification, breach notification timelines
  and keeping PHI out of logs and tools. Use when building or reviewing
  software that stores or processes US health data. Not legal advice.
---

# HIPAA for Engineers

If your system creates, receives, stores or transmits protected health
information (PHI) for a covered entity, every component and vendor in that
path must be protected and contractually covered. Most engineering failures
are PHI leaking into places nobody listed: logs, analytics, error trackers,
email, LLM calls and test data.

> Not legal advice. Whether HIPAA applies, BAA terms, risk analysis sign-off and breach decisions belong to the organization's privacy officer and healthcare counsel. Rules change (a Security Rule update was proposed in 2025); verify against current HHS guidance.

## When to use

- Building or reviewing a product for US providers, health plans or clearinghouses, or as their vendor.
- Adding a vendor, SDK, LLM or logging tool to a system that handles PHI.
- Preparing for a HIPAA risk analysis, customer security review or BAA negotiation.
- Investigating a possible PHI exposure.

## When not to use

- FHIR and HL7 data modelling and APIs: use `healthcare-fhir` (it links back here).
- EU or general personal data obligations: use `gdpr-privacy`.
- General attestation programs: use `soc2-compliance`.
- Consumer wellness apps outside HIPAA may fall under other rules (for example the FTC Health Breach Notification Rule); ask counsel.

## Workflow

1. **Determine role and PHI scope.** Is the organization a covered entity, a business associate or neither? List every data element that is individually identifiable health information (diagnoses, appointments, claims, device readings) linked to any of the identifiers below.

   **Check:** The role is confirmed by the user or counsel, and a PHI inventory exists per system.

2. **Trace the PHI path and check BAAs.** Draw the data flow from intake to deletion, including logs, backups, monitoring, email/SMS, support tools, analytics, AI/LLM APIs and subcontractors. Every vendor that touches PHI needs a BAA, and only services the vendor lists as covered under its BAA may be used (for example, Google Cloud publishes a list of HIPAA-covered products).

   **Check:** Each vendor in the path has a signed BAA and each service used is on its covered list; otherwise PHI is removed from that path.

3. **Implement the technical safeguards** (table below): unique user IDs, MFA, role-based least-privilege access, emergency (break-glass) access with alerts, automatic session timeout, encryption at rest and TLS in transit, and audit logging of PHI access.

   **Check:** Every PHI read and write records who, what, when and from where, and audit logs are retained and tamper-resistant.

4. **Apply minimum necessary.** Return only the fields a role needs; scope queries by patient-care relationship or organization; prefer de-identified or limited data sets for analytics.

   **Check:** API responses and exports for each role contain no fields beyond the documented need.

5. **Keep PHI out of side channels.** No PHI in URLs, query strings, log messages, error-tracker payloads, push notification text, email subjects, analytics events, or prompts sent to non-covered AI services. Redact at the logger and SDK level.

   ```python
   logger.info("appointment.created", extra={"appointment_id": appt.id})   # IDs only
   # never: logger.info(f"Booked {patient.name} for {appt.reason}")
   ```

   **Check:** `grep_search` for logging calls that interpolate patient fields returns nothing; a sample of production logs shows no names, DOBs or diagnoses.

6. **Use synthetic data outside production.** Generate realistic test data (for example with Synthea) instead of copying production; de-identify only through Safe Harbor or Expert Determination.

   **Check:** Dev and staging contain no real patient records.

7. **Support the risk analysis.** The Security Rule requires a documented risk analysis and risk management. Provide the data-flow diagram, threat model, control inventory and open gaps to the privacy/security officer.

8. **Prepare breach response.** Extend `incident-response` with PHI assessment, evidence preservation and counsel notification. Notification to individuals is generally required without unreasonable delay and no later than 60 days after discovery; larger breaches also require HHS and media notice. Counsel decides; engineering supplies facts fast.

## Reference

### Security Rule technical safeguards (45 CFR 164.312)

| Standard | Engineering implementation |
| :--- | :--- |
| Access control | Unique IDs, RBAC, break-glass with alerting, auto logoff, encryption |
| Audit controls | Application-level PHI access logs plus cloud data-access audit logs |
| Integrity | Checksums, immutable audit trails, controlled write paths |
| Person or entity authentication | SSO with MFA; mTLS or signed tokens between services |
| Transmission security | TLS 1.2+ everywhere, including internal hops and integrations |

### Safe Harbor identifiers (remove all 18 to de-identify)

Names; geographic subdivisions smaller than a state (with a limited three-digit ZIP exception); all date elements except year related to an individual (and ages over 89); phone; fax; email; SSN; medical record numbers; health plan beneficiary numbers; account numbers; certificate or license numbers; vehicle identifiers; device identifiers; URLs; IP addresses; biometric identifiers; full-face photos; any other unique identifying number or code. Verify the exact wording in 45 CFR 164.514(b).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Assume "we use a HIPAA-compliant cloud" covers you | Sign the BAA and use only covered services, configured correctly | Compliance is shared; the BAA lists specific services |
| Send PHI to an error tracker or LLM API without a BAA | Scrub before sending, or use a covered service under BAA | Each is a disclosure to an unauthorized party |
| Put patient names in push notifications or email subjects | Generic text with a link to an authenticated view | Lock screens and inboxes are not secure channels |
| Share one admin account for support | Unique accounts with audited break-glass | Shared accounts defeat audit controls |
| Copy production data into staging for realism | Synthetic data | Staging rarely has production-grade controls |

## Verification checklist

- [ ] Role (covered entity, business associate) is confirmed and PHI is inventoried.
- [ ] Every vendor and service in the PHI path is covered by a BAA.
- [ ] Technical safeguards are implemented and PHI access is audit-logged.
- [ ] Logs, analytics, notifications and non-production data are free of PHI.
- [ ] Risk analysis inputs were provided to the privacy or security officer.
- [ ] The not-legal-advice caveat was given and counsel review is noted.

## Related

- Knowledge: `healthcare-fhir`, `gdpr-privacy`, `soc2-compliance`, `cryptography`, `secrets-management`, `observability-otel`, `incident-response`, `llm-app-security`.
- Workflows: `/threat-modeling`, `/postmortem`.
- Agents: `compliance-auditor`, `security-guard`.
