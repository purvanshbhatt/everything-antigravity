---
name: policy-drafting
description: >-
  Drafts and maintains privacy policies, terms of service, cookie notices and
  internal policies (acceptable use, security, remote work, generative AI use,
  expenses) from an inventory of actual practice, using clause checklists,
  plain-language rules and versioning. Use when the user asks to write, update
  or check a policy. Produces drafts for qualified legal review; not legal advice.
---

# Policy Drafting

A policy is a promise. The draft must describe what the organization actually
does, in words its readers understand, and a qualified lawyer must review it
before anyone relies on it. This skill produces that draft plus the evidence
behind every statement. It is not legal advice.

## When to use

- "Write a privacy policy / terms of service / cookie notice for our app."
- Updating a policy after a new feature, vendor, market or data use.
- Internal policies: acceptable use, information security, remote work, expenses, generative AI use, code of conduct.
- Checking whether a published policy still matches what the product does (drift review).

## When not to use

- Reviewing a contract someone sent you: `contract-review`.
- Building the controls behind the policy (consent storage, DSAR tooling, retention jobs): `gdpr-privacy`, `hipaa-compliance`, `pci-dss`.
- Mapping controls and evidence for an audit: `soc2-compliance`.
- Questions that need a legal opinion ("is this lawful?", "are we liable?"): a qualified lawyer in the relevant jurisdiction.

## Workflow

1. **Scope the policy.** Record the policy type, readers (users, employees, contractors), where the organization and its users are, sector rules (health, finance, children, education), the target effective date and the human owner who approves the text.

   **Check:** A scope note names the jurisdictions, the readers and the approving owner.

2. **Inventory practice before writing.** For a privacy policy, build a data map in a Google Sheet with one row per data category: source, purpose, legal basis (where GDPR or UK GDPR applies), recipients and processors, storage location and transfers, retention, security measures. Use `grep_search` across the codebase for analytics SDKs, tracking pixels, cookies, third-party API clients and logged fields; ask the user for the vendor list and signed data processing agreements. For internal policies, interview the owner about current practice and how it is enforced.

   **Check:** Every statement the policy will make maps to an inventory row with a source (code path, vendor contract or owner interview).

3. **Outline from the checklist.** Use the clause checklists below and mark each clause `applies`, `n/a` (with a reason) or `needs counsel`.

   **Check:** No checklist item is silently skipped.

4. **Draft in plain language.** Write in the second person, active voice and short sentences. Define terms once. Use a layered format: a short summary first, detail below. Use headings that match reader questions ("What we collect", "How to delete your data"). Draft in a Google Doc in suggesting mode so reviewers comment inline. Never copy another organization's policy: it is copyrighted and describes their practices, not yours.

   **Check:** The summary layer fits on one screen, and every "may" either names who, what and when, or is deleted.

5. **List questions for counsel.** Put a "Questions for counsel" block at the top of the draft: jurisdiction-specific notices, age gating, liability caps, arbitration and class-action clauses, sector rules, consent mechanics.

   **Check:** Every `needs counsel` item from step 3 appears in the list.

6. **Review and approve.** Route the draft to the owner and a qualified lawyer; internal policies also go to HR and security. Do not publish, replace the live page, or email employees or users without explicit confirmation from the user.

   **Check:** Approvers and dates are recorded, and the user confirmed publication.

7. **Version and schedule review.** Keep the source under version control (Markdown in the repo or a Doc with named versions) with an effective date and a changelog. Material changes to user-facing terms may require advance notice or fresh consent; ask counsel. Set the next review date (at least yearly, and whenever data use changes).

   **Check:** Changelog entry, effective date and a calendar reminder for the next review exist.

## Clause checklists

**Privacy policy**

| Clause | Must cover |
| :--- | :--- |
| Who we are | Legal entity, contact details, privacy contact or DPO where required |
| What we collect | Categories, including data collected automatically (cookies, device, logs) and from third parties |
| Why | Purpose per category; legal basis where GDPR or UK GDPR applies |
| Sharing | Categories of recipients and processors; whether data is sold or shared for targeted advertising (several US state laws define these terms) |
| Transfers | Countries and the safeguard used |
| Retention | Period, or the criteria that set it, per category |
| Rights | Access, correction, deletion, portability, objection, opt-out; how to exercise them; response times; appeals where required |
| Children | Minimum age and how underage data is handled |
| Cookies and tracking | Link to the cookie notice and how to change choices |
| Security | Measures in general terms, without guarantees |
| Changes | How readers are told about updates |

**Terms of service:** acceptance and eligibility; accounts and security; acceptable use; licence to user content; IP ownership; fees, billing, renewals and refunds; suspension and termination; disclaimers; limitation of liability; indemnity; governing law and disputes; changes to terms; contact.

**Internal policy skeleton:** purpose; scope (people, systems, locations); numbered, testable policy statements using "must" and "must not"; roles and responsibilities; exception process; enforcement; related documents; owner, version, effective date, review date.

**Generative AI use policy:** approved tools; data classes that must never be entered; human review of outputs before use; disclosure expectations; IP and licensing of outputs; record keeping; who to ask.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Copy a competitor's policy and change the name | Draft from your own inventory | It is copyrighted and describes someone else's practices |
| Publish statements the product does not follow | Fix the practice or the text first | Regulators can treat inaccurate privacy statements as deceptive |
| Write walls of legalese | Layered summary plus detail | Readers cannot consent to what they cannot understand |
| "We may share data with partners" | Name categories, purposes and conditions | Vague clauses fail transparency requirements |
| Publish without legal review | Route to a qualified lawyer | This skill is not legal advice |
| Edit the live policy silently | Version, changelog and notice | Users and auditors need to know which text applied when |
| Internal rules with no owner or exception path | Name an owner and an exception process | Unowned rules decay and people route around them |

## Verification checklist

- [ ] Every statement maps to an inventory row with a source.
- [ ] Every checklist clause is covered or marked `n/a` with a reason.
- [ ] "Questions for counsel" is complete, and a qualified lawyer reviewed the draft.
- [ ] A plain-language summary layer exists.
- [ ] Owner, version, effective date, changelog and next review date are recorded.
- [ ] The draft is marked as not legal advice until approved.
- [ ] Nothing was published or circulated without explicit user confirmation.

## Related

- Knowledge: `gdpr-privacy`, `hipaa-compliance`, `pci-dss`, `soc2-compliance`, `contract-review`, `people-operations`, `documentation-writing`, `editing`.
- Agents: `compliance-auditor` (policy-versus-practice drift check), `technical-writer` (plain-language pass).
