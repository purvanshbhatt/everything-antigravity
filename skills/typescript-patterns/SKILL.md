---
name: typescript-patterns
description: >-
  Applies advanced TypeScript type-system patterns: strict tsconfig flags,
  narrowing and discriminated unions, exhaustive checks, constrained generics,
  branded types, satisfies, mapped and conditional types, runtime validation at
  boundaries, and package exports and module boundaries. Use when designing
  types, tightening tsconfig, fighting confusing type errors, or reviewing a
  TypeScript codebase for type safety.
---

# TypeScript Patterns

Make illegal states unrepresentable, validate data where it enters the program,
and let inference do the rest. Most TypeScript pain comes from `any`, casts and
loose config, not from missing type gymnastics.

## When to use

- Turning on `strict` (or stricter flags) in an existing codebase.
- Modelling domain states, results and IDs so the compiler catches misuse.
- Writing reusable generic helpers or library types with good inference.
- Publishing a package and getting `exports`, `.d.ts` and ESM/CJS right.
- Slow `tsc` runs or unreadable type errors from deep conditional types.

## When not to use

- Node runtime behaviour (streams, workers, shutdown): use `nodejs-patterns`.
- React component and hook design: use `react-patterns` or `frontend-react-nextjs`.
- Bundler and build config: use `vite-bundlers`; workspace layout: use `monorepo-tooling`.
- A review of a diff: delegate to the `typescript-reviewer` agent.

## Workflow

1. **Read the current setup.** Note the TypeScript version, module mode and which strict flags are on.

   ```bash
   npx tsc --version
   npx tsc --showConfig          # effective config after "extends"
   npx tsc --noEmit -p .         # errors end with "Found N errors"
   ```

   **Check:** You can state the TS version, `module`/`moduleResolution`, and the current error count.

2. **Tighten config one flag at a time.** Order: `strict`, then `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, then `exactOptionalPropertyTypes`. For a large codebase, fix by directory with a temporary `tsconfig.strict.json` that `extends` the base and `include`s only migrated folders, and run it in CI.

   **Check:** `npx tsc --noEmit` error count is zero for migrated paths and does not grow elsewhere.

3. **Model states, not flags.** Replace boolean soup (`isLoading`, `error?`, `data?`) with a discriminated union and an exhaustive `switch` ending in `assertNever`.

   **Check:** Adding a new variant produces a compile error at every unhandled `switch`.

4. **Validate at the boundary, infer inside.** Parse HTTP bodies, env vars, JSON files and third-party responses with a schema library (zod, valibot) and derive the static type from the schema. Inside the program, trust the types.

   **Check:** `grep_search` for ` as ` casts and `JSON.parse(` in changed files; each remaining cast is justified in a comment.

5. **Write generics that infer.** Constrain type parameters (`<T extends Record<string, unknown>>`), let callers omit explicit type arguments, use `const` type parameters (TS 5.0+) to keep literal types, and `NoInfer<T>` (TS 5.4+) to stop a parameter from widening inference.

   **Check:** Call sites compile without explicit `<...>` and hover types show literals where intended.

6. **Guard module boundaries.** Use `import type` for type-only imports (required under `verbatimModuleSyntax`), export a small public surface, and for packages declare `exports` with the `types` condition first. Verify with `npx publint` and `npx @arethetypeswrong/cli --pack .`.

   **Check:** Both tools report no errors, and consumers cannot deep-import internals.

7. **Test the types and run the gates.** Use `@ts-expect-error` lines or `expectTypeOf` (Vitest) for type-level tests. Run `tsc --noEmit` and typescript-eslint with type-aware rules.

   **Check:** Type tests fail when the type regresses (temporarily break one to confirm).

## Patterns

### Baseline tsconfig

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",            // Node library or service; use "ESNext" + "moduleResolution": "Bundler" for bundled apps
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

Under `verbatimModuleSyntax`, files compiled as CommonJS cannot use ESM `import` syntax; check the package `"type"` field before enabling it.

### Discriminated union with exhaustive check

```ts
type Fetch<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; error: Error };

function render<T>(s: Fetch<T>): string {
  switch (s.status) {
    case "idle": return "";
    case "loading": return "Loading...";
    case "ok": return JSON.stringify(s.data);   // s.data is T here
    case "error": return s.error.message;
    default: return assertNever(s);
  }
}

function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}
```

### Branded IDs and satisfies

```ts
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

type UserId = Brand<string, "UserId">;
type OrderId = Brand<string, "OrderId">;

function toUserId(s: string): UserId {
  if (!/^u_[a-z0-9]+$/.test(s)) throw new Error(`invalid user id: ${s}`);
  return s as UserId;                       // the only cast, inside the constructor
}

// satisfies checks the shape but keeps the literal types for autocompletion
const routes = {
  home: "/",
  user: "/users/:id",
} as const satisfies Record<string, `/${string}`>;
type RouteName = keyof typeof routes;       // "home" | "user"
```

### Choosing a construct

| Need | Use | Avoid |
| :--- | :--- | :--- |
| Value is not known yet | `unknown`, then narrow | `any` |
| Custom narrowing | `function isX(v: unknown): v is X` or `asserts v is X` | Casting after an `if` |
| Fixed set of strings | Union of literals, or `as const` object plus `keyof typeof` | `enum` (emits runtime code; blocked under `erasableSyntaxOnly`) |
| Object with known keys | Interface or type alias | `Record<string, T>` (every key "exists") |
| Derive types from values | `typeof`, `keyof`, `ReturnType`, `Awaited`, indexed access | Duplicating shapes by hand |
| Error results | `{ ok: true; value } \| { ok: false; error }` | Throwing for expected failures |

### Slow or unreadable types

- Measure with `npx tsc --extendedDiagnostics` and `npx tsc --generateTrace ./trace`.
- Name intermediate types instead of nesting conditional types five levels deep.
- Annotate return types of exported functions so `.d.ts` emit stays small.
- Use project references (`"composite": true`, `tsc -b`) to split large monorepos.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `as Foo` on parsed JSON | Validate with a schema and infer the type | Casts lie; the crash moves to a distant line |
| Non-null `!` to silence errors | Narrow with a check or restructure | `!` hides real `undefined` paths |
| `// @ts-ignore` | `// @ts-expect-error` with a reason | `expect-error` fails once the error disappears |
| Optional fields for mutually exclusive states | Discriminated union | Optional soup allows impossible combinations |
| Explicit generic arguments at every call | Constrain and let inference work | Signals a badly shaped signature |
| Barrel files re-exporting everything | Narrow public entry points | Barrels slow builds and leak internals |
| Turning on every strict flag at once in a big repo | One flag per PR, directory by directory | Huge diffs stall and get reverted |

## Verification checklist

- [ ] `strict` is on, plus the flags agreed in step 2; `tsc --noEmit` is clean.
- [ ] No new `any`, `!` or unexplained `as` in changed files.
- [ ] External input is schema-validated before use.
- [ ] Unions are handled exhaustively with `assertNever`.
- [ ] Packages pass `publint` and `@arethetypeswrong/cli`.
- [ ] Type-level tests exist for exported generic helpers.

## Related

- Workflows: `/code-review`, `/build-fix`, `/refactor-clean`, `/framework-migration`.
- Knowledge: `nodejs-patterns`, `react-patterns`, `frontend-react-nextjs`, `api-design`, `forms-validation`, `monorepo-tooling`, `vite-bundlers`, `linting-formatting`.
- Agents: `typescript-reviewer`, `build-error-resolver`.
