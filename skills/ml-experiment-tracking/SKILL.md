---
name: ml-experiment-tracking
description: >-
  Sets up experiment tracking for ML and LLM work with MLflow, Vertex AI
  Experiments or Weights & Biases: a run contract (params, step metrics,
  artifacts, git SHA, data and environment versions), a logging helper, model
  registry versions and aliases, comparing runs, and reproducing a past
  result. Use when the user asks to track experiments, compare runs or log a
  model, or nobody knows which run produced a model.
---

# ML Experiment Tracking

Every number that informs a decision must trace back to a run that recorded
the code, data, config and environment behind it. Pick one tracker per
project, wrap it in a thin helper, and make "reproduce run X" a tested path.

## When to use

- Starting a training, tuning or evaluation project ("track experiments", "compare runs", "log the model").
- A result cannot be reproduced, or nobody can say which run produced the deployed model.
- Comparing prompt or model variants for an LLM feature over weeks.

## When not to use

- Choosing metrics, splits and significance tests: `ml-evaluation`. LLM quality gates: `agent-evals`.
- Tracing prompts and tool calls in production: `llm-observability`.
- Lineage and validation of data pipelines: `data-quality`.

## Workflow

1. **Choose one tracker and record where it lives.**

   | Need | Choose |
   | :--- | :--- |
   | Open source, self-hosted or local-first, built-in model registry | MLflow |
   | Already on Vertex AI; pipelines and managed TensorBoard | Vertex AI Experiments (SDK `google-cloud-aiplatform`) |
   | Hosted dashboards, sweeps, team collaboration | Weights & Biases (check pricing, data residency and terms) |

   **Check:** the README names the tracker, its backend URI, and who can read it.

2. **Define the run contract.** Every run logs:
   - Params: the full resolved config, also saved as `config.json`.
   - Metrics with a `step`, plus the best and final values.
   - Tags: `git_sha`, `git_dirty`, data version (manifest hash, DVC revision or BigQuery snapshot time), environment (Python, framework, CUDA, lockfile hash), seed, hardware.
   - Artifacts: model or adapter, evaluation report, plots, confusion matrix.

   Name experiments after the question ("tokenizer-ablation") and runs after the variant.

   **Check:** a colleague can rerun from the run page alone.

3. **Wrap the tracker in a helper** (pattern below) so scripts and notebooks log the same tags. Equivalent calls:

   | Action | MLflow | Vertex AI Experiments | W&B |
   | :--- | :--- | :--- | :--- |
   | Init | `mlflow.set_tracking_uri(uri)`, `mlflow.set_experiment(name)` | `aiplatform.init(project=, location=, experiment=name)` | `wandb.init(project=, config=cfg)` |
   | Run | `with mlflow.start_run(run_name=...)` | `aiplatform.start_run(name)` ... `aiplatform.end_run()` | the object `wandb.init` returns; `run.finish()` |
   | Params | `mlflow.log_params(d)` | `aiplatform.log_params(d)` | `config=` at init |
   | Metrics | `mlflow.log_metric(k, v, step=s)` | `aiplatform.log_metrics(d)`; `aiplatform.log_time_series_metrics(d, step=s)` needs a backing TensorBoard | `run.log(d, step=s)` |
   | Artifacts | `mlflow.log_artifact(path)` | write to GCS and register in Model Registry | `run.log_artifact(wandb.Artifact(...))` |

   Vertex run names accept lowercase letters, digits and dashes; check the length limit in the docs.

   **Check:** one smoke run shows params, a metric curve, tags and an artifact in the UI.

4. **Keep dirty runs out of decisions.** Tag `git_dirty=true` and filter those runs out of comparisons, or fail the training entry point in CI when the tree is dirty.

   **Check:** `mlflow.search_runs(filter_string="tags.git_dirty = 'false'")` (or your tracker's filter) returns the candidate runs.

5. **Register models with versions and aliases.** MLflow: log with the flavor (`mlflow.pytorch.log_model`, `mlflow.sklearn.log_model`), then `mlflow.register_model(f"runs:/{run_id}/model", "churn")` and `MlflowClient().set_registered_model_alias("churn", "champion", version)`. Model stages are deprecated in favour of aliases. MLflow 3 changes model logging and adds GenAI tracing; check the API for your major version. Vertex: `aiplatform.Model.upload(..., parent_model=<model resource>)` creates a new version.

   **Check:** the serving config references an alias or version, and that version links back to its source run.

6. **Compare runs with uncertainty.**

   ```python
   runs = mlflow.search_runs(experiment_names=["churn"], filter_string="metrics.val_f1 > 0.7",
                             order_by=["metrics.val_f1 DESC"], max_results=20)
   print(runs[["run_id", "tags.mlflow.runName", "metrics.val_f1", "params.lr"]])
   ```

   Compare only runs with the same data-version tag, and report differences with confidence intervals (`ml-evaluation`).

   **Check:** the comparison table states the data version and baseline run.

7. **Reproduce on demand.** Check out `git_sha`, restore the lockfile environment, fetch the data version, rerun with the logged `config.json`, and compare the metric.

   **Check:** the reproduced metric is within the noise band recorded for that experiment.

## Patterns

### MLflow run helper

```python
import hashlib, json, platform, subprocess
import mlflow

def _git() -> dict[str, str]:
    sha = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], text=True).strip())
    return {"git_sha": sha, "git_dirty": str(dirty).lower()}

def _sha(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]

def start_run(experiment: str, run_name: str, config: dict, data_manifest: str, lockfile: str):
    """Start an MLflow run that satisfies the run contract; caller must end it."""
    mlflow.set_experiment(experiment)
    run = mlflow.start_run(run_name=run_name)
    mlflow.set_tags({**_git(), "data_manifest_sha": _sha(data_manifest),
                     "env_python": platform.python_version(), "env_lock_sha": _sha(lockfile)})
    mlflow.log_params({k: v for k, v in config.items() if not isinstance(v, (dict, list))})
    mlflow.log_dict(config, "config.json")
    return run
```

### Tracking server

- Local: `mlflow ui --backend-store-uri sqlite:///mlflow.db`.
- Team: `mlflow server` with a database backend store and a GCS or S3 artifact location (check `mlflow server --help` for the artifact flags of your version). The server has no authentication by default: put it behind an authenticating proxy (for example IAP on Cloud Run) or enable the built-in auth option your version documents. Never expose it publicly.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Log only the final metric | Log per step plus best and final | Curves reveal overfitting and instability |
| Encode config in run names | Log params and `config.json` | Names are lossy and unparseable |
| Put API keys or tokens in the logged config | Redact secrets before logging | Tracker readers are not secret-cleared |
| Compare runs across data versions | Filter on the data tag | Different data makes the comparison meaningless |
| Use registry stages | Use aliases (`champion`, `challenger`) | Stages are deprecated |
| Send one HTTP call per metric per step | Batch metrics and log every N steps | Remote trackers throttle and slow training |

## Verification checklist

- [ ] One tracker is chosen and its backend and access are documented.
- [ ] Every run has the git SHA, dirty flag, data version, environment and seed.
- [ ] The full config is stored as an artifact.
- [ ] The deployed model resolves through an alias or version to a known run.
- [ ] Comparisons filter on data version and include uncertainty.
- [ ] A past run was reproduced within noise at least once.

## Related

- Knowledge: `pytorch-training`, `ml-evaluation`, `vertex-ai`, `jupyter-notebooks`, `llm-fine-tuning`, `data-quality`, `agent-evals`, `llm-observability`.
- Agents: `ml-engineer`, `data-engineer`.
