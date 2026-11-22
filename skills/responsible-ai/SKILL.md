---
name: responsible-ai
description: >-
  Applies responsible AI practice to ML and generative AI features: use-case
  and harm review, fairness evaluation across groups, layered safety controls
  for Gemini apps, human oversight, model cards and AI disclosure, provenance
  with SynthID, policy and regulatory checklists, and incident response. Use
  before launching an AI feature, when a model affects people, or when
  reviewing safety settings. Not legal advice.
---

# Responsible AI

Treat responsible AI as engineering with artifacts: a use-case review,
measured disparities across groups, layered safety controls with tests,
documentation people can read, and a plan for when things go wrong. This is
practical guidance, not legal advice; involve legal and policy owners for
regulated uses.

## When to use

- Before launching any AI feature, and again when its model changes.
- Models that inform decisions about people: hiring, lending, housing, health, education, moderation.
- Configuring safety filters, or preparing model cards and documentation for customers or auditors.

## When not to use

- Prompt injection, data exfiltration and tool permissions: `llm-app-security`.
- Privacy law mechanics (DSARs, DPIAs, consent): `gdpr-privacy`. Health data: `hipaa-compliance`.
- General quality evals: `agent-evals`, `ml-evaluation`.

## Workflow

1. **Review the use case and harms.** Document intended use and users, affected non-users, out-of-scope uses, and the decision impact (informational, assistive or automated). List harms: allocation (who gets what), quality of service, representational, safety, privacy and misinformation; rate likelihood and severity. Note the regulatory context (for example EU AI Act risk tiers, sector rules) and policy context: use of Gemini and Gemma is subject to Google's prohibited use policies. Save the review as an artifact for sign-off.

   **Check:** a named owner signed the review, and high-risk uses list extra controls.

2. **Measure disparities.** Define groups using lawful, consented data (document proxies and their limits). Compute per-group selection rate, true and false positive rates, precision and calibration.

   ```python
   from fairlearn.metrics import MetricFrame, selection_rate
   from sklearn.metrics import precision_score, recall_score

   mf = MetricFrame(
       metrics={"recall": recall_score, "precision": precision_score, "selection_rate": selection_rate},
       y_true=y_test, y_pred=y_pred, sensitive_features=group_test,
   )
   print(mf.by_group)
   print(mf.difference(method="between_groups"))
   ```

   For generative features, run counterfactual prompt sets (swap names, genders, dialects, regions) and compare refusal rate, sentiment and graded quality per variant. Add confidence intervals for small groups (`ml-evaluation`). Fairness criteria conflict when base rates differ (demographic parity, equalized odds and calibration cannot all hold), so choose one with stakeholders and document why.

   **Check:** a per-group table with intervals, the chosen criterion and the acceptable gap are recorded.

3. **Mitigate and re-measure.** Data fixes (collect for under-represented groups, fix labels, rebalance), training constraints (`fairlearn.reductions`), post-processing such as group-specific thresholds (confirm legality in your domain first), and product fixes (human review for low-confidence or high-impact cases, an appeal path).

   **Check:** a before-and-after table shows the gap closed without unacceptable loss elsewhere.

4. **Layer safety controls for generative features.**
   - Model safety settings per harm category (`gemini-api` lists categories and thresholds).
   - A system instruction with an explicit content policy and refusal style.
   - Input and output classifiers: ShieldGemma open safety classifiers, or Model Armor on Google Cloud for prompt and response screening (check current capabilities).
   - Grounding and citations for factual claims; rate limits; abuse reporting.

   Test with a red-team set (harmful requests, jailbreaks, sensitive topics, several languages) using the `agent-evals` harness, and measure false refusals on a benign set too.

   **Check:** red-team pass rate and benign false-refusal rate are recorded and gated.

5. **Keep humans meaningfully in control.** Where AI output influences consequential decisions, a person can override; the UI shows confidence and evidence; nothing is pre-selected in a way that invites automation bias; audit logs store the AI suggestion, the human decision and the model version.

   **Check:** override rates are monitored and audit records are complete.

6. **Be transparent.** Publish a model card and a data card (template below), disclose AI-generated content in the UI, attach provenance to generated media (SynthID watermarks on Google generative outputs where available; C2PA metadata where supported), and explain how users can contest outcomes.

   **Check:** the model card is versioned with the model, and the UI disclosure ships.

7. **Monitor and respond.** Track per-group metrics, safety block rates and user reports in production. Keep a kill switch behind a feature flag (`feature-flags`) and a rollback model. For incidents, follow `incident-response` and write a `/postmortem`. Re-run steps 2 and 4 on every model change.

   **Check:** the kill switch was tested, and an on-call owner is named.

## Patterns

### Model card template

```markdown
# Model card: <name> v<version>
- Owner / contact:
- Intended use and users:            Out-of-scope uses:
- Decision impact: informational | assistive | automated
- Training and eval data: sources, dates, known gaps, consent basis
- Metrics: overall and per group, with intervals and the fairness criterion
- Safety: settings, classifiers, red-team pass rate, benign false-refusal rate
- Limitations and failure modes:
- Human oversight and appeal path:
- Change log:
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Report only overall metrics | Per-group metrics with intervals | Averages hide who is harmed |
| Rely on the model's built-in filters alone | Layered controls and red-team tests | Single layers fail open |
| Tune filters to block everything | Measure false refusals too | Over-blocking harms legitimate users |
| Collect sensitive attributes casually | Lawful basis, consent and minimization | Fairness work can create privacy harm |
| Treat review as a one-time launch gate | Re-review on every model change | Behaviour shifts across versions |
| Hide that content is AI-generated | Disclose and attach provenance | Trust and emerging legal duties |

## Verification checklist

- [ ] Use-case and harm review signed by an owner.
- [ ] Per-group metrics with intervals and a documented fairness criterion.
- [ ] Safety layers configured; red-team and benign false-refusal rates gated.
- [ ] Human oversight, audit logs and an appeal path exist for consequential decisions.
- [ ] Model card, UI disclosure and media provenance shipped.
- [ ] Monitoring, kill switch and incident path tested.

## Related

- Knowledge: `llm-app-security`, `agent-evals`, `ml-evaluation`, `gdpr-privacy`, `hipaa-compliance`, `gemini-api`, `feature-flags`, `incident-response`.
- Workflows: `/postmortem`.
- Agents: `compliance-auditor`, `security-guard`, `ml-engineer`.
