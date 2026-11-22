---
name: python-packaging
description: >-
  Packages and publishes Python projects: pyproject.toml metadata, build
  backends, src layout, entry points, dependency management and lockfiles with
  uv, pip-tools or Poetry, version ranges for libraries versus pins for apps,
  dynamic versions, wheels and sdists, compiled wheels, Trusted Publishing to
  PyPI, and workspaces. Use when creating a package, choosing a dependency
  tool, fixing install or import errors, or releasing to PyPI.
---

# Python Packaging

One `pyproject.toml` describes the project; a lockfile pins what an
application runs; a wheel is what users install. Libraries declare ranges,
applications lock exact versions, and nothing is published without a
clean-venv install test and the user's go-ahead.

## When to use

- Starting a new package, CLI or service, or converting `setup.py`/`setup.cfg`.
- Choosing between uv, pip-tools and Poetry, or adding a lockfile.
- `ModuleNotFoundError` after install, missing files in the wheel, or tests importing the source tree instead of the installed package.
- Releasing to PyPI or a private index (Artifact Registry), or splitting a repo into several packages.

## When not to use

- Writing the code itself: use `python-patterns`. Tests: use `python-testing`.
- Supply-chain controls (SBOM, signing, provenance): use `supply-chain-security`.
- Upgrading many dependencies at once: use `/dependency-upgrades`.
- Release orchestration across artifacts: use `/release-management`.

## Workflow

1. **Inventory what exists.** Look for `pyproject.toml`, `setup.py`, `setup.cfg`, `requirements*.txt`, `uv.lock`, `poetry.lock`, and `.python-version`. Decide: is this a **library** (others import it) or an **application** (deployed as-is)?

   **Check:** You can name the build backend, the dependency tool and the project type.

2. **Write PEP 621 metadata with a src layout.** Code in `src/<import_name>/`, tests outside it. Pick a backend: hatchling is a safe default; setuptools for legacy or C extensions; maturin for Rust (PyO3); scikit-build-core for CMake. Add `py.typed` if the package ships type hints.

   **Check:** `python -m build` (or `uv build`) produces one `.whl` and one `.tar.gz` in `dist/`.

3. **Declare dependencies by project type.** Libraries: lower bounds and an upper bound only for known breakage (`httpx>=0.27,<1`). Applications: a lockfile committed to the repo. Dev tools go in `[dependency-groups]` (PEP 735) or the tool's dev group, not in runtime `dependencies`.

   **Check:** `uv lock --check` (or `poetry check --lock`, or a clean `pip-compile` diff) passes in CI.

4. **Version from one source.** Either a static `version` bumped by the release process, or `dynamic = ["version"]` from git tags (hatch-vcs, setuptools-scm). Follow PEP 440 (`1.4.0`, `1.5.0rc1`).

   **Check:** The built wheel name and `importlib.metadata.version("<dist-name>")` show the expected version.

5. **Test the artifact, not the checkout.** Install the wheel into a fresh virtual environment and run the tests or a smoke command against it.

   ```bash
   python -m venv .venv-wheel
   .venv-wheel/bin/python -m pip install dist/*.whl          # Windows: .venv-wheel\Scripts\python.exe -m pip install (Get-Item dist\*.whl).FullName
   .venv-wheel/bin/python -c "import acme_widgets, sys; print(acme_widgets.__file__)"
   python -m twine check dist/*
   ```

   **Check:** The import path points inside `.venv-wheel`, not `src/`, and `twine check` passes.

6. **Publish only with confirmation.** Prefer PyPI Trusted Publishing from CI (OIDC, no long-lived token). Rehearse on TestPyPI first. Ask the user to confirm the exact version and index before any upload: a PyPI version can never be re-uploaded, only yanked.

   **Check:** The package page shows the new version, and `pip install <name>==<version>` works in a clean venv.

## Patterns

### pyproject.toml (hatchling, src layout)

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "acme-widgets"
version = "0.3.0"
description = "Widget helpers for Acme services"
readme = "README.md"
requires-python = ">=3.10"
license = "MIT"                       # SPDX expression (PEP 639); older backends need the table form
authors = [{ name = "Acme Team" }]
dependencies = ["httpx>=0.27,<1"]

[project.optional-dependencies]
cli = ["typer>=0.12"]

[project.scripts]
acme = "acme_widgets.cli:main"

[project.urls]
Source = "https://github.com/acme/widgets"

[dependency-groups]
dev = ["pytest>=8", "ruff", "mypy"]

[tool.hatch.build.targets.wheel]
packages = ["src/acme_widgets"]
```

### Choosing a dependency tool

| Tool | Strengths | Typical commands |
| :--- | :--- | :--- |
| uv | Fast resolver, universal `uv.lock`, Python installs, workspaces | `uv init --package`, `uv add httpx`, `uv add --dev pytest`, `uv lock`, `uv sync`, `uv run pytest`, `uv build`, `uv publish` |
| pip-tools | Minimal, plain `requirements.txt` with hashes | `pip-compile pyproject.toml -o requirements.txt --generate-hashes`, `pip-sync requirements.txt` |
| Poetry | Mature workflow and plugins; 2.x reads `[project]` | `poetry add`, `poetry lock`, `poetry install`, `poetry build`, `poetry publish` |
| Plain pip | Constrained environments | `pip install -e ".[cli]"`, `pip install -r requirements.txt` |

Pick one per repo and document it in the README. Check current flags with `<tool> --help`; these tools move fast.

### Workspaces (several packages, one lock)

```toml
# root pyproject.toml
[tool.uv.workspace]
members = ["packages/*"]

# packages/api/pyproject.toml
[project]
name = "acme-api"
dependencies = ["acme-core"]

[tool.uv.sources]
acme-core = { workspace = true }
```

`uv sync --all-packages` installs every member; `uv run --package acme-api pytest` scopes a command.

### Trusted Publishing from GitHub Actions

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: pypi                 # protect with required reviewers
    permissions:
      id-token: write                 # OIDC for PyPI Trusted Publishing
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v6   # verify the current major version
      - run: uv build
      - uses: pypa/gh-action-pypi-publish@release/v1
```

Register the repository, workflow file and environment as a trusted publisher in the PyPI project settings first. For compiled extensions, build platform wheels with cibuildwheel (C/C++) or maturin (Rust) in a matrix before this job.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Exact pins (`==`) in a library's dependencies | Ranges; pin in the application's lockfile | Pins in libraries cause unsolvable conflicts for users |
| Flat layout with tests importing `./pkg` | `src/` layout, test the installed package | Hides missing files and packaging bugs |
| `pip install` into the system Python | A virtual environment per project (`uv venv`, `python -m venv`) | Breaks OS tools; irreproducible |
| PyPI API token pasted into CI secrets for years | Trusted Publishing (OIDC) | No long-lived credential to leak |
| Publishing straight from a laptop | Tag, build and publish in CI after review | Reproducible artifacts and an audit trail |
| `setup.py install` or `setup.py sdist` | `python -m build` or `uv build` | Direct `setup.py` invocation is deprecated |

## Verification checklist

- [ ] Metadata lives in `[project]`; build backend declared in `[build-system]`.
- [ ] `src/` layout; wheel contains the package, `py.typed` and data files it needs.
- [ ] Libraries use ranges; applications commit a lockfile checked in CI.
- [ ] Wheel installs and imports in a clean venv; `twine check` passes.
- [ ] Version follows PEP 440 and comes from a single source.
- [ ] Publishing used Trusted Publishing and the user confirmed version and index.

## Related

- Knowledge: `python-patterns`, `python-testing`, `supply-chain-security`, `ci-cd-github-actions`, `dev-environments`, `cli-development`, `monorepo-tooling`.
- Workflows: `/release-management`, `/dependency-upgrades`, `/verify`.
- Agents: `python-reviewer`, `build-error-resolver`.
