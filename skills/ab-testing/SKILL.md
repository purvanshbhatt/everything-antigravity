---
name: ab-testing
disable-model-invocation: true
description: >-
  Designs, runs and analyzes A/B tests and online experiments: hypotheses,
  primary and guardrail metrics, minimum detectable effect, sample size and
  duration, randomization unit, A/A and sample ratio mismatch checks, peeking,
  multiple comparisons and novelty effects, and pre-registered decision rules.
  Use when the user wants to test a change, asks how long to run an experiment
  or how many users are needed, or asks whether a result is significant.
---

# A/B Testing

An experiment is a decision procedure written down before the data arrives.
Fix the hypothesis, metrics, sample size and decision rules first; then the
analysis is a lookup, not a debate.

## When to use

- "Should we A/B test this?", "how long do we need to run it?", "is this result significant?".
- Planning an experiment on onboarding, pricing pages, emails, ranking or UI changes.
- Reviewing an experiment readout for analysis mistakes.
- Setting up experimentation practice (templates, guardrails, review).

## When not to use

- Deciding what to measure in the product at all: `product-analytics`.
- Offline model evaluation: `ml-evaluation`.
- Flag mechanics, rollout and kill switches: `feature-flags`.
- Price tests: read the ethics rules in `pricing-strategy` first.

## Workflow

1. **Decide whether an experiment fits.** You need enough traffic to detect a meaningful effect within an acceptable duration, a reversible change and an outcome measurable within weeks. Otherwise use a staged rollout with before/after monitoring, or qualitative tests.

   **Check:** The sample-size estimate from step 4 fits within the longest duration the team will accept.

2. **Pre-register the hypothesis.** "Because *<evidence>*, we believe *<change>* for *<population>* will move *<primary metric>* by at least *<MDE>*." Record it with metrics, sample size, duration and decision rules in a Doc before launch.

   **Check:** The pre-registration doc is dated and shared before any user is exposed.

3. **Choose metrics.** One primary metric that decides; a few secondary metrics for understanding; guardrails that must not degrade (latency, errors, revenue per user, unsubscribes, support contacts). Define unit, window and query for each.

   **Check:** Each metric has an exact definition and a query that runs today.

4. **Compute sample size and duration.** Use the baseline from analytics and the smallest effect worth acting on (MDE). Run whole weeks to cover weekday cycles.

   **Check:** Users per arm and run length are recorded; if too long, raise the MDE, pick a more sensitive metric, or do not test.

5. **Randomize and log exposure correctly.** Randomize by user for most products and by account or organization for B2B or collaborative features. Use deterministic hashing through the flag tool so assignment is sticky. Log exposure at the moment the user first sees the change. Run an A/A test when the pipeline is new.

   **Check:** Assignment is stable across sessions and devices where possible; the A/A test shows no significant differences beyond chance.

6. **Monitor guardrails and sample ratio only.** Check daily for sample ratio mismatch (SRM) and guardrail harm, with a kill switch ready. Do not look at the primary metric to decide early unless you planned a sequential method.

   **Check:** The SRM p-value stays above the agreed threshold (0.001 is a common choice); no guardrail breach.

7. **Analyze once at the planned end.** Report the effect with a confidence interval, not only a p-value. Plot the daily effect to spot novelty or primacy effects. Treat segment cuts as exploratory unless pre-registered.

   **Check:** The readout includes absolute and relative effect, confidence interval, sample sizes per arm, SRM result and guardrails.

8. **Decide with the pre-registered rules** (table below), record the decision, and archive the readout where future teams can find it.

   **Check:** The decision matches the rule table, or the deviation is explained and approved by the owner.

## Sample size

For a conversion metric with two-sided alpha 0.05 and power 0.80, a quick approximation:

```text
n per arm ~ 16 x p x (1 - p) / delta^2        p = baseline rate, delta = absolute MDE
continuous metric: n per arm ~ 16 x sigma^2 / delta^2
```

Illustrative: baseline 10%, MDE one percentage point (10% to 11%): 16 x 0.09 / 0.0001 = 14,400 users per arm.

```python
from statsmodels.stats.power import NormalIndPower
from statsmodels.stats.proportion import proportion_effectsize

effect = proportion_effectsize(0.11, 0.10)   # treatment, control
n = NormalIndPower().solve_power(effect_size=effect, alpha=0.05, power=0.8,
                                 alternative="two-sided")
print(round(n))  # users per arm
```

SRM check (50/50 split):

```python
from scipy.stats import chisquare
total = n_control + n_treatment
p_value = chisquare([n_control, n_treatment], f_exp=[total / 2, total / 2]).pvalue
```

## Pitfalls

| Pitfall | Symptom | Remedy |
| :--- | :--- | :--- |
| Peeking | Stopping when p first dips below 0.05 | Fixed horizon, or a planned sequential test (group sequential, always-valid intervals) |
| Many metrics or variants | "Something" is always significant | One primary metric; Holm or Bonferroni correction for the rest |
| Sample ratio mismatch | Arms differ in size more than chance allows | Stop; fix assignment, redirects, bots or logging before reading results |
| Novelty or primacy | Effect fades or grows over days | Plot the daily effect; run long enough; analyse new users separately |
| Interference | Treated users affect control (marketplaces, social, shared docs) | Cluster or switchback randomization |
| Ratio metrics on user-randomized tests | Click-through per pageview has wrong variance | Delta method or bootstrap by user |
| Underpowered test | "No significant difference" | Report the confidence interval; absence of evidence is not evidence of no effect |
| High variance | Long run times | Variance reduction with pre-period data (CUPED) |

## Decision rules

| Result | Decision |
| :--- | :--- |
| Primary significantly positive, guardrails fine | Ship |
| Primary positive, a guardrail harmed | Do not ship by default; the owner decides the trade-off explicitly |
| Flat: interval includes zero and excludes the MDE | Ship only if simpler or cheaper; otherwise drop |
| Inconclusive: interval wide enough to include the MDE | No conclusion; extend only if the plan allowed it |
| Primary significantly negative | Do not ship; record the learning |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Choose the metric after seeing results | Pre-register one primary metric | Post-hoc metric choice guarantees false wins |
| Randomize by pageview or session | Randomize by user or account | Users see both variants and the arms contaminate each other |
| Stop at the first significant day | Run to the planned sample and full weeks | Early stopping inflates false positives |
| Report only the p-value | Report effect size and confidence interval | Decisions need magnitude, not just direction |
| Test dark patterns or deceptive copy | Test honest variants only | Short-term gains damage trust and may breach consumer law |
| Ignore SRM | Check SRM before reading any metric | A broken split invalidates every result |

## Verification checklist

- [ ] Hypothesis, metrics, sample size, duration and decision rules were recorded before launch.
- [ ] Randomization unit matches the feature; exposure is logged at first view.
- [ ] SRM and guardrails were monitored; the A/A test passed for new pipelines.
- [ ] The readout reports effect sizes with confidence intervals and per-arm counts.
- [ ] The decision follows the pre-registered rules, and the readout is archived.

## Related

- Knowledge: `product-analytics`, `feature-flags`, `ml-evaluation`, `pricing-strategy`, `email-marketing`, `data-storytelling`.
- Agents: `data-analyst`.
