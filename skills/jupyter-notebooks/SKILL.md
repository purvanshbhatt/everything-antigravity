---
name: jupyter-notebooks
description: >-
  Keeps Jupyter notebooks reproducible and reviewable: structure, pinned
  kernels, restart-and-run-all checks, clean git diffs with nbstripout,
  Jupytext or nbdime, parameterized runs with papermill, CI execution with
  nbmake, Colab Enterprise and Vertex AI Workbench, safe agent edits of
  .ipynb files, and refactoring notebook code into modules and pipelines. Use
  when creating, cleaning, reviewing, scheduling or productionizing
  notebooks.
---

# Jupyter Notebooks

A notebook is a report that happens to run code. Make it run top to bottom on
a clean kernel, keep logic in importable modules, and give git a text form it
can diff.

## When to use

- Starting an analysis or experiment notebook.
- "It doesn't run on my machine", hidden state, or results that change on rerun.
- Noisy diffs and merge conflicts in `.ipynb` files.
- Scheduled or parameterized notebook runs, or turning a notebook into a pipeline.

## When not to use

- The analysis method itself: `exploratory-data-analysis`. Training code: `pytorch-training`.
- Production orchestration: `etl-pipelines`, or Vertex AI Pipelines in `vertex-ai`.

## Workflow

1. **Structure the notebook.** Markdown title with purpose, author and date; one cell tagged `parameters`; imports; config and paths; data loading; transformations that call functions from `src/`; results; conclusions and next steps in markdown. One notebook answers one question. Name files `NN-topic.ipynb` (for example `01-churn-eda.ipynb`).

   **Check:** a reader gets the conclusions from the markdown cells alone.

2. **Pin the environment and kernel.** Use the project's virtual environment and lockfile (uv, pip-tools, Poetry or conda), then register the kernel:

   ```bash
   python -m ipykernel install --user --name <project> --display-name "<project>"
   jupyter kernelspec list
   ```

   Print key library versions in an early cell. Never commit `!pip install` lines without pinned versions.

   **Check:** the notebook's kernel metadata names the project kernel.

3. **Restart and run all, headless.** Hidden state from out-of-order execution is the main reproducibility bug.

   ```bash
   jupyter nbconvert --to notebook --execute 01-churn-eda.ipynb --output-dir build/ --ExecutePreprocessor.timeout=600
   ```

   Set seeds, use paths relative to the repo root, and read data from versioned locations.

   **Check:** headless execution finishes with no errors.

4. **Make diffs reviewable.**

   | Tool | Purpose | Command |
   | :--- | :--- | :--- |
   | nbstripout | Strip outputs and volatile metadata on commit | `nbstripout --install` (per-repo git filter) |
   | Jupytext | Pair `.ipynb` with a `.py` percent script; review the script | `jupytext --set-formats ipynb,py:percent nb.ipynb`, then `jupytext --sync nb.ipynb` |
   | nbdime | Notebook-aware diff and merge | `nbdiff a.ipynb b.ipynb`; `nbdime config-git --enable` |

   Commit outputs only for report notebooks meant to be read online, and keep them small: no data dumps, no huge embedded HTML, no secrets or personal data.

   **Check:** a rerun produces a diff with only meaningful changes, and `eag shield --file nb.ipynb` is clean.

5. **Parameterize with papermill.** Tag one cell `parameters` with defaults, then run:

   ```bash
   papermill 02-report.ipynb out/report-emea.ipynb -p region emea -p min_orders 5
   ```

   `-p` infers types; use `-r name value` to force a raw string (for example a date like `2026-11`).

   **Check:** the output notebook contains the injected-parameters cell and runs headless.

6. **Test notebooks in CI.** `pip install nbmake`, then `pytest --nbmake notebooks/ --nbmake-timeout=600`. Point CI runs at a small sample dataset through parameters.

   **Check:** the CI job is green, and a deliberately broken cell fails it with the notebook name.

7. **Refactor into modules and pipelines.** When a block is reused or grows past roughly 30 lines, move it to `src/<package>/` as a tested function and import it (use `%load_ext autoreload` and `%autoreload 2` while developing). For production, `jupyter nbconvert --to script nb.ipynb` is only a starting point: turn the result into a CLI or pipeline step with config instead of globals. Colab Enterprise and Vertex AI Workbench can schedule notebook runs (check current features); anything business-critical belongs in a real pipeline.

   **Check:** business logic has unit tests outside the notebook (`python-testing`).

8. **Edit notebooks safely as an agent.** `.ipynb` is JSON; text replacements across cells corrupt it easily. Edit the paired Jupytext script and sync, or use `nbformat` programmatically. To read a notebook without flooding context with outputs, convert a copy first: `jupytext --to py:percent nb.ipynb -o -` prints the code cells. After any edit, validate and re-execute.

   ```bash
   python -c "import nbformat; nbformat.validate(nbformat.read('nb.ipynb', as_version=4))"
   ```

   **Check:** validation passes and headless execution (step 3) succeeds.

## Patterns

### Parameters cell and safe paths

```python
# Cell tagged "parameters": papermill injects overrides after this cell.
region = "all"
min_orders = 1
sample_frac = 1.0      # CI passes a small fraction
seed = 42
```

```python
from pathlib import Path
ROOT = Path.cwd().resolve()
while not (ROOT / "pyproject.toml").exists() and ROOT != ROOT.parent:
    ROOT = ROOT.parent                      # walk up to the repo root
DATA = ROOT / "data" / "processed"
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Rely on cells run out of order | Restart and run all before sharing | Hidden state makes results irreproducible |
| Commit large outputs | Strip outputs or pair with Jupytext | Unreadable diffs, leaked data |
| Hard-code absolute paths | Paths from the repo root | Breaks on every other machine |
| Keep business logic only in cells | Functions in `src/` with tests | Untestable and copy-pasted |
| Schedule a fragile notebook for critical jobs | Promote to a pipeline step | Silent failures and no retries |
| String-replace inside `.ipynb` JSON | Edit the paired script or use `nbformat` | Corrupted notebooks |

## Verification checklist

- [ ] Structure has a purpose, a parameters cell and conclusions.
- [ ] The kernel and environment are pinned.
- [ ] Headless restart-and-run-all passes.
- [ ] Diffs are clean; outputs contain no secrets or personal data.
- [ ] Parameterized runs and CI execution work.
- [ ] Reused logic lives in tested modules.

## Related

- Knowledge: `exploratory-data-analysis`, `python-patterns`, `python-testing`, `ml-experiment-tracking`, `vertex-ai`, `etl-pipelines`, `data-visualization`, `git-workflow`.
- Agents: `data-analyst`, `ml-engineer`, `python-reviewer`.
