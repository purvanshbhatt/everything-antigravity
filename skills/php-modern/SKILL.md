---
name: php-modern
disable-model-invocation: true
description: >-
  Writes and reviews modern PHP 8.3+: strict_types, union and DNF types, enums,
  readonly classes and value objects, match, constructor promotion, attributes,
  Composer hygiene and autoloading, PSR interfaces and PER coding style,
  PHPStan or Psalm with baselines, Rector upgrades, PHPUnit attributes and
  secure defaults. Use when writing or modernizing framework-agnostic PHP,
  adding static analysis, upgrading PHP versions or reviewing PHP code.
---

# Modern PHP

Treat PHP as a typed language: strict types in every file, value objects and
enums instead of arrays and magic strings, and static analysis at a high level
in CI. Most legacy PHP pain comes from untyped arrays flowing everywhere.

## When to use

- Writing PHP libraries, services or framework-agnostic code (Symfony components, Slim, plain PHP).
- Modernizing a codebase: adding types, enums, readonly objects, upgrading PHP versions.
- Setting up Composer, PSR-4 autoloading, PHPStan or Psalm, Rector and a code style fixer.
- Reviewing PHP for type holes and security mistakes.

## When not to use

- Laravel-specific work (Eloquent, queues, policies, Artisan): use `laravel`.
- Deep static-analysis tooling across languages (Semgrep, CodeQL): use `static-analysis`.
- Database schema and query tuning: use `mysql-mariadb`, `postgres-patterns` or `sql-optimization`.
- A dependency upgrade campaign across a repository: run `/dependency-upgrades`.

## Workflow

1. **Pin the platform.** Read `composer.json` for the `php` constraint, `config.platform.php`, autoload rules and scripts.

   ```bash
   php -v
   composer validate --strict
   composer show --direct --outdated
   composer audit
   ```

   **Check:** The `require.php` constraint matches the production runtime, and `composer audit` has no unaddressed advisories.

2. **Add strict types and real types to touched code.** Put `declare(strict_types=1);` at the top of every file you edit. Type every parameter, return and property; use `mixed` only at true boundaries and narrow it immediately.

   **Check:** `grep_search` for files without `strict_types` in the changed set returns none.

3. **Replace arrays-as-structs and magic strings.** Model domain data as `readonly` classes with validating constructors, and closed sets of values as backed enums. Keep raw arrays only at I/O boundaries (JSON, database rows) and map them immediately.

   **Check:** New public methods neither accept nor return `array` shapes that should be objects.

4. **Run static analysis at a high level with a baseline.** Start PHPStan or Psalm at the strictest level the team accepts, baseline existing errors, and forbid new ones.

   ```bash
   composer require --dev phpstan/phpstan
   vendor/bin/phpstan analyse src tests --level=8
   vendor/bin/phpstan analyse --generate-baseline     # freeze legacy errors in phpstan-baseline.neon
   # Psalm alternative:
   vendor/bin/psalm --init && vendor/bin/psalm --set-baseline=psalm-baseline.xml
   ```

   Available levels differ between PHPStan major versions; check the docs and use `max` to mean "strictest". **Check:** Analysis passes with no new errors, and the baseline only shrinks.

5. **Automate upgrades and style.** Use Rector for mechanical upgrades (PHP version sets, type declarations) and PHP-CS-Fixer or PHP_CodeSniffer for PER Coding Style. Always review the dry run first.

   ```bash
   vendor/bin/rector process --dry-run
   vendor/bin/php-cs-fixer fix --dry-run --diff
   ```

   **Check:** Rector and the fixer report no pending changes, and tests still pass after applying them.

6. **Test with PHPUnit attributes.** PHPUnit 10+ uses attributes (`#[Test]`, `#[DataProvider('cases')]` with a static provider); doc-comment annotations are deprecated in newer versions.

   ```bash
   vendor/bin/phpunit --colors=always
   ```

   **Check:** New behaviour has tests, including invalid input that the constructor or enum rejects.

7. **Prepare for production.** Install with `composer install --no-dev --optimize-autoloader`, enable OPcache, and ensure `display_errors=Off` with errors logged.

   **Check:** The production image contains no dev dependencies and no `.env` with real secrets.

## Patterns

### Version features worth using

| Version | Feature |
| :--- | :--- |
| 8.0 | Constructor promotion, `match`, named arguments, nullsafe `?->`, union types, attributes |
| 8.1 | Enums, `readonly` properties, `never`, intersection types, first-class callables `strlen(...)`, `new` in initializers |
| 8.2 | `readonly` classes, DNF types `(A&B)\|null`, standalone `true`/`false`/`null`, `#[\SensitiveParameter]` |
| 8.3 | Typed class constants, `#[\Override]`, `json_validate()` |
| 8.4+ | Property hooks, asymmetric visibility and more; check the release notes on php.net before relying on them |

### Value object and enum

```php
<?php

declare(strict_types=1);

namespace App\Billing;

enum Currency: string
{
    case EUR = 'EUR';
    case USD = 'USD';

    public function minorUnits(): int
    {
        return match ($this) {
            self::EUR, self::USD => 2,
        };
    }
}

final readonly class Money
{
    public function __construct(
        public int $amountMinor,
        public Currency $currency,
    ) {
        if ($amountMinor < 0) {
            throw new \InvalidArgumentException('Amount must not be negative.');
        }
    }

    public static function fromInput(array $data): self
    {
        return new self(
            (int) ($data['amount_minor'] ?? throw new \InvalidArgumentException('amount_minor missing')),
            Currency::from((string) ($data['currency'] ?? '')),   // throws ValueError on unknown codes
        );
    }

    public function add(self $other): self
    {
        if ($other->currency !== $this->currency) {
            throw new \DomainException('Currency mismatch.');
        }
        return new self($this->amountMinor + $other->amountMinor, $this->currency);
    }
}
```

Store money as integer minor units, never floats. Use `Currency::tryFrom()`
when an unknown value should become `null` instead of an exception.

### PSR standards to code against

| PSR | Use |
| :--- | :--- |
| PSR-4 | Autoloading: namespace prefix maps to a directory in `composer.json` |
| PSR-3 | `LoggerInterface`; inject it, never `echo` diagnostics |
| PSR-7 / PSR-17 | HTTP message objects and their factories |
| PSR-11 | Container interface; resolve at the composition root only |
| PSR-15 | HTTP middleware and request handlers |
| PSR-18 | HTTP client interface; mockable in tests |
| PSR-20 | Clock interface; inject time instead of calling `time()` |
| PER Coding Style | Successor to PSR-12 for formatting |

### Secure defaults

- Passwords: `password_hash($p, PASSWORD_DEFAULT)` and `password_verify`; never MD5 or SHA for passwords.
- SQL: PDO prepared statements with bound parameters; set `PDO::ATTR_EMULATE_PREPARES => false` where the driver supports native prepares.
- Output: `htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')` or a templating engine with auto-escaping.
- Randomness: `random_bytes` and `random_int`; compare secrets with `hash_equals`.
- Never `unserialize()` untrusted data; use `json_decode($s, true, 512, JSON_THROW_ON_ERROR)`.
- Never pass user input to `eval`, `include`, or shell functions; if a process is unavoidable, use `proc_open` with an argument array.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Omit `declare(strict_types=1)` | Add it to every file | Silent scalar coercion hides bugs (`"1abc"` to int) |
| Associative arrays as domain objects | `readonly` classes and enums | No types, no autocomplete, typos become runtime nulls |
| Class constants for closed value sets | Backed enums | Exhaustive `match`, type safety, `from`/`tryFrom` |
| Run PHPStan at level 0 forever | High level plus a shrinking baseline | Low levels miss most real type errors |
| Commit without `composer.lock` for an application | Commit the lock file; run `composer install` in CI | Reproducible builds |
| `@` error suppression | Check return values or catch specific exceptions | Hides failures and slows execution |
| Static service locators and globals | Constructor injection via interfaces | Testable, explicit dependencies |

## Verification checklist

- [ ] Every changed file declares strict types, and all signatures are fully typed.
- [ ] Domain data uses value objects and enums; arrays stay at boundaries.
- [ ] `composer validate --strict` and `composer audit` are clean.
- [ ] PHPStan or Psalm passes at the agreed level with no new baseline entries.
- [ ] Rector and the style fixer report no pending changes; PHPUnit passes.
- [ ] Secure defaults hold: prepared statements, escaping, password hashing, no `unserialize` of input.

## Related

- Workflows: `/dependency-upgrades`, `/code-review`, `/verify`, `/tdd`.
- Knowledge: `laravel`, `static-analysis`, `linting-formatting`, `api-security`, `cryptography`, `sql-optimization`.
- Agents: `php-reviewer`, `backend-engineer`, `security-guard`.
