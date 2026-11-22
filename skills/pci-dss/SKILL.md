---
name: pci-dss
description: >-
  PCI DSS scope reduction for engineers: what counts as account data,
  keeping card data off your systems with hosted fields and tokenization,
  network segmentation, choosing the likely SAQ type, payment-page script
  controls, PAN detection in logs, and evidence for assessors. Use when
  building checkout or payment flows, choosing a payment integration, or
  preparing for a PCI assessment. Not legal advice.
---

# PCI DSS Scope Reduction

The cheapest PCI program is the one where card numbers never touch your
servers. Design payment flows so the provider handles account data, prove that
nothing else can see it, and keep the remaining scope small and segmented.

> Not legal or compliance advice. Your acquirer, the card brands and a Qualified Security Assessor (QSA) determine your validation requirements and SAQ eligibility. PCI DSS v4.0.1 is the current version at the time of writing; verify against the PCI Security Standards Council's current documents.

## When to use

- Designing or changing checkout, saved cards, subscriptions, call-center payments or refunds.
- Choosing between payment integrations (redirect, hosted fields, direct API).
- A card number appears in logs, a database or a support ticket.
- Preparing a self-assessment questionnaire (SAQ) or a QSA assessment.

## When not to use

- Payment provider integration details (webhooks, subscriptions, SCA): use `payments-stripe`.
- Ledgers, balances and reconciliation: use `fintech-ledgers`.
- General security program evidence: use `soc2-compliance`.

## Workflow

1. **Classify the data.** Account data is cardholder data (PAN, cardholder name, expiration date, service code) plus sensitive authentication data (full track data, card verification codes, PINs and PIN blocks). Sensitive authentication data must never be stored after authorization, even encrypted.

   **Check:** You can state, for every system, whether it stores, processes or transmits any account data.

2. **Push account data to the provider.** Prefer, in order: provider-hosted payment page or redirect; provider-hosted fields or iframes (for example Stripe Checkout or Elements); direct API with your servers receiving PAN only when unavoidable. Store provider tokens, last four digits, brand and expiry month/year for display.

   **Check:** `grep_search` across the codebase finds no request handler, model or table that accepts a raw card number or CVC.

3. **Map the cardholder data environment (CDE).** In scope: systems that store, process or transmit account data, plus systems connected to them or able to affect their security (including the web server that serves the payment page script). Draw it with the data-flow diagram from `/threat-modeling`.

   **Check:** The scope diagram is reviewed by the user and lists every connected system.

4. **Segment what remains.** Isolate CDE components in their own projects, VPCs or networks with deny-by-default firewall rules, separate IAM, and separate CI deployers. Segmentation controls must be tested by penetration testing at the frequency PCI DSS requires.

   **Check:** A host outside the CDE cannot reach CDE services on any port not explicitly allowed.

5. **Control payment-page scripts.** For e-commerce pages that host or embed payment fields, inventory and authorize every script, set a strict CSP, use Subresource Integrity where possible, and detect unauthorized changes to the page and its headers. SAQ A eligibility criteria for script controls were revised in 2025; confirm current requirements with your acquirer or QSA.

   **Check:** A script inventory with justification exists, and the payment page CSP blocks unknown origins.

6. **Detect stray PANs.** Scan logs, databases, support exports and object storage for card numbers with a Luhn check; mask output so the scanner itself does not leak data.

   ```python
   import re
   PAN_RE = re.compile(r"\b(?:\d[ -]?){13,19}\b")

   def luhn_ok(digits: str) -> bool:
       total, alt = 0, False
       for ch in reversed(digits):
           d = int(ch) * (2 if alt else 1)
           total += d - 9 if d > 9 else d
           alt = not alt
       return total % 10 == 0

   def find_pans(text: str) -> list[str]:
       hits = []
       for m in PAN_RE.finditer(text):
           digits = re.sub(r"\D", "", m.group())
           if 13 <= len(digits) <= 19 and luhn_ok(digits):
               hits.append(f"{digits[:6]}...{digits[-4:]}")   # never print a full PAN
       return hits
   ```

   **Check:** Scheduled scans run on log sinks and support tools; findings trigger purge and root-cause fixes. Purging data is irreversible; confirm with the user and preserve evidence per the incident process first.

7. **Assemble evidence.** Scope diagram, data-flow, provider attestation of compliance (AOC), segmentation test results, vulnerability scans (including approved scanning vendor scans where required), access reviews and the completed SAQ or report. Ask the user before sending documents to an assessor or acquirer.

## Reference

### Integration choice and likely SAQ (confirm with acquirer or QSA)

| Integration | Card data touches your servers? | Likely validation |
| :--- | :--- | :--- |
| Full redirect or provider-hosted page | No | SAQ A |
| Provider iframes / hosted fields on your page | No, but your page delivers them | SAQ A (subject to current eligibility criteria) |
| Your page's JavaScript sends card data to the provider | No, but your site affects its security | SAQ A-EP |
| Your servers receive PAN | Yes | SAQ D or a QSA report |
| Validated P2PE terminals | No | SAQ P2PE |

### The 12 principal requirements (PCI DSS v4.x)

1 Network security controls; 2 secure configurations; 3 protect stored account data; 4 strong cryptography in transmission over open networks; 5 anti-malware; 6 secure systems and software; 7 need-to-know access; 8 identification and authentication; 9 physical access; 10 logging and monitoring; 11 regular security testing; 12 policies and programs.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Proxy card data through your API "for validation" | Let the provider's fields send it directly | Your API, logs and network become the CDE |
| Store CVC to retry failed charges | Use provider tokens and retries | Storing sensitive authentication data is prohibited |
| Log full request bodies on payment routes | Allowlisted log fields | Logs are the most common place stray PANs appear |
| Load third-party tags on the checkout page | Minimal, inventoried scripts under strict CSP | Script injection skims cards from compliant forms |
| Assume the provider's AOC covers you | Validate your own SAQ for your integration | Provider compliance covers their scope, not yours |

## Verification checklist

- [ ] No system you operate accepts or stores raw PAN or CVC, or the CDE is fully mapped.
- [ ] Scope diagram includes connected systems and the payment-page delivery path.
- [ ] Segmentation is enforced and tested.
- [ ] Payment-page scripts are inventoried and constrained by CSP.
- [ ] PAN scans run on logs and data stores with masked output.
- [ ] The not-legal-advice caveat was given and the acquirer or QSA confirmed the SAQ type.

## Related

- Knowledge: `payments-stripe`, `fintech-ledgers`, `soc2-compliance`, `cloud-networking`, `cryptography`, `secrets-management`, `security-audit`.
- Workflows: `/threat-modeling`, `/security-scan`.
- Agents: `compliance-auditor`, `security-guard`.
