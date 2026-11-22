---
name: contract-review
description: >-
  Reviews business contracts (SaaS, MSAs, order forms, NDAs, DPAs, vendor and
  partner agreements): key-terms summary, clause-by-clause issues with risk
  ratings, red flags, preferred and fallback redlines, negotiation notes and
  questions for counsel. Use when the user shares a contract to review, asks
  what to watch for before signing, or wants key terms summarized. Not legal
  advice; a qualified lawyer reviews before signing.
---

# Contract Review

Turn a contract into a short memo the user can act on: what it says, what is
unusual or risky for their side, what to ask for instead, and what a lawyer
must look at. This is not legal advice. The output prepares the user to brief a
qualified lawyer; it does not replace one, and the agent never signs, accepts
or sends anything to the other party.

## When to use

- "Review this contract", "what should I watch for before signing?", "summarize the key terms".
- Comparing a vendor's paper with the user's standard positions.
- Preparing redlines and negotiation notes for a call.
- Tracking renewal and notice dates from existing agreements.

## When not to use

- Drafting privacy policies, terms of service or internal policies: `policy-drafting`.
- Deciding the commercial structure of a partnership: `partnerships`.
- Compliance programs (SOC 2, GDPR) beyond the contract's clauses: `soc2-compliance` and `gdpr-privacy`.
- Disputes, litigation, employment terminations or anything already escalated: a lawyer, directly.

## Workflow

1. **Establish context.** Which side the user is on (customer or vendor), contract type, value and term, governing law, what is negotiable, the user's priorities and walk-away points, and any internal playbook of standard positions.

   **Check:** One summary line exists: "*<Party>* is buying/selling *<what>* for *<value>* over *<term>* under *<law>*."

2. **Collect every document that forms the contract.** Order form, master agreement, terms incorporated by URL, DPA, SLA, acceptable use policy, security exhibits. Note the order-of-precedence clause. Read local files with `view_file`; fetch linked terms only if the user agrees, and save a dated copy because online terms can change.

   **Check:** A list of all incorporated documents shows which were reviewed and which were not available.

3. **Summarize key terms** in the table below. Write "not addressed" rather than leaving a row blank.

   **Check:** Every row is filled, with section references.

4. **Review clause by clause.** Compare each clause with the red-flag table and the user's priorities. Rate each issue High, Medium or Low for the user's side, and quote only the few words needed to locate it.

   **Check:** Each issue has a section number, a risk rating and a one-line explanation of the consequence.

5. **Propose redlines with fallbacks.** For each High and Medium issue, give preferred wording, an acceptable fallback and the rationale to use in negotiation. Work in a copy: a Google Doc in suggestion mode or a separate redline table. Never edit the original file.

   **Check:** Every redline is concrete replacement text, not "make this fairer".

6. **List questions for counsel.** Enforceability, regulatory obligations, IP assignment, indemnity scope, tax, insurance, and anything specific to the jurisdiction.

   **Check:** Items that need legal judgement are in this list rather than stated as conclusions.

7. **Deliver the memo** in the format below. Offer to add renewal-notice and termination deadlines to Google Calendar, and create events only after the user confirms. Do not send redlines or comments to the counterparty; the user (or their lawyer) does that.

   **Check:** The memo opens with the not-legal-advice line and the top three issues; nothing was shared externally by the agent.

## Key terms summary

| Term | What to record |
| :--- | :--- |
| Parties and affiliates | Exact legal entities; who else may use the service |
| Term and renewal | Initial term, auto-renewal, notice window and deadline date |
| Fees and increases | Amounts, payment terms, renewal price caps, late fees |
| Termination | For convenience (who may), for cause, cure periods, effects (data return, refunds) |
| Liability | Cap amount and basis, exclusions, carve-outs from the cap |
| Indemnities | Who indemnifies whom, for what, with what procedure |
| IP and licence | Ownership of deliverables, customer data, feedback; licence scope |
| Confidentiality | Definition, duration, permitted disclosures |
| Data protection | DPA, sub-processors, breach-notice timing, data location, use of data for model training |
| Security | Required controls, audits and reports, incident duties |
| SLA | Availability target, credits, exclusions, sole-remedy language |
| Warranties | What is warranted, disclaimers |
| Governing law and disputes | Law, venue, arbitration |
| Assignment | Consent requirements, change of control |
| Restrictions | Exclusivity, non-solicitation, non-compete, most-favoured pricing |
| Publicity | Use of names and logos |

## Red flags

| Clause | Red flag | Typical ask |
| :--- | :--- | :--- |
| Renewal | Auto-renewal with a long notice window | Shorter window, renewal reminder, or opt-in renewal |
| Pricing | Uncapped increases on renewal | Cap increases or fix prices for the renewal term |
| Changes | Vendor may change terms by updating a URL | Notice of material changes and a right to terminate |
| Liability | Cap applies to one side only, or uncapped indemnities | Mutual cap; specific, mutual carve-outs |
| Data | Vendor may use customer data for its own purposes or to train models | Prohibit, or limit to aggregated and de-identified data with opt-out |
| IP | Broad assignment of customer materials or improvements | Customer keeps its data and materials; licence only what is needed |
| Termination | Only the counterparty may terminate for convenience | Mutual rights, or a pro-rata refund |
| Restrictions | Exclusivity or non-compete with broad scope | Narrow scope and duration, or remove |
| Assignment | Counterparty may assign to anyone, including competitors | Consent required, except to a successor in a merger |
| Remedies | SLA credits as the sole remedy for chronic failure | Termination right after repeated misses |
| Disputes | Distant venue or one-sided arbitration terms | Neutral or home venue, mutual terms |

## Memo format

```markdown
# Contract review: <agreement name>, <version or date>
Not legal advice. Prepared to help <user> brief a qualified lawyer.

## Summary
<one-line deal summary> · Overall risk: High | Medium | Low

## Top issues
| # | Section | Issue | Risk | Preferred | Fallback |

## Key terms
<table from the key terms summary>

## Questions for counsel
## Deadlines           <renewal notice date, termination windows>
## Not reviewed        <documents or exhibits not available>
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Review only the main document | Collect every incorporated document and URL | Key terms often sit in the DPA, SLA or online terms |
| Say "this clause is unfavourable" | Give replacement wording and a fallback | Vague comments do not move a negotiation |
| Give legal conclusions ("this is enforceable") | Flag the point as a question for counsel | Enforceability depends on law and facts the agent cannot verify |
| Edit the original file | Use suggestion mode or a copy | The user needs a clean record of what was offered |
| Spend equal effort on every contract | Match depth to value and risk | Small, standard agreements rarely justify full redlines |
| Paste confidential contracts into untrusted tools | Keep review inside approved tools | Contracts usually carry confidentiality duties |

## Verification checklist

- [ ] Context, side and priorities are recorded.
- [ ] All incorporated documents are listed with review status.
- [ ] The key terms table is complete with section references.
- [ ] Each High and Medium issue has preferred and fallback wording.
- [ ] Legal-judgement items are listed for counsel.
- [ ] The memo states it is not legal advice; nothing was signed, accepted or sent by the agent.

## Related

- Knowledge: `policy-drafting`, `partnerships`, `gdpr-privacy`, `soc2-compliance`, `pricing-strategy`.
- Agents: `compliance-auditor`, `chief-of-staff`.
