---
name: python-fastapi
description: >-
  Builds and reviews modern Python services with FastAPI: project layout, uv
  or pip-tools dependencies, pydantic v2 models and settings, dependencies,
  async pitfalls such as blocking calls, SQLAlchemy 2.0 async sessions with
  Alembic, error handling, structured logging, pytest with httpx AsyncClient,
  strict typing, ruff, and Docker packaging. Use when creating or changing a
  FastAPI or async Python API, or diagnosing a slow or hanging endpoint.
---

# Python Services with FastAPI

Build typed, async-correct FastAPI services where the request boundary is
validated by pydantic, the event loop never blocks, and every change ships with
tests, type checks and lint. One blocking call in an `async def` endpoint
stalls every request on that worker.

## When to use

- Creating a FastAPI service or adding routes, dependencies, models or migrations.
- Endpoints that hang, time out under load, or show high p99 latency.
- Setting up uv or pip-tools, ruff, mypy or pyright, pytest and Docker for a Python API.
- Moving SQLAlchemy code to 2.0-style async sessions, or adding Alembic.

## When not to use

- Django or Flask apps: follow their own conventions (the testing and typing advice still applies).
- Resource and error-contract design: use `api-design`. Schema and index design: use `database-design`.
- Sign-in and permissions: use `auth-patterns`.
- Cloud deployment: use `docker-containers`, `cloud-devops` or `kubernetes-gke`.
- A second opinion on a diff: delegate to the `python-reviewer` agent.

## Workflow

1. **Read the project's toolchain before adding to it.** Look at `pyproject.toml`, the lock file (`uv.lock`, `requirements*.txt`, `poetry.lock`), `.python-version`, and the existing package layout. Use whatever the project already uses.

   ```bash
   uv --version && uv sync            # uv projects
   uv run python --version
   # pip-tools projects:
   python -m venv .venv               # then activate: source .venv/bin/activate  |  .venv\Scripts\Activate.ps1
   pip install pip-tools && pip-sync requirements.txt requirements-dev.txt
   ```

   On Linux, call the interpreter as `python3` when no venv is active.

   **Check:** `uv run pytest -q` (or `pytest -q` in the venv) runs, even if some tests fail.

2. **Add dependencies through the lock.** With uv: `uv add "fastapi[standard]" "sqlalchemy[asyncio]" asyncpg pydantic-settings structlog` and `uv add --dev pytest pytest-asyncio httpx ruff mypy`. With pip-tools: edit `pyproject.toml` or `requirements.in`, then `pip-compile -o requirements.txt pyproject.toml` (add `--extra dev` for a dev file). Commit the lock file.

   **Check:** `uv lock --check` (or a clean `pip-compile` producing no diff) succeeds in CI.

3. **Define the boundary with pydantic v2.** Separate input models (`ProjectCreate`) from output models (`ProjectRead`) so internal fields never leak. Use `ConfigDict(extra="forbid")` on inputs and `from_attributes=True` on outputs built from ORM objects. Load configuration through `pydantic-settings` with `SecretStr` for secrets.

   **Check:** Posting an unknown field or a wrong type returns 422, and responses contain only fields declared on the output model.

4. **Write the route, its dependencies and a service function.** Keep handlers thin: parse, call a service, map the result. Inject the DB session, settings and current user with `Annotated[..., Depends(...)]`. Decide `async def` versus `def` per the async table below.

   **Check:** No `requests`, `time.sleep`, sync DB driver or heavy CPU work inside `async def` code (`ruff check --select ASYNC` helps).

5. **Persist with SQLAlchemy 2.0 async and Alembic.** One `AsyncSession` per request, `expire_on_commit=False`, and eager loading (`selectinload`) instead of lazy loads. Generate a migration, read it, then apply it locally. Running migrations against a shared or production database requires explicit user confirmation. Details: [SQLAlchemy and Alembic](references/sqlalchemy-alembic.md).

   ```bash
   uv run alembic revision --autogenerate -m "add projects"
   uv run alembic upgrade head
   ```

   **Check:** The generated migration matches the model change (renames show up as drop plus add; fix them by hand), and `alembic downgrade -1` followed by `upgrade head` works locally.

6. **Handle errors and log in a structured way.** Raise domain exceptions in services and map them to HTTP in one exception handler. Log JSON to stdout with a request id, and never log tokens, passwords or full request bodies.

   **Check:** A forced domain error returns the documented status and body, and the log line has the request id and no secrets.

7. **Run the gates.** Setup details: [testing and Docker](references/testing-and-docker.md).

   ```bash
   uv run ruff format --check . && uv run ruff check .
   uv run mypy src                    # or: uv run pyright
   uv run pytest -q
   ```

   **Check:** All three pass. New behaviour has a test that failed before the change.

## Patterns

### Layout

```text
pyproject.toml   uv.lock   alembic.ini   Dockerfile
migrations/                 # alembic env.py and versions/
src/app/
  main.py                   # create_app(), lifespan, routers, exception handlers
  core/config.py            # Settings (pydantic-settings), get_settings()
  core/logging.py
  db/session.py             # engine, async_sessionmaker, get_session()
  models/                   # SQLAlchemy ORM models
  schemas/                  # pydantic request/response models
  services/                 # business logic, no FastAPI imports
  api/routes/projects.py    # APIRouter per resource
tests/
  conftest.py               # app, client, db fixtures
```

### Settings, session and a route

```python
# core/config.py
from functools import lru_cache
from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APP_", env_file=".env")
    database_url: str
    jwt_secret: SecretStr

@lru_cache
def get_settings() -> Settings:
    return Settings()
```

```python
# api/routes/projects.py
from typing import Annotated
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.project import ProjectCreate, ProjectRead
from app.services import projects as svc
from app.api.deps import CurrentUser

router = APIRouter(prefix="/projects", tags=["projects"])
Session = Annotated[AsyncSession, Depends(get_session)]

@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(body: ProjectCreate, session: Session, user: CurrentUser) -> ProjectRead:
    project = await svc.create_project(session, owner_id=user.id, data=body)
    return ProjectRead.model_validate(project)
```

```python
# main.py (excerpt): one exception handler for domain errors
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.services.errors import NotFoundError

def register_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundError)
    async def not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"type": "not_found", "detail": str(exc)})
```

Create shared clients (database engine, `httpx.AsyncClient`) in the app's
`lifespan` context manager and close them on shutdown; don't create one per request.

### async def or def

| Endpoint does | Declare | Why |
| :--- | :--- | :--- |
| Awaits async libraries only (asyncpg, httpx, aioboto-style clients) | `async def` | Runs on the event loop with no thread hop |
| Calls blocking libraries (sync SDKs, `requests`, sync ORM) | `def` | FastAPI runs it in a threadpool |
| Mostly async with one blocking call | `async def` plus `await asyncio.to_thread(fn, ...)` (or Starlette's `run_in_threadpool`) | Keeps the loop free |
| CPU-heavy work (image processing, large parsing) | Offload to a process pool or a task queue | Threads don't help CPU-bound Python code under the GIL |

Run with `PYTHONASYNCIODEBUG=1` locally: asyncio debug mode logs callbacks
that block the loop for more than 100 ms.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Call `requests` or `time.sleep` in `async def` | `httpx.AsyncClient`, `asyncio.sleep`, or a `def` endpoint | Blocks every request on the worker |
| Return ORM objects with lazy relationships | Load eagerly with `selectinload`, return pydantic models | Lazy loads in async code raise `MissingGreenlet` |
| Share one `AsyncSession` across concurrent tasks | One session per request or task | Sessions aren't safe for concurrent use |
| Reuse the input model as the response model | Separate `Create`, `Update` and `Read` models | Leaks internal fields and enables mass assignment |
| Read `os.environ` all over the code | One `Settings` object injected with `Depends` | Untyped config and untestable overrides |
| Use `BackgroundTasks` for important work | A durable queue (Cloud Tasks, Celery, RQ, arq) | Background tasks die with the process |
| Apply autogenerated migrations unread | Review and edit every migration | Autogenerate misses renames and some constraints |

## Verification checklist

- [ ] Dependencies were added through the project's lock file, and the lock is committed.
- [ ] Input and output models are separate; unknown fields are rejected.
- [ ] No blocking calls run inside `async def` paths.
- [ ] Each migration was reviewed and tested with downgrade and upgrade locally.
- [ ] Domain errors map to documented HTTP responses; logs are structured and free of secrets.
- [ ] `ruff format --check`, `ruff check`, `mypy` (or `pyright`) and `pytest` pass.

## Related

- Workflows: `/tdd`, `/feature-dev`, `/verify`, `/build-fix`, `/code-review`.
- Knowledge: `api-design`, `database-design`, `auth-patterns`, `backend-patterns`, `docker-containers`, `observability-otel`, `tdd-testing`.
- Agents: `python-reviewer`, `database-architect`, `test-engineer`, `security-guard`.
