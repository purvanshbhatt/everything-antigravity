---
name: healthcare-fhir
description: >-
  Healthcare interoperability engineering: FHIR R4 resources and REST search,
  profiles and implementation guides such as US Core, terminologies (LOINC,
  SNOMED CT, RxNorm, UCUM), HL7 v2 to FHIR mapping, SMART on FHIR app launch
  and backend services, Bulk Data export, consent and PHI-safe practice. Use
  when integrating with EHRs, building FHIR APIs or apps, or mapping clinical
  data. Not medical or legal advice.
---

# Healthcare Interoperability (FHIR, HL7, SMART)

Model clinical data with standard resources and codes, validate against the
profiles your partners require, and authorize every access with SMART scopes.
Interoperability fails on coding and profile mismatches far more often than on
transport.

> Not medical, regulatory or legal advice. Clinical logic needs clinical review; regulated use (for example software as a medical device, certification programs, information-blocking rules) needs qualified regulatory advice. Specs evolve; verify versions against current HL7 and regulator publications.

## When to use

- Building a FHIR API, FHIR client, SMART app or EHR integration.
- Mapping HL7 v2 messages, CSV exports or a legacy schema to FHIR.
- Choosing codes and units for observations, conditions or medications.
- Setting up bulk export pipelines into analytics.

## When not to use

- HIPAA obligations, BAAs and PHI safeguards: use `hipaa-compliance` (always pair with this skill for US PHI).
- General REST design: use `api-design`; OAuth fundamentals: `auth-patterns`.
- Warehouse modelling of exported data: use `data-warehouse-modeling` and `bigquery`.

## Workflow

1. **Pin versions and profiles.** Confirm the FHIR version (R4 4.0.1 is the most widely deployed; R5 exists), and the implementation guides your partners require (for example US Core in the US) with exact IG versions.

   **Check:** A short interoperability spec lists FHIR version, IGs with versions, required resources and must-support elements.

2. **Stand up a local server and test data.**

   ```bash
   docker run --rm -p 8080:8080 hapiproject/hapi:latest       # base URL http://localhost:8080/fhir
   java -jar synthea-with-dependencies.jar -p 50               # synthetic patients as FHIR bundles
   ```

   **Check:** You can POST a synthetic transaction bundle and read resources back; no real patient data is used outside production.

3. **Map data to resources and codes.** Use Patient, Practitioner, Organization, Encounter, Observation, Condition, MedicationRequest, AllergyIntolerance, Procedure, DiagnosticReport, DocumentReference. Attach standard codes with their system URIs and UCUM units. Keep source identifiers in `identifier` with a system you own.

   ```json
   {
     "resourceType": "Observation",
     "status": "final",
     "category": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/observation-category", "code": "vital-signs" }] }],
     "code": { "coding": [{ "system": "http://loinc.org", "code": "8867-4", "display": "Heart rate" }] },
     "subject": { "reference": "Patient/123" },
     "effectiveDateTime": "2026-03-01T09:30:00Z",
     "valueQuantity": { "value": 72, "unit": "beats/minute", "system": "http://unitsofmeasure.org", "code": "/min" }
   }
   ```

   **Check:** Every coded element has a system URI; quantities use UCUM; a mapping table documents each source field.

4. **Validate against profiles.** Run the HL7 validator in CI on sample output.

   ```bash
   java -jar validator_cli.jar out/*.json -version 4.0.1 -ig hl7.fhir.us.core
   ```

   **Check:** Zero errors; warnings are reviewed and either fixed or documented.

5. **Use the REST API correctly.** Content type `application/fhir+json`. Search with typed parameters and follow `Bundle.link` (`next`) for paging rather than building offsets. Use conditional create (`If-None-Exist`) or transaction bundles for idempotent ingestion.

   ```http
   GET [base]/Observation?patient=Patient/123&code=http://loinc.org|8867-4&date=ge2026-01-01&_sort=-date&_count=50
   ```

   **Check:** Retried ingestion does not create duplicates; clients handle paging and `OperationOutcome` errors.

6. **Authorize with SMART on FHIR.** Use discovery at `[base]/.well-known/smart-configuration`, authorization code with PKCE for user-facing apps, and the narrowest scopes (SMART v2 style `patient/Observation.rs`; v1 style `patient/Observation.read`). Backend integrations use the Backend Services profile (client credentials with a signed JWT client assertion) and `system/` scopes.

   **Check:** Tokens carry only the scopes the feature needs; patient context comes from the launch, never from a client-supplied ID alone.

7. **Bulk export for analytics.** Use FHIR Bulk Data `$export` (async, NDJSON) into storage, then load into the warehouse. On Google Cloud, the Cloud Healthcare API provides managed FHIR stores with export to BigQuery and a de-identification operation.

   **Check:** Exports land in access-controlled storage; analytics use de-identified data where possible.

8. **Record consent, provenance and access.** Represent patient consent with Consent resources (and enforce it in code), record data origin with Provenance, and log access with AuditEvent or equivalent audit logs.

## Reference

### Terminology quick map

| Domain | Code system | System URI |
| :--- | :--- | :--- |
| Lab tests and vital signs | LOINC | `http://loinc.org` |
| Clinical findings, problems | SNOMED CT | `http://snomed.info/sct` |
| Medications (US) | RxNorm | `http://www.nlm.nih.gov/research/umls/rxnorm` |
| Diagnoses for billing (US) | ICD-10-CM | `http://hl7.org/fhir/sid/icd-10-cm` |
| Units | UCUM | `http://unitsofmeasure.org` |

Some code systems (for example SNOMED CT in some countries, CPT) require licenses; check before distributing.

### HL7 v2 to FHIR

| v2 element | FHIR target |
| :--- | :--- |
| ADT^A01/A04/A08 (MSH, PID, PV1) | Patient, Encounter (update by identifier) |
| ORU^R01 (OBR, OBX) | DiagnosticReport with Observations |
| PID-3 identifiers | `Patient.identifier` with assigning-authority system |
| OBX-3 / OBX-5 / OBX-6 | `Observation.code` / `value[x]` / UCUM unit |

Process v2 feeds idempotently: messages repeat and arrive out of order; use message control IDs and timestamps.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Free-text codes or local codes only | Standard codes plus local codes as extra codings | Partners and analytics cannot match free text |
| Mix units or omit them | UCUM units on every quantity | Unit errors are clinical safety errors |
| Request `patient/*.*` or `user/*.*` scopes | Resource-specific, read-only scopes where possible | Over-broad scopes expand breach impact |
| Trust a patient ID from the client | Use the launch context and server-side checks | Swapped IDs expose other patients' records |
| Develop against copied production records | Synthetic data from Synthea | PHI outside production violates safeguards |
| Skip profile validation | Validator in CI | Partner endpoints reject non-conformant resources |

## Verification checklist

- [ ] FHIR version and IG versions are pinned and documented.
- [ ] Mappings use standard code systems with URIs and UCUM units.
- [ ] Output validates against required profiles in CI.
- [ ] Ingestion is idempotent; clients follow paging links.
- [ ] SMART scopes are minimal; patient context comes from launch or server checks.
- [ ] PHI safeguards from `hipaa-compliance` apply; the not-medical/legal-advice caveat was given.

## Related

- Knowledge: `hipaa-compliance`, `gdpr-privacy`, `auth-patterns`, `api-design`, `bigquery`, `data-quality`, `etl-pipelines`.
- Workflows: `/threat-modeling`, `/api-scaffold`.
- Agents: `compliance-auditor`, `backend-engineer`, `data-engineer`.
