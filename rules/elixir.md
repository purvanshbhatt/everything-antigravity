---
trigger: glob
globs: "**/*.ex, **/*.exs, **/*.heex"
description: Elixir, Phoenix and LiveView conventions
---

# Elixir

## Environment and tooling

- Use the Elixir and Erlang/OTP versions in `.tool-versions` or `mix.exs`. Commit `mix.lock`, and say so when you add a dependency.
- Format with `mix format` (respect `.formatter.exs`). Lint with Credo (`mix credo --strict`) and type-check with Dialyzer (`mix dialyzer`) when configured.
- Before finishing, run `mix compile --warnings-as-errors` and `mix test`. Do not leave compiler warnings.

## Style

- Use pattern matching in function heads and `case` instead of nested conditionals. Use `with` for happy-path pipelines that can fail, with an `else` that handles each error shape.
- Return tagged tuples (`{:ok, value}` / `{:error, reason}`) from functions that can fail. Bang variants (`fetch!`) raise and are for callers that cannot recover.
- Pipe (`|>`) a value through transformations; start pipes with a plain value, not a function call, and keep each step one function.
- Add `@spec` to public functions and `@doc` or `@moduledoc` to public modules. Use `@moduledoc false` for internal modules.
- Keep modules focused. Contexts expose the public API of a domain; other modules never reach into a context's schemas or `Repo` calls directly.
- Never create atoms from user input (`String.to_atom/1`); use `String.to_existing_atom/1` or explicit mappings.

## OTP

- Put long-lived processes under a supervisor with a deliberate restart strategy. Never spawn unlinked, unsupervised processes for work that matters; use `Task.Supervisor`.
- Keep `GenServer` callbacks fast. Do not run slow I/O inside `handle_call`; offload to tasks or use `handle_continue`.
- Do not use a `GenServer` as a code organisation tool or a global bottleneck; use plain modules unless you need state, concurrency or serialised access.
- Set timeouts on `GenServer.call` and external requests, and handle `:DOWN` and `:EXIT` messages you subscribe to.
- Let it crash for unexpected errors; handle expected errors explicitly.

## Ecto

- Validate and cast all external input through changesets; keep `cast` allowlists explicit and never cast ownership or role fields from user params.
- Use `Ecto.Query` with pinned values (`^value`). Never interpolate input into `fragment/1` or raw SQL.
- Preload associations explicitly to avoid N+1 queries. Use `Repo.transaction` or `Ecto.Multi` for multi-step writes.
- Write migrations safe for running code: `create index(..., concurrently: true)` with `@disable_ddl_transaction true` and `@disable_migration_lock true` on large Postgres tables, expand and contract for renames.

## Phoenix and LiveView

- Keep controllers and LiveViews thin; call context functions.
- Authorize in `mount/3` and in every `handle_event/3` that reads or changes data, not only in the router.
- Assign only what templates need. Use streams for large or growing collections.
- Never render user data with `raw/1` or `Phoenix.HTML.raw`. HEEx escapes by default; keep it that way.
- Keep secrets in runtime configuration (`config/runtime.exs` reading environment variables), never in compiled config.

## Tests

- Use ExUnit with `async: true` where the test does not share global state, and the Ecto SQL sandbox for database tests.
- Test contexts directly and LiveViews with `Phoenix.LiveViewTest`. Use Mox for behaviours at external boundaries.
- Run the narrowest test first (`mix test path/to_test.exs:42`), then the suite.
