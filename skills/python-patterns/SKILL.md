---
name: python-patterns
description: >-
  Writes idiomatic modern Python (3.10+): dataclasses versus pydantic versus
  TypedDict, typing with Protocol and generics, match statements, context
  managers, generators and itertools, pathlib, exception chaining, asyncio
  TaskGroup and timeouts, logging and src layout. Use when writing or
  refactoring Python, adding type hints, choosing a data structure, or
  reviewing Python code for idioms and hidden bugs.
---

# Python Patterns

Write Python that reads like a specification: explicit data shapes, small
functions, resources closed by `with`, and errors raised with context. Lean on
the version you actually run; most "clever" code predates a feature that now
does it better.

## When to use

- New modules, scripts or libraries in Python 3.10+.
- Refactoring dict-heavy code into typed structures.
- Adding type hints and getting `mypy --strict` or pyright clean.
- Writing asyncio code that must cancel and time out correctly.
- Reviewing for mutable defaults, swallowed exceptions and leaked resources.

## When not to use

- Test design and pytest mechanics: use `python-testing`.
- `pyproject.toml`, lockfiles and publishing: use `python-packaging`.
- Web services: use `python-fastapi`. Numeric and array code: use `scientific-computing`.
- A diff review: delegate to the `python-reviewer` agent.

## Workflow

1. **Confirm the floor version.** Read `requires-python` in `pyproject.toml` and run `python --version` (`py -3 --version` on Windows). Feature gates: 3.10 `match` and `X | Y` unions; 3.11 `TaskGroup`, `asyncio.timeout`, `ExceptionGroup`, `Self`, `tomllib`; 3.12 `def f[T](...)` and `type` aliases, `itertools.batched`, `typing.override`; 3.13 `TypeIs`, `warnings.deprecated`.

   **Check:** Every feature you use is available at the lowest supported version.

2. **Pick the right data shape** (table below). Internal values get frozen dataclasses; untrusted input gets validated at the boundary (pydantic or a manual parser), then becomes a plain typed object.

   **Check:** No function signature passes `dict[str, Any]` across module boundaries without a reason.

3. **Type the public surface.** Annotate every public function. Accept abstract types (`Iterable`, `Sequence`, `Mapping`), return concrete ones. Use `Protocol` for structural interfaces instead of inheritance-only base classes.

   **Check:** `mypy --strict <pkg>` or `pyright` reports no errors in changed files.

4. **Manage resources with `with`.** Files, locks, connections, temporary state and timers go through context managers; `contextlib.contextmanager` for small ones, `ExitStack` for dynamic sets.

   **Check:** `grep_search` for `open(` without `with` and for manual `.close()` calls in changed code.

5. **Raise specific errors with context.** Define a small exception hierarchy per package, raise with `raise DomainError(...) from err`, add context with `err.add_note(...)` (3.11+), and never use a bare `except:`.

   **Check:** `ruff check --select BLE,TRY,B` reports nothing new.

6. **Use structured concurrency in asyncio.** Prefer `asyncio.TaskGroup` over bare `create_task`, wrap waits in `asyncio.timeout`, and push blocking calls to `asyncio.to_thread`. Keep references to background tasks or they can be garbage-collected.

   **Check:** Cancelling the parent task cancels all children (test it), and no "Task was destroyed but it is pending" warnings appear.

7. **Run the gates.**

   ```bash
   ruff format --check .
   ruff check .
   mypy --strict src/        # or: pyright
   pytest -q
   ```

   **Check:** All four pass locally and in CI.

## Patterns

### Choosing a data shape

| Shape | Use for | Notes |
| :--- | :--- | :--- |
| `@dataclass(frozen=True, slots=True, kw_only=True)` | Internal value objects | Hashable, cheap, no validation |
| pydantic `BaseModel` | Untrusted input, config, API schemas | Validates and coerces; heavier |
| `TypedDict` | Typing existing dict-shaped JSON | No runtime check |
| `NamedTuple` | Small immutable records that must unpack | Tuple semantics can surprise |
| `enum.StrEnum` (3.11+) | Closed sets of string values | Serialises as its value |

### Value object and Protocol

```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol


@dataclass(frozen=True, slots=True, kw_only=True)
class Line:
    sku: str
    qty: int
    unit_cents: int

    def __post_init__(self) -> None:
        if self.qty <= 0:
            raise ValueError(f"qty must be positive, got {self.qty}")


@dataclass(frozen=True, slots=True, kw_only=True)
class Order:
    id: str
    lines: tuple[Line, ...]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def total_cents(self) -> int:
        return sum(line.qty * line.unit_cents for line in self.lines)


class OrderStore(Protocol):
    def get(self, order_id: str) -> Order | None: ...
    def save(self, order: Order) -> None: ...
```

### Structural matching

```python
def handle(event: dict[str, object]) -> str:
    match event:
        case {"type": "created", "id": str(order_id)}:
            return f"created {order_id}"
        case {"type": "deleted", "id": str(order_id), **rest} if not rest:
            return f"deleted {order_id}"
        case _:
            raise ValueError(f"unrecognised event: {event!r}")
```

### Context manager and async fan-out

```python
import asyncio
import os
from collections.abc import Iterator
from contextlib import contextmanager


@contextmanager
def temp_env(**values: str) -> Iterator[None]:
    saved = {k: os.environ.get(k) for k in values}
    os.environ.update(values)
    try:
        yield
    finally:
        for key, old in saved.items():
            if old is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = old


async def fetch_all(urls: list[str]) -> list[bytes]:
    async with asyncio.timeout(10):               # whole batch deadline
        async with asyncio.TaskGroup() as tg:     # first failure cancels the rest
            tasks = [tg.create_task(fetch(u)) for u in urls]
    return [t.result() for t in tasks]
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `def f(items=[])` | `items: list[str] \| None = None`, then create inside | Default is shared across calls |
| `except Exception: pass` | Catch the specific error; log or re-raise with context | Hides bugs and corrupts state |
| `assert` for input validation | Explicit `if ...: raise ValueError` | Asserts vanish under `python -O` |
| `os.path.join` string juggling | `pathlib.Path` | Clearer and cross-platform |
| `print` in library code | `logging.getLogger(__name__)` with `%s` args | Callers control output and level |
| `from module import *` | Explicit imports | Hides where names come from; breaks linters |
| Work at import time (network, DB) | Explicit `init()` or lazy factories | Slows imports and breaks tests |
| `time.sleep` inside `async def` | `await asyncio.sleep` or `to_thread` | Blocks the whole event loop |

## Verification checklist

- [ ] Features used match the minimum `requires-python`.
- [ ] Public functions are fully annotated; type checker is clean on changed files.
- [ ] Untrusted input is validated once at the boundary.
- [ ] Resources are closed by context managers; no bare `except`.
- [ ] Async code uses `TaskGroup`/`timeout` and does no blocking I/O on the loop.
- [ ] `ruff format`, `ruff check`, the type checker and `pytest` pass.

## Related

- Knowledge: `python-testing`, `python-packaging`, `python-fastapi`, `scientific-computing`, `concurrency-bugs`, `linting-formatting`.
- Workflows: `/code-review`, `/refactor-clean`, `/verify`.
- Agents: `python-reviewer`, `test-engineer`.
