# Testing, tooling and Docker for FastAPI

## pyproject.toml tool settings

```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
asyncio_default_fixture_loop_scope = "function"
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP", "ASYNC", "S", "SIM", "RUF"]

[tool.ruff.lint.per-file-ignores]
"tests/**" = ["S101"]          # allow assert in tests

[tool.mypy]
strict = true
plugins = ["pydantic.mypy"]
```

Match `target-version` to the project's Python version. For pyright, set
`typeCheckingMode = "strict"` under `[tool.pyright]`. Check the pytest-asyncio
docs for your version: option names and fixture loop scopes changed across
releases.

## Async client fixture

```python
# tests/conftest.py
from collections.abc import AsyncIterator
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app
from app.db.session import get_session

@pytest.fixture
async def client(db_session) -> AsyncIterator[AsyncClient]:
    app = create_app()
    app.dependency_overrides[get_session] = lambda: db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
```

`ASGITransport` does not run lifespan events. If the app creates resources in
`lifespan`, wrap the app with `asgi-lifespan`'s `LifespanManager`, or use
FastAPI's `TestClient` as a context manager for synchronous tests.

## Endpoint tests

```python
async def test_create_project_rejects_unknown_fields(client, auth_headers):
    res = await client.post("/projects", json={"name": "x", "is_admin": True}, headers=auth_headers)
    assert res.status_code == 422

async def test_cannot_read_another_users_project(client, other_user_project, auth_headers):
    res = await client.get(f"/projects/{other_user_project.id}", headers=auth_headers)
    assert res.status_code == 404
```

Cover, for each endpoint: the happy path, invalid input (422), missing or bad
authentication (401), another user's or tenant's resource (403/404), and the
domain error paths.

Override the current-user dependency in tests instead of minting real tokens,
and add one integration test that exercises real token verification.

## Running

```bash
uv run pytest -q
uv run pytest -q -k projects -x          # one area, stop on first failure
uv run pytest --cov=app --cov-report=term-missing   # needs pytest-cov
```

## Dockerfile (uv, multi-stage, non-root)

```dockerfile
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:<pinned-version> /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-dev
COPY . .
RUN --mount=type=cache,target=/root/.cache/uv uv sync --locked --no-dev

FROM python:3.12-slim
RUN useradd --create-home --uid 10001 app
WORKDIR /app
COPY --from=build --chown=app:app /app /app
ENV PATH="/app/.venv/bin:$PATH"
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
```

- Replace `<pinned-version>` with a specific uv release; the uv Docker guide lists the image tags.
- Match the Python base image to `.python-version`.
- This assumes the project is installed into `.venv` so `app` is importable; adjust the module path for your layout.
- In containers, run one worker process per container and scale replicas; if you use several workers, size DB pools for the total.
- Add `.dockerignore` entries for `.venv`, `.git`, `__pycache__`, `.env` and test artifacts so secrets and caches never enter the image.

## pip-tools alternative

```bash
pip-compile --generate-hashes -o requirements.txt pyproject.toml
pip-compile --generate-hashes --extra dev -o requirements-dev.txt pyproject.toml
pip-sync requirements.txt requirements-dev.txt
```

In Docker, install with `pip install --no-cache-dir --require-hashes -r requirements.txt`.
