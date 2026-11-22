---
trigger: glob
globs: "**/*.php"
description: PHP conventions
---

# PHP

## Environment and tooling

- Respect the PHP version in `composer.json` (`require.php`, `config.platform.php`); do not use syntax or functions newer than it allows.
- Manage dependencies with Composer and commit `composer.lock`. Say so when you add a package. Run `composer audit` when dependencies change.
- Format with the project's tool (Laravel Pint, PHP-CS-Fixer or PHP_CodeSniffer) following PSR-12 / PER Coding Style.
- Analyse with PHPStan or Psalm at the configured level. Do not raise the baseline or add `@phpstan-ignore` to pass; fix the type.
- Follow PSR-4 autoloading: one class per file, namespace matches the directory.

## Types

- Start new files with `declare(strict_types=1);` where the project uses it.
- Declare parameter, return and property types everywhere. Use `?Type` or union types instead of untyped values; `mixed` only at untyped third-party boundaries.
- Use enums for fixed sets of values, `readonly` properties and classes for value objects, and constructor property promotion.
- Replace associative arrays that carry structure with DTOs or documented array shapes (`@param array{id: int, name: string}`).
- Use strict comparison (`===`, `!==`, `in_array($x, $list, true)`). Do not rely on loose `==` or `empty()` for values where `0` or `"0"` is valid.

## Errors

- Throw specific exceptions with context; catch specific exceptions. Never `catch (\Throwable)` or `catch (\Exception)` and continue silently.
- Never use the `@` error-suppression operator. Never call `die` or `exit` outside CLI entry points.
- Log through PSR-3 loggers (Monolog, Laravel `Log`), never `echo` or `var_dump` in application code. Do not log secrets or personal data.

## Security

- Use prepared statements or the query builder with bindings. Never concatenate input into SQL, `DB::raw`, `whereRaw` or `orderBy`; allowlist identifiers.
- Escape output for its context: Blade `{{ }}` by default, `htmlspecialchars($v, ENT_QUOTES, 'UTF-8')` in plain PHP. No `{!! !!}` or raw `echo` of user data.
- Never `unserialize` untrusted data (use JSON). Never pass input to `include`, `require`, `eval`, `exec`, `shell_exec`, `system` or backticks; use `escapeshellarg` only as a last resort.
- Hash passwords with `password_hash` and `password_verify`. Generate tokens with `random_bytes` or `bin2hex(random_bytes(32))`.
- Keep secrets in environment variables or the framework's secret store; never commit `.env`. Turn debug mode off outside local.

## Laravel and frameworks

- Validate with Form Requests and use `$request->validated()`. Never pass `$request->all()` to `create` or `update`; keep `$fillable` explicit and never set `$guarded = []`.
- Authorize with policies or gates on every action that reads or changes a record.
- Eager-load relations (`with()`) to avoid N+1 queries; use `chunkById` or `lazy()` for large sets.
- Make queued jobs idempotent and dispatch them after commit. Keep controllers thin; put domain logic in services or actions.
- Use `DateTimeImmutable` or `CarbonImmutable`, stored in UTC. Use integers (minor units) or a money library for money, never floats.

## Tests

- Use PHPUnit or Pest as the project does. Use factories, database transactions or `RefreshDatabase`, and fakes for mail, queues and HTTP.
- Assert behaviour and response bodies, not only status codes.
- Run the narrowest test first (`vendor/bin/pest --filter name`), then the suite.
