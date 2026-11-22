---
name: ml-evaluation
description: >-
  Evaluates predictive ML models rigorously: metrics matched to the decision
  for classification, regression and ranking, split design with group and time
  splits, leakage hunting, threshold selection, probability calibration,
  bootstrap confidence intervals and paired significance tests, slice-based
  error analysis, and a reproducible evaluation report. Use when judging,
  comparing or signing off a model, or when offline scores look too good.
---

# ML Evaluation

An evaluation is a claim about future data. Make it with the metric that
matches the decision, a split that mirrors deployment, uncertainty around
every number, and an error analysis that shows where the model fails.

## When to use

- Signing off a model, or deciding whether model B really beats model A.
- "Accuracy is 99% but users complain", or offline scores that look too good.
- Choosing a decision threshold, or using predicted probabilities downstream.

## When not to use

- LLM and agent output quality: `agent-evals`.
- Forecast backtesting specifics: `time-series-forecasting`. Online experiments: `ab-testing`.
- Fairness assessment across groups: `responsible-ai` (it builds on this skill's slices and intervals).

## Workflow

1. **Tie the metric to the decision.** Write the primary metric and one or two guardrails before looking at results.

   | Task | Primary metrics | Pitfall |
   | :--- | :--- | :--- |
   | Binary, balanced | ROC-AUC, F1 | Both hide the chosen threshold |
   | Binary, imbalanced | PR-AUC (average precision), recall at fixed precision | Accuracy and ROC-AUC flatter the majority class |
   | Multiclass | Macro-F1, per-class precision and recall | Micro averages hide rare classes |
   | Probabilities used downstream | Log loss, Brier score, calibration error | Good ranking, bad probabilities |
   | Regression | MAE (robust), RMSE (punishes large errors) | MAPE explodes near zero |
   | Ranking | NDCG@k, MAP, recall@k | k must match what users see |
   | Forecasting | MASE, WAPE, pinball loss | See `time-series-forecasting` |

   When errors have different costs, also report expected cost: `cost_fp * FP + cost_fn * FN`.

   **Check:** the metric choice and its reason are in the evaluation plan.

2. **Design splits that mirror deployment.** Stratified random splits only when rows are independent; `GroupKFold` or `StratifiedGroupKFold` when users, patients, devices or sessions repeat; a time cutoff or `TimeSeriesSplit` when predicting the future; a held-out region or customer for expansion scenarios. Use nested cross-validation for hyperparameters on small data. Freeze the test set and use it once.

   **Check:** an assertion proves no group ID or time range overlaps across splits.

3. **Hunt for leakage.**
   - Features computed after the label time (no point-in-time correctness).
   - Scalers, imputers, encoders or feature selection fit before the split: put them inside an `sklearn.pipeline.Pipeline` evaluated within CV.
   - Duplicate or near-duplicate rows across splits.
   - IDs or timestamps that correlate with the label; label proxies such as `refund_issued` when predicting churn.

   Red flags: a suspiciously high score, or one feature dominating importance.

   **Check:** the top ten feature importances were reviewed with a domain expert, and removing the top feature does not make the score collapse in a way that suggests a proxy.

4. **Choose the threshold on validation.** Plot precision and recall against the threshold, select by expected cost or a constraint (for example precision at least 0.9), and freeze it before touching the test set.

   **Check:** the threshold and its rationale are recorded.

5. **Calibrate when probabilities matter.** Plot a reliability diagram (`sklearn.calibration.calibration_curve`) and compute the Brier score (`sklearn.metrics.brier_score_loss`). Fix with `CalibratedClassifierCV(method="sigmoid")`, or `method="isotonic"` when you have roughly a thousand or more calibration samples, fit on data the model did not train on.

   **Check:** calibration error and Brier score improve on the test set.

6. **Quantify uncertainty and compare models on the same rows.**

   ```python
   import numpy as np
   from sklearn.metrics import f1_score

   def paired_bootstrap(y, pred_a, pred_b, metric=f1_score, n: int = 2000, seed: int = 0):
       """Mean and 95% CI of metric(B) - metric(A) on resampled test rows."""
       rng = np.random.default_rng(seed)
       y, pred_a, pred_b = map(np.asarray, (y, pred_a, pred_b))
       diffs = np.empty(n)
       for i in range(n):
           idx = rng.integers(0, len(y), len(y))
           diffs[i] = metric(y[idx], pred_b[idx]) - metric(y[idx], pred_a[idx])
       lo, hi = np.percentile(diffs, [2.5, 97.5])
       return float(diffs.mean()), (float(lo), float(hi))
   ```

   Resample groups instead of rows when data is grouped. For two classifiers' paired errors, McNemar's test (`statsmodels.stats.contingency_tables.mcnemar`) is the standard check. Report effect sizes with intervals, not bare p-values, and correct for many comparisons.

   **Check:** "B beats A" is claimed only when the interval for the difference excludes zero.

7. **Analyze errors by slice.** Compute the metric per segment (region, device, cohort, input length, label source) with intervals, find the worst slices, then read 50 errors and tag a cause for each (label noise, missing feature, ambiguity, distribution shift). Re-label a sample to estimate label noise.

   **Check:** the report lists the top three failure modes with counts and a proposed fix for each.

8. **Write a reproducible report.** Model and data versions, split method, metrics with intervals, a dumb baseline (majority class, last value or a linear model), calibration, slices, known limitations and the decision. Log it to the tracker (`ml-experiment-tracking`) and save it as an artifact for review.

   **Check:** someone else reproduces the headline numbers from the report.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Report accuracy on imbalanced data | PR-AUC and recall at fixed precision | The majority class hides failure |
| Tune the threshold on the test set | Tune on validation, test once | Optimistic bias |
| Fit preprocessing before splitting | Pipeline inside CV | Leakage |
| Random splits for grouped or temporal data | Group or time splits | Scores that never hold in production |
| Declare a winner from one number | Paired intervals or tests | Differences are often noise |
| Skip the baseline | Always include a dumb baseline | Gives the number meaning |

## Verification checklist

- [ ] Metric and guardrails were chosen before results.
- [ ] Splits mirror deployment and are asserted disjoint.
- [ ] The leakage checklist was completed.
- [ ] The threshold was set on validation; calibration was checked if probabilities are used.
- [ ] Comparisons carry confidence intervals on the same test rows.
- [ ] Slice analysis and a baseline are in a reproducible report.

## Related

- Knowledge: `agent-evals`, `time-series-forecasting`, `ab-testing`, `responsible-ai`, `ml-experiment-tracking`, `exploratory-data-analysis`, `data-quality`, `pytorch-training`.
- Agents: `ml-engineer`, `data-analyst`.
