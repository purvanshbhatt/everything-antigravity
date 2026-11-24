---
name: ruby-patterns
disable-model-invocation: true
description: >-
  Writes and reviews idiomatic Ruby: blocks, procs and lambdas, Enumerable and
  lazy enumerators, modules as mixins and namespaces, Data and Struct value
  objects, pattern matching, error hierarchies, metaprogramming with restraint,
  gem layout and release, Bundler, RuboCop or Standard, and Minitest or RSpec.
  Use when writing plain Ruby libraries, scripts or gems, refactoring
  clever-but-opaque Ruby, or setting up Ruby tooling.
---

# Idiomatic Ruby

Ruby rewards small objects, expressive blocks and plain method calls. It
punishes cleverness: every `method_missing`, monkey patch or `send` makes code
harder to search, type-check and debug. Prefer the boring construct that reads
well and can be found with `grep_search`.

## When to use

- Writing Ruby libraries, CLIs, scripts or gems outside a framework.
- Refactoring dense or metaprogrammed Ruby into something maintainable.
- Choosing between `Struct`, `Data`, plain classes and hashes for values.
- Setting up Bundler, RuboCop or Standard, a test framework or a gem release.

## When not to use

- Rails models, controllers, jobs and Hotwire: use `rails`.
- Shell glue that a 20-line script handles: use `bash-scripting`.
- Static analysis beyond RuboCop (Semgrep, CodeQL): use `static-analysis`.
- Reviewing a large Ruby diff: delegate to the `ruby-reviewer` agent.

## Workflow

1. **Pin the Ruby version and dependencies.** Read `.ruby-version` or `.tool-versions`, `Gemfile`, `Gemfile.lock` and any `*.gemspec`. Use a version manager (rbenv, asdf, mise or chruby; RubyInstaller on Windows).

   ```bash
   ruby -v && bundle -v
   bundle install
   bundle exec ruby -e 'puts RUBY_VERSION'
   ```

   **Check:** The running Ruby matches the project's declared version and `bundle install` resolves without changes to the lock file.

2. **Choose the right value type.** Use `Data.define` (Ruby 3.2+) for immutable values, `Struct` only when mutability is needed, and plain classes when behaviour dominates. Avoid hashes with symbol keys as long-lived domain objects.

   **Check:** New domain values are objects with named readers, not hashes passed across modules.

3. **Write expressive, side-effect-light methods.** Use Enumerable (`map`, `select`, `each_with_object`, `sum`, `group_by`, `partition`, `tally`) rather than manual accumulators; use `lazy` for large or infinite sources. Keep methods short and return values instead of mutating arguments.

   **Check:** No method mutates its arguments unless its name ends in `!` or documents it.

4. **Use modules deliberately.** Namespace everything under one top-level module. Mix in behaviour with `include` (instance methods), `extend` (class or object methods) or `prepend` (wrap existing methods). Prefer composition (an object you call) over a module that reaches into the host's private state.

   **Check:** Each mixin documents the methods it expects the host to provide.

5. **Raise and rescue precisely.** Define `class MyLib::Error < StandardError` and subclasses; rescue specific classes; never rescue `Exception`. Use `ensure` for cleanup, or block-based APIs (`File.open(path) { ... }`) that clean up for you.

   **Check:** `grep_search` for `rescue Exception` and bare `rescue => e` that swallow errors returns none in new code.

6. **Lint and test.**

   ```bash
   bundle exec rubocop              # or: bundle exec standardrb
   bundle exec rubocop -a           # safe autocorrections only; review -A changes by hand
   bundle exec rake test            # Minitest; or: bundle exec rspec
   ```

   For an inherited codebase, `bundle exec rubocop --auto-gen-config` writes `.rubocop_todo.yml` so new code is held to the rules while old offences are paid down. **Check:** RuboCop and tests pass; the todo file did not grow.

7. **Release gems with confirmation.** Bump the version, update the changelog, build and inspect the gem, then publish only after the user confirms.

   ```bash
   gem build my_gem.gemspec
   gem spec my_gem-1.2.0.gem files     # inspect what ships
   gem push my_gem-1.2.0.gem           # outward-facing: ask the user first
   ```

   **Check:** The gem contains only intended files and installs cleanly in a fresh environment (`gem install ./my_gem-1.2.0.gem`).

## Patterns

### Blocks, procs and lambdas

| Construct | Arity | `return` inside | Use for |
| :--- | :--- | :--- | :--- |
| Block (`do ... end`, `{ }`) | Lenient | Returns from the enclosing method | Iteration, resource scoping, DSLs |
| `proc { }` / `Proc.new` | Lenient | Returns from the defining method | Rarely needed directly |
| `lambda { }` / `->(x) { }` | Strict | Returns from the lambda | Callbacks and stored functions |

```ruby
# Resource-scoped API: caller cannot forget cleanup
def with_connection(url)
  conn = Connection.open(url)
  yield conn
ensure
  conn&.close
end

# Return an Enumerator when no block is given, so callers can chain
def each_record(path)
  return enum_for(__method__, path) unless block_given?

  File.foreach(path) { |line| yield parse(line) }
end

each_record("big.csv").lazy.select(&:active?).first(10)
```

### Value objects and pattern matching

```ruby
Point = Data.define(:x, :y) do
  def +(other) = with(x: x + other.x, y: y + other.y)
end

case response
in { status: 200, body: { items: [_, *] => items } } then render(items)
in { status: 404 }                                     then not_found
in { status: 500.. }                                   then retry_later
end
```

`Data` instances are frozen and compare by value. Add
`# frozen_string_literal: true` to files so string literals are immutable too.

### Metaprogramming restraint ladder

Use the first rung that solves the problem:

1. Plain methods and composition.
2. A small, explicit DSL with `define_method` over a known list of names.
3. `Module#prepend` to wrap behaviour, instead of `alias_method` chains.
4. Refinements to scope a core-class extension to one file.
5. `method_missing` only with a matching `respond_to_missing?`, a narrow name pattern, and a `super` fallback.

Global monkey patches of core classes are off the ladder. Use `public_send`
instead of `send` so private methods stay private.

### Gem layout

```text
my_gem/
├── lib/my_gem.rb            # requires the rest; defines MyGem::VERSION via version.rb
├── lib/my_gem/version.rb
├── my_gem.gemspec           # files via git ls-files; required_ruby_version set
├── test/ or spec/
└── Gemfile                  # gemspec + dev dependencies
```

`bundle gem my_gem` scaffolds this. Applications commit `Gemfile.lock`; for
gems, follow the project's convention and keep runtime dependency ranges loose
(`~>` on a minor version).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `rescue Exception` | Rescue `StandardError` subclasses you expect | Swallows `Interrupt`, `SystemExit` and `NoMemoryError` |
| `method_missing` for a fixed set of names | `define_method` over the list | Searchable, faster, works with `respond_to?` |
| Monkey-patch core classes globally | Refinements or a helper module | Breaks other gems in unpredictable ways |
| `send(:private_method)` from outside | Public API or `public_send` | Couples to internals |
| Long-lived hashes as domain objects | `Data`, `Struct` or classes | Typos return `nil` instead of raising |
| `rubocop -A` across a whole legacy repo in one commit | `-a` plus a todo file, fixing per area | Unsafe autocorrects change behaviour silently |
| Mutate default or shared arguments | `dup` or build new objects | Hidden state shared between calls |

## Verification checklist

- [ ] Ruby version is pinned and the lock file resolves unchanged.
- [ ] Domain values use `Data`, `Struct` or classes, not hashes.
- [ ] Errors use a library hierarchy rooted in `StandardError`; nothing rescues `Exception`.
- [ ] Any metaprogramming is the lowest workable rung and is covered by tests.
- [ ] RuboCop or Standard passes; tests pass; the todo file did not grow.
- [ ] Gem releases were inspected and the user confirmed the push.

## Related

- Workflows: `/tdd`, `/verify`, `/code-review`, `/refactor-clean`.
- Knowledge: `rails`, `linting-formatting`, `static-analysis`, `cli-development`, `tdd-testing`.
- Agents: `ruby-reviewer`, `refactor-cleaner`, `test-engineer`.
