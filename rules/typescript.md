---
trigger: glob
globs: "**/*.ts, **/*.tsx, **/*.mts, **/*.cts, **/*.js, **/*.jsx, **/*.mjs, **/*.cjs"
description: TypeScript and JavaScript conventions
---

# TypeScript and JavaScript

## Compiler and tooling

- Keep `"strict": true`. Do not turn off strict flags to silence errors. Prefer also `noUncheckedIndexedAccess`, `noImplicitOverride` and `verbatimModuleSyntax` when the project allows.
- Gate changes with the project's own scripts: `tsc --noEmit` (or `npm run typecheck`), lint, then tests. Use the lockfile's package manager (`npm`, `pnpm`, `yarn`, `bun`); never mix.
- Plain `.js` files: add JSDoc types and `// @ts-check`, or rely on `checkJs` if configured.

## Types

- No `any`. Use `unknown` and narrow with type guards, `in`, `instanceof` or a schema. No `@ts-ignore`; `@ts-expect-error` only with a reason comment.
- No non-null `!` or `as` casts to silence the compiler. Casts are allowed only right after runtime validation.
- Model variants as discriminated unions with a literal tag (`kind`, `type`), and make `switch` statements exhaustive:

  ```ts
  default: { const _never: never = value; throw new Error(`unhandled: ${String(_never)}`); }
  ```

- Prefer string-literal unions or `as const` objects over `enum` and `namespace`.
- Use `satisfies` to check config objects without widening.
- Favour `readonly` properties, `ReadonlyArray<T>` / `readonly T[]` parameters and `const`. Do not mutate arguments.
- Export explicit return types on public functions.

## Boundaries

- Validate every external input with a schema (zod or the project's existing validator): HTTP bodies and query params, env vars, `JSON.parse` output, file contents, queue messages, third-party API responses and LLM output.
- Derive types from schemas (`z.infer<typeof Schema>`) instead of duplicating them. Use `safeParse` where the caller must handle failure.
- Parse env once at startup into a typed config object; never read `process.env` deep in the code.

## Async

- No floating promises. Every promise is awaited, returned, or explicitly `void`ed with a comment saying why. Enable `@typescript-eslint/no-floating-promises` and `no-misused-promises` where lint exists.
- Never pass async callbacks to `forEach`; use `for...of` with `await`, or `Promise.all` / `Promise.allSettled` with bounded concurrency.
- Pass `AbortSignal` and timeouts to network calls.

## Errors

- `catch (err: unknown)`, narrow before use, and rethrow with context: `new Error("loading config", { cause: err })`.
- Expected failures (validation, not found) are return values (Result or discriminated union); exceptions are for bugs and infrastructure failures.
- Never swallow errors with an empty `catch`. Log through the project logger, not `console.log`, in library and server code.

## Modules

- ESM by default. Use `import type` for type-only imports. Under `NodeNext`, relative imports include the `.js` extension.
- Prefer named exports. No `require` in ESM files, no circular imports, no barrel files that re-export entire directories in large apps.

## Safety

- No `eval`, `new Function` or `innerHTML` with untrusted data. Use parameterized queries.
- Do not use `Math.random()` for tokens or IDs; use `crypto.randomUUID()` or `crypto.getRandomValues()`.
