---
name: rails
description: >-
  Builds and reviews Ruby on Rails applications: Active Record models,
  validations and N+1 prevention, safe migrations on live tables, strong
  parameters, Active Job with retries and idempotency, Hotwire (Turbo Frames,
  Turbo Streams, Stimulus), RSpec or Minitest request and system tests,
  Brakeman, and deployment with Kamal or containers. Use when adding features
  to a Rails app, debugging Active Record or jobs, or shipping a Rails release.
---

# Ruby on Rails

Follow Rails conventions for speed, and add the guardrails that keep a growing
app healthy: explicit permitted params, queries without N+1, migrations that
are safe on big tables, idempotent jobs, and request specs at the HTTP layer.

## When to use

- Adding models, migrations, controllers, jobs or Hotwire interactions to a Rails app.
- Slow pages from N+1 queries, callback tangles or missing indexes.
- Jobs that duplicate side effects, fail silently or run before data commits.
- Writing RSpec or Minitest request, model and system tests.
- Deploying with Kamal, containers or Cloud Run.

## When not to use

- Plain Ruby design, gems and RuboCop setup: use `ruby-patterns`.
- Large-scale migration strategy (expand/contract, backfills): use `database-migrations`.
- PostgreSQL-specific tuning: use `postgres-patterns`.
- Rich client-side SPA work: use `react-patterns` or another frontend skill; Hotwire covers server-rendered interactivity.

## Workflow

1. **Read the app's versions and tooling.**

   ```bash
   bin/rails --version && ruby -v
   grep -nE "^\s*gem \"(rspec-rails|sidekiq|solid_queue|turbo-rails|stimulus-rails|strong_migrations|brakeman|kamal)\"" Gemfile
   bin/rails db:migrate:status | tail -n 5
   ```

   PowerShell: replace `tail -n 5` with `Select-Object -Last 5`. **Check:** You know the Rails and Ruby versions, the test framework, the job backend (Solid Queue, Sidekiq, GoodJob) and the database.

2. **Generate, then tighten.** `bin/rails generate model Post title:string user:references` creates a migration with a foreign key and index. Add `null: false`, defaults, unique indexes and database constraints that mirror validations.

   **Check:** Every `validates ... uniqueness: true` has a matching unique index.

3. **Write migrations that are safe on live tables.** Avoid long locks: add indexes concurrently on PostgreSQL, add columns nullable then backfill, and split renames and drops across releases. The `strong_migrations` gem flags unsafe operations at development time.

   ```bash
   bin/rails db:migrate
   bin/rails db:rollback && bin/rails db:migrate     # prove reversibility locally
   ```

   `db:drop`, `db:reset` and `db:schema:load` destroy data: run them only locally, and ask the user before migrating a shared or production database. **Check:** `db/schema.rb` (or `structure.sql`) diff matches the intent, and rollback works.

4. **Permit params explicitly and authorize per record.** Use `params.require(:post).permit(:title, :body)` (Rails 8 also offers `params.expect(post: [:title, :body])`; verify for your version). Scope lookups through the current user (`current_user.posts.find(params[:id])`) or a policy library such as Pundit.

   **Check:** A request spec proves another user's record returns 404 or 403.

5. **Kill N+1 queries.** Use `includes`/`preload`/`eager_load`, `strict_loading` on associations or models in development, and counter caches for counts.

   **Check:** The request log for a list page shows a constant number of queries regardless of page size.

6. **Make jobs idempotent and post-commit.** Enqueue with `perform_later` from `after_commit` (or after the transaction block), pass IDs, check state before side effects, and declare `retry_on`/`discard_on`.

   **Check:** Running `perform_now` twice for the same record produces one side effect.

7. **Test at the HTTP layer, then gate.** Prefer request specs over controller specs, system specs for critical Hotwire flows, and factories with minimal attributes.

   ```bash
   bundle exec rspec                    # or: bin/rails test
   bundle exec rubocop
   bundle exec brakeman --no-pager
   bundle exec bundle-audit check --update   # if bundler-audit is installed
   ```

   **Check:** Tests, RuboCop and Brakeman are clean, or remaining warnings are reviewed and recorded.

8. **Deploy with confirmation.** With Kamal (default in new Rails 8 apps): `kamal deploy`. With containers: build the generated `Dockerfile`, run `bin/rails db:prepare` or migrations as a release step, then shift traffic. Production deploys and migrations need explicit user confirmation.

   **Check:** The health endpoint (`/up` in recent Rails) returns 200 and job workers are processing.

## Patterns

### Controller with strong params and scoping

```ruby
class PostsController < ApplicationController
  before_action :set_post, only: %i[show edit update destroy]

  def update
    if @post.update(post_params)
      redirect_to @post, notice: "Saved"
    else
      render :edit, status: :unprocessable_entity   # 422; newer Rack names it :unprocessable_content
    end
  end

  private

  def set_post
    @post = current_user.posts.find(params[:id])     # 404 for other users' posts
  end

  def post_params
    params.require(:post).permit(:title, :body, :status)
  end
end
```

### Idempotent job

```ruby
class SendReceiptJob < ApplicationJob
  queue_as :mailers
  retry_on Net::OpenTimeout, wait: :polynomially_longer, attempts: 5
  discard_on ActiveRecord::RecordNotFound

  def perform(order_id)
    order = Order.find(order_id)
    return if order.receipt_sent_at.present?          # safe to rerun

    ReceiptMailer.with(order:).receipt.deliver_now
    order.update!(receipt_sent_at: Time.current)
  end
end

# in Order
after_create_commit -> { SendReceiptJob.perform_later(id) }
```

### Hotwire quick reference

| Need | Tool |
| :--- | :--- |
| Faster page navigation | Turbo Drive (on by default) |
| Update one region from a link or form | `turbo_frame_tag` with a matching frame in the response |
| Update several regions after a form submit | Respond with `turbo_stream` actions (`append`, `replace`, `remove`) |
| Push updates to other users | `broadcasts_to` / `Turbo::StreamsChannel` over Action Cable |
| Small client behaviour | Stimulus controller (`data-controller`, `data-action`, `data-*-target`) |

Return 422 on failed form submissions and 303 (`redirect_to ..., status: :see_other`) after non-GET actions that redirect, so Turbo handles them correctly.

### Request spec

```ruby
RSpec.describe "Posts", type: :request do
  let(:owner) { create(:user) }
  let(:post_record) { create(:post, user: owner) }

  it "rejects updates from another user" do
    sign_in create(:user)                 # Devise helper; adapt to your auth
    patch post_path(post_record), params: { post: { title: "x" } }
    expect(response).to have_http_status(:not_found)
  end
end
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `params.permit!` or passing `params` straight to `create` | Explicit permitted keys | Mass assignment of roles, owners or prices |
| `Post.find(params[:id])` in user-owned resources | Scope through the owner or a policy | IDOR: users can read or edit others' data |
| Enqueue jobs in `after_save` | `after_commit` callbacks | Jobs run before the row is visible and fail or act on rolled-back data |
| Business logic spread across model callbacks | Explicit service objects or methods called from controllers | Hidden side effects make changes risky |
| Uniqueness only as a validation | Validation plus a unique index | Concurrent requests bypass validations |
| `default_scope` | Named scopes | Surprising filters in every query, including joins |
| Change and remove a column in one deploy | Expand/contract across releases | Running code still references the old column |

## Verification checklist

- [ ] Every controller permits params explicitly and scopes records to the authorized owner.
- [ ] Validations are backed by database constraints and indexes.
- [ ] Migrations are reversible and safe for table size; destructive commands were confirmed.
- [ ] List pages have a bounded query count; `strict_loading` or Bullet shows no N+1.
- [ ] Jobs enqueue after commit, are idempotent, and declare retry and discard rules.
- [ ] Specs, RuboCop and Brakeman pass; production deploy was confirmed by the user.

## Related

- Workflows: `/feature-dev`, `/tdd`, `/verify`, `/code-review`, `/api-scaffold`.
- Knowledge: `ruby-patterns`, `database-migrations`, `postgres-patterns`, `background-jobs`, `auth-patterns`, `realtime-websockets`, `docker-containers`.
- Agents: `ruby-reviewer`, `backend-engineer`, `database-architect`.
