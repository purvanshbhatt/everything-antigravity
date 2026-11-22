---
trigger: glob
globs: "**/*.ipynb"
description: Jupyter notebook conventions
---

# Notebooks

## Editing notebooks

- Edit notebooks with notebook-aware tools or `jupytext`, never by hand-editing the JSON in ways that break its structure. Keep cell ids and metadata valid.
- After editing, confirm the notebook still parses (`jupyter nbconvert --to notebook --stdout <file> > /dev/null` or `python -c "import nbformat; nbformat.validate(nbformat.read(open('<file>', encoding='utf-8'), as_version=4))"`).
- Respect the project's kernel and environment (`.venv`, conda env, `uv`). Install packages into the environment, never with `!pip install` inside committed cells; list them in `requirements.txt` or `pyproject.toml`.

## Structure

- Start with a title and a short Markdown cell: purpose, inputs, outputs, how to run, and the last date it was run end to end.
- Put imports and configuration (paths, parameters, seeds) in the first code cells. Tag the parameters cell `parameters` for papermill.
- One idea per cell. Use Markdown headings so the outline reads as a report.
- Move reusable functions into a module (`src/` or a package) and import them; notebooks orchestrate and explain, they are not libraries.

## Reproducibility

- The notebook must run top to bottom on a fresh kernel ("Restart and Run All") without errors. Never rely on hidden state or out-of-order execution.
- Set random seeds and record package versions for results that matter.
- Read data from documented, relative or configurable paths, never from someone's home directory. Do not download large data in a cell without caching it.
- Avoid in-place mutation of loaded data across cells; create new variables for transformed data.

## Outputs and size

- Clear outputs before committing unless the project deliberately commits rendered results (for example docs or reports). Use `nbstripout` or `jupyter nbconvert --clear-output --inplace` where configured.
- Never commit outputs containing secrets, tokens, personal data or full raw datasets. Display aggregates or samples with `head()`.
- Keep notebooks small: save large plots and tables to files and link them instead of embedding megabytes of output.

## Secrets and safety

- Never hardcode API keys, passwords or connection strings in cells. Read them from environment variables or a secret manager; commit only `.env.example`.
- Treat cells that write to databases, cloud storage or production APIs as dangerous: guard them behind an explicit flag and say so in Markdown above the cell.
- Do not run shell commands (`!`, `%%bash`) with interpolated user input.

## Quality

- Lint notebook code with the project's linter (`nbqa ruff`, `nbqa mypy`) when configured.
- Label every chart: title stating the finding, axis labels with units, and a source note.
- When a notebook becomes a recurring job, convert it to a script or pipeline step (papermill, `nbconvert --to script`, or a proper module) with tests.
