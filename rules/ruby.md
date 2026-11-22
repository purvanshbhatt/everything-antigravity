---
trigger: glob
globs: "**/*.rb, **/Gemfile, **/*.rake"
description: Ruby conventions
---

# Ruby

## Environment and tooling

- Use the version in `.ruby-version` and run tools through Bundler: `bundle exec rubocop`, `bundle exec rspec`, or the project's `bin/` stubs (`bin/rails`, `bin/rake`).
- Add gems to `Gemfile` with a pessimistic constraint (`~> 2.3`) in the right group, and commit `Gemfile.lock`. Say so when you add a gem.
- Lint and format with RuboCop using the project's `.rubocop.yml`. Do not add `rubocop:disable` comments or new `.rubocop_todo.yml` entries to pass.
- Keep `# frozen_string_literal: true` at the top of files where the project uses it.

## Style

- Follow the community Ruby Style Guide: `snake_case` methods, `CamelCase` classes, predicates end in `?`, dangerous variants in `!`.
- Prefer small methods and guard clauses to nested conditionals.
- Use keyword arguments for optional or boolean parameters. No positional boolean flags.
- Prefer `Enumerable` methods (`map`, `select`, `each_with_object`, `sum`) to manual accumulation. Use `find_each` for large Active Record sets.
- Freeze constant collections. Never mutate arguments the caller owns.

## Metaprogramming restraint

- Prefer plain methods, modules and composition over `method_missing`, `define_method` and `class_eval`. If you use `method_missing`, also define `respond_to_missing?`.
- Never call `send`, `public_send`, `constantize` or `instance_variable_get` with user-controlled input.
- Put monkey patches only in `config/initializers` or refinements, with a reason.

## Errors and logging

- Rescue specific exceptions. Never `rescue Exception` and never `rescue => e` around large blocks that hide bugs.
- Define a small error hierarchy per library inheriting from `StandardError`. Re-raise with context instead of returning `nil` silently.
- Log through `Rails.logger` or the project logger, never `puts`. Do not log secrets or personal data.

## Rails

- Permit parameters explicitly with strong parameters. Never `permit!` and never permit role or ownership fields from user input.
- Scope record lookups through the current user or tenant (`current_user.posts.find(id)`), and authorize with the project's policy layer.
- Parameterize queries: `where(name: value)` or placeholders. Never interpolate input into `where`, `order`, `pluck` or `find_by_sql`.
- Avoid N+1 queries with `includes` or `preload`. Add indexes for new foreign keys and lookup columns.
- Keep callbacks free of external side effects; use `after_commit` for jobs and emails. Pass ids, not records, to Active Job, and make jobs idempotent.
- Write migrations that are safe on large tables: `algorithm: :concurrently` with `disable_ddl_transaction!` for Postgres indexes, expand and contract for renames and removals, backfills outside the schema migration.
- Escape output by default. No `html_safe`, `raw` or `<%==` on user data.

## Security

- Never use `YAML.load` or `Marshal.load` on untrusted data (use `YAML.safe_load`). Never pass input to `Kernel#open`, `URI.open`, `system` or backticks; use argument arrays.
- Keep secrets in Rails credentials or environment variables, never in source.
- Run `bundle exec brakeman` and `bundle exec bundler-audit` when present.

## Tests

- Follow the project's framework (RSpec or Minitest). Minimal factories, request specs for endpoints, no `sleep`, no `allow_any_instance_of`.
- Run the narrowest spec first (`bundle exec rspec path/to_spec.rb:42`), then the suite.
