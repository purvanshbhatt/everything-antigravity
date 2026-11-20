# Tokio and axum patterns

Examples target axum 0.8 and tokio 1.x. axum 0.8 changed path parameters
from `/:id` to `/{id}`; check `Cargo.toml` and the docs for the versions in use.

## A minimal axum service with graceful shutdown

```rust
use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};

#[derive(Clone)]
struct AppState {
    store: Arc<Store>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().json().init();
    let state = AppState { store: Arc::new(Store::connect().await?) };

    let app = Router::new()
        .route("/users/{id}", get(get_user))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<u64>,
) -> Result<Json<User>, AppError> {
    Ok(Json(state.store.get_user(id).await?))
}

enum AppError {
    NotFound,
    Internal(anyhow::Error),
}

impl From<StoreError> for AppError {
    fn from(err: StoreError) -> Self {
        match err {
            StoreError::NotFound(_) => AppError::NotFound,
            other => AppError::Internal(other.into()),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        match self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "not found").into_response(),
            AppError::Internal(err) => {
                tracing::error!(error = ?err, "request failed");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
            }
        }
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c().await.expect("install Ctrl+C handler");
    };
    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
```

Extractor order matters: the body-consuming extractor (`Json`, `Form`,
`Bytes`) must be the last handler argument. Add tower-http layers for tracing,
timeouts, compression and CORS, and check their constructor names in the
version you use. Limit request body size (axum's `DefaultBodyLimit`).

## Owning spawned tasks

```rust
use tokio::task::JoinSet;

let mut set = JoinSet::new();
for url in urls {
    let client = client.clone();                 // cheap: reqwest::Client is an Arc inside
    set.spawn(async move { fetch(&client, &url).await });
}
while let Some(joined) = set.join_next().await {
    match joined {
        Ok(Ok(body)) => handle(body),
        Ok(Err(err)) => tracing::warn!(error = ?err, "fetch failed"),
        Err(join_err) => tracing::error!(error = ?join_err, "task panicked or was cancelled"),
    }
}
```

Bound concurrency with `tokio::sync::Semaphore` (acquire a permit before
spawning) or `futures::stream::iter(..).buffer_unordered(n)`. Dropping a
`JoinSet` aborts its remaining tasks.

## Cancellation with a token

```rust
use std::time::Duration;
use tokio_util::sync::CancellationToken;

let shutdown = CancellationToken::new();
let worker_token = shutdown.child_token();

let worker = tokio::spawn(async move {
    loop {
        tokio::select! {
            _ = worker_token.cancelled() => break,
            msg = rx.recv() => match msg {
                Some(job) => process(job).await,   // runs to completion once started
                None => break,                     // all senders dropped
            },
        }
    }
});

// on shutdown
shutdown.cancel();
if tokio::time::timeout(Duration::from_secs(10), worker).await.is_err() {
    tracing::warn!("worker did not stop within 10s");
}
```

`tokio_util::task::TaskTracker` complements the token: track every spawned
task, then `close()` and `wait()` on shutdown.

## Cancel safety in `select!`

When one `select!` branch wins, the other futures are dropped. A future is
cancel-safe if dropping it loses no data.

| Future | Cancel-safe? |
| :--- | :--- |
| `mpsc::Receiver::recv`, `broadcast::Receiver::recv` | Yes |
| `tokio::time::sleep`, `CancellationToken::cancelled` | Yes |
| `AsyncReadExt::read` | Yes |
| `AsyncReadExt::read_exact`, `read_to_end`, `AsyncWriteExt::write_all` | No: partial progress is lost |

For non-cancel-safe operations, run them outside `select!`, or pin one
long-lived future and poll it by `&mut` across loop iterations. The tokio docs
state cancel safety for each method; check before relying on it.

## Blocking and CPU work

```rust
let digest = tokio::task::spawn_blocking(move || hash_file(&path)).await??;
```

- Use `spawn_blocking` for blocking I/O and short CPU bursts. For sustained CPU parallelism, use rayon and send the result back through a `tokio::sync::oneshot` channel.
- A `std::sync::Mutex` is fine for short critical sections that never contain `.await`. Use `tokio::sync::Mutex` only when the guard must live across an await.
- Wrap every external call in `tokio::time::timeout`.

## Testing async code

```rust
use axum::{body::Body, http::{Request, StatusCode}};
use tower::ServiceExt; // for `oneshot`

#[tokio::test]
async fn unknown_user_is_404() {
    let app = build_router(test_state());
    let res = app
        .oneshot(Request::builder().uri("/users/999").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
}
```

- `#[tokio::test(start_paused = true)]` with `tokio::time::advance` tests timeouts and retries without real waiting (needs tokio's `test-util` feature).
- Property tests:

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn encode_decode_roundtrip(s in "\\PC*") {
        prop_assert_eq!(decode(&encode(&s)).unwrap(), s);
    }
}
```
