---
trigger: glob
globs: "**/*.py, **/*.pyi"
description: Python conventions
---

# Python

## Environment and tooling

- Run Python through the project environment: `uv run ...`, `.venv/bin/python` (Windows: `.venv\Scripts\python.exe`), or `python3` on Linux/macOS. Never install into the system interpreter.
- Dependencies live in `pyproject.toml` with a committed lockfile (`uv.lock`, `poetry.lock`) or pinned `requirements.txt`. Do not add a dependency without saying so.
- Lint and format with ruff (`ruff check --fix`, `ruff format`) unless the project uses another tool. Type-check with the configured checker (`mypy` or `pyright`).
- Respect `requires-python`; do not use syntax newer than it allows.

## Types

- Annotate every public function, method and module-level constant. Use PEP 585 builtins (`list[str]`, `dict[str, int]`) and PEP 604 unions (`str | None`).
- Use `Protocol`, `TypedDict`, `dataclass(frozen=True)` or pydantic models instead of loose dicts. `Any` is allowed only at untyped third-party boundaries.
- No `# type: ignore` without an error code and reason: `# type: ignore[attr-defined]  # lib has no stubs`.

## Boundaries

- Validate external data with pydantic v2 (`Model.model_validate`, `model_validate_json`): HTTP payloads, config, files, queue messages and LLM output. Load settings with `pydantic-settings` or one typed config object; do not read `os.environ` throughout the code.
- Use `pathlib.Path`, not `os.path` string joins. Open text files with `encoding="utf-8"`.
- Use timezone-aware datetimes (`datetime.now(tz=UTC)`). Store and compare in UTC.
- Use `Decimal` for money, never `float`.

## Errors and logging

- Catch specific exceptions. Never write a bare `except:` or `except Exception: pass`.
- Re-raise with context: `raise ConfigError("bad port") from err`. Define a small exception hierarchy per package.
- Use `logging.getLogger(__name__)` with lazy formatting (`logger.info("loaded %d rows", n)`) and `logger.exception(...)` inside `except`. No `print` in library or service code; CLIs write results to stdout and diagnostics to stderr.
- Never log secrets, tokens or full request bodies containing personal data.

## Style

- Follow PEP 8 and PEP 257: docstrings on public modules, classes and functions.
- No mutable default arguments (`def f(items: list[str] | None = None)`).
- Prefer comprehensions and generators to manual accumulation, and early returns to deep nesting.
- Keep functions small and side effects explicit; no work at import time beyond definitions.

## Async and processes

- Never block the event loop: no `time.sleep`, sync HTTP or heavy CPU in `async def`. Use `asyncio.TaskGroup` (3.11+) or `gather` with bounded concurrency, and set timeouts.
- `subprocess.run([...], check=True)` with an argument list. No `shell=True` with interpolated input. No `eval`, `exec`, `pickle.loads` or `yaml.load` on untrusted data (use `yaml.safe_load`).

## Tests

- pytest with plain `assert`, fixtures, `@pytest.mark.parametrize`, `tmp_path` and `monkeypatch`. Follow existing `unittest` style only where the project already uses it.
- Run the narrowest test first (`pytest path/test_x.py::test_name -x`), then the suite.
