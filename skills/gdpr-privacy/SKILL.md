---
name: gdpr-privacy
disable-model-invocation: true
description: >-
  Privacy engineering for GDPR and CCPA/CPRA basics: data mapping and records
  of processing, lawful basis and consent capture, data subject requests
  (access, deletion, portability), retention and deletion pipelines,
  pseudonymization, DPIAs and breach timelines. Use when building features
  that touch personal data, adding analytics or trackers, handling a DSAR, or
  preparing a privacy review. Not legal advice.
---

# Privacy Engineering (GDPR, CCPA)

Know where every piece of personal data lives, why you hold it, and how long;
then make access, export and deletion a pipeline instead of a manual hunt.
Privacy law sets obligations; engineering makes them provable.

> Not legal advice. Lawful basis, notices, transfers and breach decisions need a privacy lawyer or DPO. Regulations and guidance change; verify against current regulator guidance.

## When to use

- A feature collects, stores, shares or analyzes personal data.
- Adding analytics, ads pixels, session replay or any third-party SDK.
- A data subject access, deletion or correction request arrives.
- Preparing a DPIA, records of processing, or a vendor/processor review.

## When not to use

- Health data under HIPAA: use `hipaa-compliance`; card data: `pci-dss`.
- Writing the privacy policy text itself: use `policy-drafting`.
- Security controls in general (encryption, IAM): use `security-audit` and `cryptography`.
- Audit attestation programs: use `soc2-compliance`.

## Workflow

1. **Build the data map.** For each system: data categories, data subjects, purpose, lawful basis, source, recipients and processors, storage location and region, retention, and the identifier that links records to a person. Find fields with `grep_search` over schemas and migrations (`email`, `phone`, `ip`, `address`, `dob`, `device_id`), and with automated discovery such as Sensitive Data Protection on Google Cloud.

   **Check:** Every table, bucket, index, log sink and vendor holding personal data appears in the map with an owner.

2. **Tag and minimize.** Mark personal and special-category columns in schemas (comments, BigQuery policy tags, ORM annotations). Drop fields with no purpose; truncate IPs; store derived values instead of raw where possible.

   **Check:** New migrations adding personal data fields require a data-map update in the same PR.

3. **Capture consent and choices correctly** where consent is the basis. Record subject ID, purpose, notice version, timestamp, method and withdrawal. Do not load non-essential cookies or trackers before consent in the EU; honor opt-out preference signals such as Global Privacy Control where the law requires it.

   **Check:** A fresh browser session in an EU region makes no tracker requests before consent (verify in the network panel).

4. **Make DSARs a pipeline.** Verify identity, locate data across every store from the data map, export in a machine-readable format, and fan deletions out to the primary database, search indexes, caches, analytics, object storage and processors. Log each step without storing the exported data itself.

   ```python
   ERASERS = [db.erase_user, search.delete_user, analytics.delete_user,
              storage.delete_prefix, crm_vendor.request_deletion]

   def handle_erasure(request):
       subject = verify_identity(request)              # never act on an unverified request
       results = {e.__qualname__: e(subject.id) for e in ERASERS}
       audit.record("dsar.erasure", subject=subject.hashed_id, results=results)
       return results
   ```

   Deletion is irreversible: require a verified request and an operator confirmation before running erasure in production.

   **Check:** An end-to-end test creates a user, generates data in every store, erases it, and asserts nothing remains (backups excepted and documented).

5. **Enforce retention with TTLs.** Use database TTL policies, partition expiration, object lifecycle rules and log retention settings rather than ad hoc cleanup scripts. Backups age out on their own schedule; document it.

   **Check:** Every data-map row has a retention value implemented by a named mechanism.

6. **Keep personal data out of logs and non-production.** Redact at the logger; use synthetic or masked data in dev and staging.

   **Check:** A search of recent logs for email and phone patterns returns nothing unexpected.

7. **Assess high-risk processing.** Run a DPIA for large-scale special-category data, systematic monitoring, profiling with significant effects, or novel technology such as AI on personal data. Reuse the data-flow diagram from `/threat-modeling`.

8. **Prepare for breaches.** Add a privacy assessment step to `incident-response`. Under GDPR the supervisory authority must generally be notified within 72 hours of becoming aware of a qualifying breach.

## Reference

### GDPR articles engineers touch most

| Article | Topic | Engineering implication |
| :--- | :--- | :--- |
| 5 | Principles | Minimization, purpose limitation, storage limitation |
| 6 / 9 | Lawful basis / special categories | Record basis per purpose; extra protection for health, biometrics and similar |
| 12 | Response timing | Generally one month, extendable by two further months in some cases |
| 15, 16, 17, 20, 21 | Access, rectification, erasure, portability, objection | DSAR export, edit, delete and opt-out features |
| 25 | Data protection by design and by default | Privacy-protective defaults in product settings |
| 28 | Processors | Data processing agreements with vendors |
| 30 | Records of processing | The data map, kept current |
| 32 | Security of processing | Encryption, access control, testing |
| 33 / 34 | Breach notification | 72-hour authority notification; notify individuals when high risk |
| 35 | DPIA | Required for likely high-risk processing |

### CCPA/CPRA basics (verify current regulations)

Rights to know, delete, correct, opt out of sale or sharing, and limit use of sensitive personal information. Businesses generally respond within 45 days, extendable once. Several other US states have similar laws with different thresholds.

### Pseudonymized versus anonymized

Pseudonymized data (hashed email, tokenized ID) is still personal data under GDPR. Only data that can no longer be linked to a person by reasonably likely means is anonymous.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Hash emails and call the data anonymous | Treat it as pseudonymous personal data | Hashes are linkable and reversible by lookup |
| Fire analytics before the consent banner resolves | Gate SDK initialization on consent state | Pre-consent tracking is the most common violation |
| Delete only from the primary database | Fan out to every store and processor in the map | Copies in search, analytics and vendors remain |
| Keep data "in case it is useful" | Purpose-bound retention with TTLs | Storage limitation is a principle, not a suggestion |
| Copy production into staging | Synthetic or masked datasets | Non-production systems leak more often |

## Verification checklist

- [ ] The data map covers every store and vendor, with basis, retention and owner.
- [ ] Consent is recorded with version and timestamp; trackers wait for consent.
- [ ] DSAR export and erasure are tested end to end across all stores.
- [ ] Retention is enforced by TTLs or lifecycle rules.
- [ ] Logs and non-production environments are free of raw personal data.
- [ ] The not-legal-advice caveat was given and counsel/DPO review is noted.

## Related

- Knowledge: `policy-drafting`, `soc2-compliance`, `hipaa-compliance`, `cryptography`, `data-quality`, `bigquery`, `incident-response`, `responsible-ai`.
- Workflows: `/threat-modeling`, `/postmortem`.
- Agents: `compliance-auditor`, `security-guard`.
