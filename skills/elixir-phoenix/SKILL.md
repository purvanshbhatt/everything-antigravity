---
name: elixir-phoenix
disable-model-invocation: true
description: >-
  Builds and reviews Elixir and Phoenix systems: OTP supervision trees,
  GenServer design and bottlenecks, Registry and DynamicSupervisor, Phoenix
  contexts, LiveView lifecycle, streams and PubSub, Ecto changesets, preloads
  and Multi, ExUnit with the SQL sandbox and Mox, credo, dialyzer and sobelow
  gates, and mix releases with runtime config. Use when writing or debugging
  Elixir, Phoenix or LiveView code, or shipping an Elixir release.
---

# Elixir and Phoenix

Design around processes and failure: put state in supervised processes only
when it needs a lifecycle, let crashes restart from known-good state, keep
business logic in plain functions inside contexts, and let LiveView render
from assigns and streams instead of ad hoc client code.

## When to use

- Adding contexts, schemas, LiveViews, channels or background processes to a Phoenix app.
- Designing a supervision tree, or a GenServer that has become a bottleneck.
- LiveView problems: double mounts, memory growth with large lists, missed PubSub updates.
- Ecto issues: changeset validation, N+1 preloads, multi-step transactions.
- Building releases, running migrations in production, clustering on Kubernetes.

## When not to use

- Generic API contract design: use `api-design`.
- Broker-based messaging (Pub/Sub, Kafka) rather than BEAM messaging: use `message-queues`.
- Kubernetes and GKE manifests: use `kubernetes-gke`; containers: use `docker-containers`.
- Realtime architecture across stacks: use `realtime-websockets`.

## Workflow

1. **Read the project's versions and gates.**

   ```bash
   elixir --version
   mix deps | grep -E "^\* (phoenix|phoenix_live_view|ecto_sql) "   # PowerShell: mix deps | Select-String "phoenix|ecto_sql"
   grep -nE ":(phoenix|phoenix_live_view|ecto_sql|credo|dialyxir|sobelow|mox|mix_audit)," mix.exs
   ```

   **Check:** You know the Elixir/OTP, Phoenix and LiveView versions and which static-analysis tools are installed. Generators and APIs change between Phoenix and LiveView versions; check the docs for the installed versions.

2. **Put logic in contexts, not in web modules.** Generate with `mix phx.gen.context` or `mix phx.gen.live`, then keep controllers and LiveViews thin: they call context functions and render results. Contexts return `{:ok, value}` or `{:error, changeset_or_reason}`.

   **Check:** No `Repo` calls appear in `lib/my_app_web/`.

3. **Decide whether you need a process at all.** Use a process only for state with a lifecycle, serialized access to a resource, or concurrency. Read-heavy shared data belongs in ETS or `:persistent_term`; per-entity processes go under a `DynamicSupervisor` with a `Registry`.

   **Check:** Every long-lived process is started under a supervisor with a deliberate restart strategy.

4. **Write changesets and migrations together.** Validate in changesets (`cast`, `validate_required`, `validate_length`) and enforce in the database (`null: false`, unique indexes, foreign keys), mapping constraint errors with `unique_constraint/2` and `foreign_key_constraint/2`.

   ```bash
   mix ecto.gen.migration add_slug_to_posts
   mix ecto.migrate
   mix ecto.rollback && mix ecto.migrate      # prove reversibility locally
   ```

   `mix ecto.reset` and `mix ecto.drop` destroy data: local only, and ask the user before migrating shared or production databases. **Check:** Duplicate inserts return an `{:error, changeset}` with a field error, not an exception.

5. **Respect the LiveView lifecycle.** `mount/3` runs twice (static render, then connected); subscribe to PubSub and start timers only `if connected?(socket)`. Use streams for large or growing collections, and `assign_async/3` for slow loads.

   **Check:** LiveView process memory stays flat while a list grows, and a second browser tab receives broadcast updates.

6. **Test concurrently with the sandbox and behaviours.** Use `async: true` with `Ecto.Adapters.SQL.Sandbox`, Mox for external services defined behind behaviours, and `Phoenix.LiveViewTest` for interactions.

   ```bash
   mix test
   mix format --check-formatted
   mix compile --warnings-as-errors
   mix credo --strict
   mix sobelow                   # if sobelow is installed (Phoenix security checks)
   mix dialyzer                  # if dialyxir is installed; first run builds PLTs slowly
   mix deps.audit && mix hex.audit
   ```

   **Check:** All gates pass, and the new LiveView has a test that clicks or submits and asserts on rendered output.

7. **Ship a release.** `mix phx.gen.release --docker` adds a release module, migrate and server scripts, and a Dockerfile. Configure secrets in `config/runtime.exs` from environment variables, never in compiled config.

   ```bash
   MIX_ENV=prod mix release
   _build/prod/rel/my_app/bin/migrate       # confirm with the user before production
   PHX_SERVER=true _build/prod/rel/my_app/bin/my_app start
   ```

   PowerShell: set `$env:MIX_ENV = "prod"` and `$env:PHX_SERVER = "true"` first; release scripts on Windows are `.bat` files. **Check:** The release boots with only runtime environment variables, and migrations run as a separate, confirmed step.

## Patterns

### Supervision tree and a GenServer that stays responsive

```elixir
# application.ex
children = [
  MyApp.Repo,
  {Phoenix.PubSub, name: MyApp.PubSub},
  {Registry, keys: :unique, name: MyApp.RoomRegistry},
  {DynamicSupervisor, name: MyApp.RoomSupervisor, strategy: :one_for_one},
  {Task.Supervisor, name: MyApp.TaskSupervisor},
  MyAppWeb.Endpoint
]
Supervisor.start_link(children, strategy: :one_for_one, name: MyApp.Supervisor)

# room.ex
defmodule MyApp.Room do
  use GenServer, restart: :transient

  def start_link(id), do: GenServer.start_link(__MODULE__, id, name: via(id))
  def via(id), do: {:via, Registry, {MyApp.RoomRegistry, id}}

  @impl true
  def init(id), do: {:ok, %{id: id, members: MapSet.new()}, {:continue, :load}}

  @impl true
  def handle_continue(:load, state), do: {:noreply, Map.put(state, :history, MyApp.Chat.recent(state.id))}

  @impl true
  def handle_call({:join, user_id}, _from, state) do
    {:reply, :ok, update_in(state.members, &MapSet.put(&1, user_id))}
  end
end
```

Slow work in `init/1` blocks the supervisor; move it to `handle_continue/2`.
Slow work in `handle_call/3` blocks every caller (the default call timeout is
5 seconds); offload it with `Task.Supervisor.async_nolink/2` and reply later.

### Restart strategies

| Strategy | Use when |
| :--- | :--- |
| `:one_for_one` | Children are independent (most cases) |
| `:rest_for_one` | Later children depend on earlier ones (a cache that depends on a connection) |
| `:one_for_all` | Children share state that is invalid if any one dies |

### LiveView with streams and PubSub

```elixir
def mount(_params, _session, socket) do
  if connected?(socket), do: Phoenix.PubSub.subscribe(MyApp.PubSub, "posts")
  {:ok, stream(socket, :posts, Blog.list_recent_posts(limit: 50))}
end

def handle_info({:post_created, post}, socket) do
  {:noreply, stream_insert(socket, :posts, post, at: 0)}
end

def handle_event("save", %{"post" => params}, socket) do
  case Blog.create_post(params) do
    {:ok, _post} -> {:noreply, put_flash(socket, :info, "Posted")}
    {:error, changeset} -> {:noreply, assign(socket, form: to_form(changeset))}
  end
end
```

### Multi-step writes

Use `Ecto.Multi` piped into `Repo.transaction/1` (or the transaction helper in
your Ecto version) so related inserts and updates commit or roll back together;
broadcast PubSub events only after the transaction succeeds.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| One global GenServer for all reads | ETS or `:persistent_term` for read-heavy data | A single mailbox serializes the whole app |
| Defensive `try/rescue` everywhere | Let it crash under a supervisor; match on `{:ok, _}`/`{:error, _}` | Restarts restore known-good state |
| Large lists in plain assigns | Streams | Assigns are kept in server memory per connected user |
| Subscribe in `mount` without `connected?` | Guard with `connected?(socket)` | Subscriptions from the static render leak or duplicate |
| `Repo` calls in LiveViews and controllers | Context functions | Business rules scattered across the web layer |
| Secrets in `config/prod.exs` | `config/runtime.exs` reading environment variables | Compiled config bakes secrets into the release |
| Preload inside a per-row function | Preload once in the query | N+1 queries |

## Verification checklist

- [ ] Business logic lives in contexts; web modules only call contexts.
- [ ] Every process is supervised with a deliberate restart strategy and does no slow work in `init`.
- [ ] Changesets and database constraints agree; constraint errors surface as changeset errors.
- [ ] LiveViews subscribe only when connected and use streams for large collections.
- [ ] Format, compile with warnings as errors, credo, tests and available security/type gates pass.
- [ ] Release reads secrets at runtime; production migrations were confirmed by the user.

## Related

- Workflows: `/feature-dev`, `/tdd`, `/verify`, `/code-review`.
- Knowledge: `realtime-websockets`, `postgres-patterns`, `database-migrations`, `docker-containers`, `kubernetes-gke`, `observability-otel`.
- Agents: `backend-engineer`, `code-reviewer`, `database-architect`.
