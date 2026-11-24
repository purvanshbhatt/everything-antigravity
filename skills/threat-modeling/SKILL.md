---
name: threat-modeling
disable-model-invocation: true
description: >-
  Runs a threat model for a feature or system change: scope, data-flow diagram
  with trust boundaries, STRIDE per element, abuse cases, risk rating,
  mitigations mapped to owners, and tracked follow-ups. Use when the user asks
  to threat-model a design, before building auth, payments, file upload, LLM
  tools or multi-tenant features, or when a security review asks for one.
  Invoke with /threat-modeling.
---

# Threat Modeling

Answer four questions for one feature: what are we building, what can go
wrong, what will we do about it, and did we do a good job. The output is a
reviewed document plus tracked mitigations, not a diagram that nobody reads.

## When to use

- A design doc or spec exists and the feature touches identity, money, personal data, uploads, webhooks, tenancy or an LLM with tools.
- The user says "threat model", "STRIDE", "abuse cases", "what could an attacker do here".
- A significant change to an existing flow: new trust boundary, new third party, new data store.
- An auditor or customer questionnaire asks for threat-model evidence.

## When not to use

- Auditing code that already exists for vulnerabilities: use `security-audit` or `/security-scan`.
- Privacy-specific impact assessments (DPIA): use `gdpr-privacy`; it can reuse this data-flow diagram.
- LLM-specific attack surface in depth: run this workflow, then apply `llm-app-security`.
- Testing a live system: use `web-pentest-authorized` with written scope.

## Workflow

1. **Scope the model.** Name the feature, the version or PR, the in-scope components and what is explicitly out of scope. Read the spec, ADRs and any implementation-plan artifact with `view_file`; find entry points with `grep_search` (route decorators, queue consumers, webhook handlers, tool definitions).

   **Check:** One paragraph states the feature, its users, its assets (data, money, availability, reputation) and the scope boundary.

2. **Draw the data-flow diagram.** Use Mermaid so it lives in the repo. Elements: external entities (users, third parties), processes (services, functions, the LLM), data stores, data flows. Draw every trust boundary where privilege or ownership changes.

   ```mermaid
   flowchart LR
     U[Browser user] -->|HTTPS + session| API
     subgraph Cloud["Trust boundary: our project"]
       API[API service] -->|SQL| DB[(Postgres)]
       API -->|signed URL| GCS[(Object storage)]
     end
     PSP[Payment provider] -->|webhook, signed| API
   ```

   **Check:** Every flow that crosses a boundary is labelled with protocol and authentication.

3. **Enumerate threats with STRIDE per element.** Apply only the categories that fit each element type (table below). For each threat write one sentence: actor, action, asset, consequence. Add abuse cases from the product view ("a user refunds an order twice", "a tenant reads another tenant's export").

   **Check:** Every boundary-crossing flow and every data store has at least one threat considered, or a written reason why none apply.

4. **Rate each threat.** Use a simple likelihood (Low/Med/High) times impact (Low/Med/High) grid and record the reasoning. Do not spend time on decimal scores. Map the result onto the severity rubric in `security-audit` so findings and threats share one scale.

   **Check:** No threat is unrated; High/High items are at the top.

5. **Choose a response per threat:** mitigate (name the control), eliminate (remove the feature or data), transfer (contract, insurance, provider) or accept (named owner and expiry date). Prefer controls that already exist in the codebase.

   **Check:** Each mitigation names a concrete control, an owner and a verification method (test, config check, alert).

6. **Write the artifact.** Save to `docs/security/threat-models/<feature>.md` using the template below and present it as an Antigravity artifact for review. For a second opinion on High risks, delegate the diagram and threat list to the `security-guard` subagent.

   **Check:** The user has reviewed the artifact; open questions are listed, not silently dropped.

7. **Track follow-ups.** Draft one issue per mitigation (title, threat ID, acceptance criteria). Ask the user for explicit confirmation before creating issues in any external tracker. Add security test cases for mitigations to the test plan.

   **Check:** Every "mitigate" row links to an issue or a merged change.

8. **Set re-review triggers:** new trust boundary, new data category, new third party, auth change, or an incident touching the feature.

## Reference

### STRIDE per element

| Element | S | T | R | I | D | E |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| External entity | x | | x | | | |
| Process | x | x | x | x | x | x |
| Data store | | x | x | x | x | |
| Data flow | | x | | x | x | |

### Prompts that find real threats

| Area | Ask |
| :--- | :--- |
| Identity | Which identity does each hop run as? Can a lower-privileged caller trigger a higher-privileged action? |
| Objects | Is every object lookup scoped by owner or tenant? What about exports, search and admin views? |
| Input | Which inputs reach a parser, template, shell, SQL, URL fetcher or LLM prompt? |
| Money and quotas | Can an action be replayed, raced or repeated to gain value or burn budget? |
| Third parties | What if the provider is down, slow, compromised or sends forged callbacks? |
| Secrets | Where are credentials stored, who can read them, how are they rotated? |
| Logs | Do logs capture actor and action, and exclude secrets and personal data? |

### Template

```markdown
# Threat model: <feature> (<date>, <version/PR>)
## Scope and assets
## Data-flow diagram
## Assumptions
## Threats
| ID | Element | STRIDE | Threat | Likelihood | Impact | Response | Control | Owner | Issue |
## Accepted risks (owner, expiry)
## Open questions
## Re-review triggers
```

Tool options: OWASP Threat Dragon, pytm (threats as code), Threagile. Use LINDDUN alongside STRIDE when the feature processes personal data.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Model the whole company at once | One feature or change per model | Scope creep produces generic threats nobody owns |
| List "SQL injection" for every element | Write actor, action, asset, consequence | Generic threats cannot be verified or closed |
| Rate with precise numeric scores | Coarse likelihood x impact with reasoning | False precision invites debate instead of fixes |
| Accept risk with no owner | Owner plus expiry date | Unowned acceptance becomes permanent by default |
| File the doc and move on | Link mitigations to issues and tests | Untracked mitigations do not get built |
| Model after launch only | Model at design, update on change | Design-time fixes are cheapest |

## Verification checklist

- [ ] Scope, assets and out-of-scope items are written down.
- [ ] The DFD shows every trust boundary, with protocol and auth on crossing flows.
- [ ] STRIDE was applied per element; abuse cases were added.
- [ ] Every threat has a rating and a response; accepted risks have an owner and expiry.
- [ ] Mitigations have owners, verification methods and linked issues (created only after user confirmation).
- [ ] Re-review triggers are listed and the artifact was reviewed by the user.

## Related

- Knowledge: `security-audit`, `llm-app-security`, `api-security`, `gdpr-privacy`, `auth-patterns`, `cloud-security-posture`.
- Workflows: `/security-scan`, `/write-spec`, `/architecture-decision`.
- Agents: `security-guard`, `code-architect`.
