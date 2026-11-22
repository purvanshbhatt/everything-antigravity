---
name: laravel
description: >-
  Builds and reviews Laravel applications: Eloquent models, relationships and
  N+1 prevention, safe migrations, form request validation, policies and gates,
  queued jobs with retries and idempotency, Pest or PHPUnit feature tests with
  fakes, Pint and Larastan, and zero-surprise deployment (caching, migrations,
  queue restarts). Use when adding features to a Laravel app, debugging
  Eloquent or queue issues, or preparing a Laravel release.
---

# Laravel

Lean on Laravel's conventions, then add the guardrails it leaves optional:
strict Eloquent in development, validation in form requests, authorization in
policies, idempotent jobs, and feature tests that hit real routes.

## When to use

- Adding models, migrations, controllers, jobs or policies to a Laravel app.
- Slow pages from N+1 queries, mass-assignment bugs or missing authorization.
- Queue problems: duplicate processing, jobs lost on deploy, retries that cause harm.
- Writing Pest or PHPUnit feature tests, or setting up Pint and Larastan.
- Deploying a Laravel app, including Cloud Run or containers.

## When not to use

- Language-level PHP (types, enums, Composer, PSR, PHPStan setup): use `php-modern`.
- Schema design independent of the framework: use `database-design` or `postgres-patterns`.
- Large-table migration strategy (expand/contract, backfills): use `database-migrations`.
- Queue broker choice and delivery semantics: use `message-queues` or `background-jobs`.

## Workflow

1. **Read the app's shape.** Check the Laravel and PHP versions, the test runner and the queue driver.

   ```bash
   php artisan --version && php -v
   composer show | grep -E "laravel/framework|pestphp/pest|phpunit/phpunit|larastan"   # PowerShell: composer show | Select-String "laravel/framework|pest|phpunit|larastan"
   grep -n "QUEUE_CONNECTION\|DB_CONNECTION" .env.example
   php artisan route:list --except-vendor
   ```

   Laravel 11+ uses the slim skeleton: middleware, exceptions and routing are configured in `bootstrap/app.php`. **Check:** You can name the framework version, PHP version, database, queue driver and test runner.

2. **Make Eloquent strict outside production.** In `AppServiceProvider::boot()` add `Model::shouldBeStrict(! app()->isProduction());`, which prevents lazy loading, silently discarded attributes and missing-attribute access. Declare `$fillable` (or use `$guarded` deliberately) on every model.

   **Check:** The test suite runs with strict mode on and fails on any lazy load.

3. **Generate pieces with Artisan, then edit.** `php artisan make:model Post -mf` (model, migration, factory), `make:request StorePostRequest`, `make:policy PostPolicy --model=Post`, `make:job PublishPost`. Write migrations that are reversible and safe for live tables (see Patterns).

   ```bash
   php artisan migrate --pretend      # print the SQL first
   php artisan migrate
   php artisan migrate:status
   ```

   `migrate:fresh`, `migrate:reset` and `db:wipe` drop data: run them only on local or test databases, and ask the user before running any migration against a shared or production database. **Check:** `migrate:rollback` followed by `migrate` succeeds locally.

4. **Validate in form requests and authorize in policies.** Controllers call `$request->validated()` only, never `$request->all()`. Authorize every action that touches a record with `Gate::authorize('update', $post)` (or `$this->authorize(...)` when the controller uses the `AuthorizesRequests` trait).

   **Check:** A feature test proves another user gets 403 for update and delete.

5. **Make jobs idempotent.** Jobs can run more than once. Pass IDs not models when state may change, guard side effects with a unique key or status check, set `$tries`, `$backoff` and `$timeout`, implement `failed()`, and dispatch after the transaction commits.

   **Check:** Running the same job twice produces one side effect.

6. **Test through HTTP with fakes.** Feature tests use `RefreshDatabase`, factories, `actingAs`, and `Queue::fake()`, `Mail::fake()`, `Http::fake()` or `Storage::fake()` at the boundaries.

   ```bash
   php artisan test                 # add --parallel once paratest is installed; or ./vendor/bin/pest
   ./vendor/bin/pint --test
   ./vendor/bin/phpstan analyse     # Larastan, configured in phpstan.neon
   ```

   **Check:** Tests, Pint and Larastan pass; new endpoints have success, validation-failure and authorization-failure tests.

7. **Deploy in a fixed order.** Build with production dependencies, cache configuration, migrate, then restart workers.

   ```bash
   composer install --no-dev --optimize-autoloader
   php artisan optimize              # caches config, routes, events and views
   php artisan migrate --force       # confirm with the user before production
   php artisan queue:restart         # workers pick up new code after their current job
   ```

   **Check:** `APP_DEBUG=false` and `APP_ENV=production` in production, `/up` (the default health route in Laravel 11+) returns 200, and workers process a test job.

## Patterns

### Eloquent query discipline

```php
// N+1: one query per post for the author
$posts = Post::latest()->paginate(20);
// Fixed: two queries total, counts computed in SQL
$posts = Post::with('author:id,name')->withCount('comments')->latest()->paginate(20);

// Large exports: stream instead of loading everything
Post::where('published', true)->lazyById(500)->each(fn (Post $p) => $writer->add($p));
```

Wrap multi-write operations in `DB::transaction(fn () => ...)`. Use
`chunkById`/`lazyById` (not `chunk`) when updating rows you are iterating.

### Form request and policy

```php
final class UpdatePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('post'));
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'status' => ['required', Rule::enum(PostStatus::class)],
        ];
    }
}

// Controller
public function update(UpdatePostRequest $request, Post $post): RedirectResponse
{
    $post->update($request->validated());
    return to_route('posts.show', $post);
}
```

### Idempotent job

```php
final class SendInvoice implements ShouldQueue
{
    use Queueable;   // Laravel 11+; older apps use Dispatchable, InteractsWithQueue, Queueable, SerializesModels

    public int $tries = 5;
    public array $backoff = [10, 60, 300];

    public function __construct(public int $invoiceId) {}

    public function handle(Billing $billing): void
    {
        $invoice = Invoice::findOrFail($this->invoiceId);
        if ($invoice->sent_at !== null) {
            return;                                   // already done: safe to rerun
        }
        $billing->send($invoice, idempotencyKey: "invoice-{$invoice->id}");
        $invoice->forceFill(['sent_at' => now()])->save();
    }
}

SendInvoice::dispatch($invoice->id)->afterCommit();
```

### Safe migrations on live tables

| Change | Safe approach |
| :--- | :--- |
| Add a column | Nullable or with a default; backfill in a job; add `NOT NULL` later |
| Rename or drop a column | Expand/contract: add new, dual-write, backfill, switch reads, drop in a later release |
| Add an index on a large table | Use the database's online option (for example `CREATE INDEX CONCURRENTLY` on PostgreSQL via a raw statement outside a transaction) |
| Change column type | New column plus backfill, not an in-place `change()` on a hot table |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `Model::create($request->all())` | `$request->validated()` with `$fillable` | Mass assignment of fields like `is_admin` |
| Authorization checks inside Blade only | Policies enforced in requests or controllers | Hidden buttons are not access control |
| Query in a loop or lazy relationship access | `with()`, `withCount()`, strict mode | N+1 queries scale with page size |
| Pass Eloquent models to jobs that run later | Pass IDs and reload, or accept serialized snapshots knowingly | Stale state and missing-model failures |
| `env()` calls outside config files | `config('services.x.key')` | `env()` returns null once config is cached |
| Deploy without `queue:restart` | Restart workers on every deploy | Long-running workers keep executing old code |
| `APP_DEBUG=true` in production | `false`, with error reporting to logs or an error tracker | Debug pages leak secrets and stack traces |

## Verification checklist

- [ ] Strict Eloquent mode is on in non-production, and no lazy loading remains.
- [ ] Every write endpoint uses a form request and a policy, with tests for 403 and 422.
- [ ] Migrations are reversible and safe for table size; destructive commands were confirmed.
- [ ] Jobs are idempotent, have retries/backoff, and dispatch after commit.
- [ ] `php artisan test`, Pint and Larastan pass.
- [ ] Deploy runs optimize, migrate (confirmed) and queue restart, with debug off.

## Related

- Workflows: `/feature-dev`, `/tdd`, `/verify`, `/code-review`, `/api-scaffold`.
- Knowledge: `php-modern`, `database-migrations`, `background-jobs`, `orm-patterns`, `auth-patterns`, `redis-caching`, `cloud-run`.
- Agents: `php-reviewer`, `backend-engineer`, `database-architect`.
