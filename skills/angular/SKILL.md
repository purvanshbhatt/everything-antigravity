---
name: angular
disable-model-invocation: true
description: >-
  Builds modern Angular apps with standalone components, signals (signal,
  computed, effect, input, output, model), built-in control flow and @defer,
  inject()-based DI, functional guards and interceptors, leak-free RxJS interop,
  zoneless change detection, and TestBed tests with HttpTestingController. Use
  when writing, migrating or reviewing Angular components, services, routes or
  tests.
---

# Modern Angular

Write Angular the current way: standalone components, signals for state,
RxJS for streams of events, and `inject()` for dependencies. Angular ships a
major roughly every six months, so check the installed version and run the
official migrations instead of hand-porting.

## When to use

- Creating or refactoring components, services, routes, guards or interceptors.
- Moving from NgModules, `@Input`/`@Output`, `*ngIf`/`*ngFor` or constructor DI to current APIs.
- Fixing subscription leaks, nested subscribes or change detection that does not update.
- Writing component and service tests.

## When not to use

- Cross-framework state choices: use `state-management`. Form error UX: use `forms-validation`.
- Large version jumps across several majors: use `/framework-migration` with the steps below.
- Page-load performance: use `web-performance`.

## Workflow

1. **Pin the version and run migrations through the CLI.**

   ```bash
   npx ng version
   npx ng update                                  # lists available updates
   npx ng update @angular/core @angular/cli       # one major at a time
   ```

   Follow angular.dev/update-guide for each hop. Ask the user before running `ng update` on a dirty tree; commit first so the schematic diff is reviewable.

   **Check:** `npx ng build` and `npx ng test` pass on the new version before you change any feature code.

2. **Use standalone components with OnPush.** Standalone is the default from v19; do not add new NgModules. Use signal APIs: `input()`, `input.required()`, `output()`, `model()`, `viewChild()`, `contentChildren()`. Use built-in control flow (`@if`, `@for` with `track`, `@switch`) and `@defer (on viewport)` for heavy below-the-fold blocks.

   Migration schematics exist for most of this (`ng generate @angular/core:standalone`, `:control-flow`, `:inject`, `:signal-input-migration`, `:output-migration`, `:signal-queries-migration`); verify names against the current docs, and review their diffs.

   **Check:** `grep_search` changed files for `NgModule`, `*ngIf`, `*ngFor`, `@Input(` and constructor injection; each remaining hit is intentional.

3. **Hold state in signals.** `signal` for writable state, `computed` for derived values, `linkedSignal` for derived-but-resettable values. Use `effect` only to push state into non-signal APIs (storage, logging, third-party widgets), never to set other signals. Check the docs for the stability of `resource` and `httpResource` in your version.

   **Check:** No `effect` writes to another signal; derived values use `computed`.

4. **Inject dependencies with `inject()`** in field initializers. Use `providedIn: 'root'` for app-wide services and an `InjectionToken` for config. Configure the app in `app.config.ts`:

   ```ts
   export const appConfig: ApplicationConfig = {
     providers: [
       provideRouter(routes, withComponentInputBinding()),
       provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
     ],
   };
   ```

   **Check:** The app bootstraps with `bootstrapApplication(App, appConfig)` and no `AppModule`.

5. **Keep RxJS disciplined.** Convert streams for templates with `toSignal(obs$, { initialValue })` or the `async` pipe. Unsubscribe with `takeUntilDestroyed()` in an injection context. Never nest `subscribe`; choose the flattening operator on purpose (table below).

   **Check:** `grep_search` for `.subscribe(` in components; each has `takeUntilDestroyed`, or is replaced by `toSignal` or the `async` pipe.

6. **Route lazily and guard functionally.** Use `loadComponent` and `loadChildren` with dynamic imports. Write guards as `CanActivateFn` that return `true` or a `UrlTree` (`inject(Router).createUrlTree(['/login'])`). Guards are UX; the API must still authorize every request.

   **Check:** The production build output shows lazy chunks per feature route.

7. **Go zoneless when the code is ready.** `provideZonelessChangeDetection()` requires that UI updates come from signals, the `async` pipe or template events. It is the default for new apps in recent majors; verify for yours. Plain field mutation inside `setTimeout` will not re-render.

   **Check:** With zoneless enabled, every interaction in the changed feature updates the view.

8. **Test with TestBed.** `ng test` uses the project's configured runner (newer majors default to Vitest, older ones Karma/Jasmine; check `angular.json`). For HTTP, provide `provideHttpClient()` and `provideHttpClientTesting()`, then `HttpTestingController.expectOne(url).flush(body)`. Set signal inputs with `fixture.componentRef.setInput('name', value)` and `await fixture.whenStable()`.

   **Check:** `npx ng test` and `npx ng build` are green; `httpTesting.verify()` runs after each HTTP test.

## Patterns

### Search box: signal in, debounced stream, signal out

```ts
@Component({
  selector: 'app-user-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label for="q">Search users</label>
    <input id="q" [value]="query()" (input)="onInput($event)" />
    <ul>
      @for (u of results(); track u.id) { <li>{{ u.name }}</li> }
      @empty { <li>No users found</li> }
    </ul>
  `,
})
export class UserSearch {
  private readonly api = inject(UserApi);
  readonly query = signal('');
  readonly results = toSignal(
    toObservable(this.query).pipe(debounceTime(250), distinctUntilChanged(), switchMap((q) => this.api.search(q))),
    { initialValue: [] as User[] },
  );
  onInput(e: Event) { this.query.set((e.target as HTMLInputElement).value); }
}
```

### Functional interceptor

```ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};
```

### Flattening operators

| Operator | Semantics | Use for |
| :--- | :--- | :--- |
| `switchMap` | Cancel previous | Search, route-param loads |
| `concatMap` | Queue in order | Ordered writes |
| `exhaustMap` | Ignore while busy | Submit buttons, login |
| `mergeMap` | Run in parallel | Independent fire-and-forget work, with a concurrency limit |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `subscribe` inside `subscribe` | Flatten with the right operator | Leaks, races and lost errors |
| Manual `subscribe` that copies into a field | `toSignal` or the `async` pipe | Automatic teardown and change detection |
| `effect` that sets another signal | `computed` or `linkedSignal` | Glitches and loops |
| Call methods in templates for derived data | `computed` signals | Methods re-run on every check |
| `@for` without a meaningful `track` | `track item.id` | DOM churn and lost focus |
| Treat route guards as security | Authorize in the API | Guards run in the user's browser |

## Verification checklist

- [ ] Angular version is known; migrations ran through `ng update` on a clean tree.
- [ ] New code is standalone, OnPush, and uses signal inputs and outputs.
- [ ] No nested subscribes; every component subscription tears down.
- [ ] Feature routes are lazy; guards return `UrlTree`s; APIs authorize.
- [ ] `ng test` and `ng build` pass.

## Related

- Knowledge: `typescript-patterns`, `state-management`, `forms-validation`, `web-components`, `web-performance`, `accessibility-a11y`.
- Workflows: `/framework-migration`, `/dependency-upgrades`, `/e2e`, `/verify`.
- Agents: `frontend-engineer`, `typescript-reviewer`, `migration-specialist`, `test-engineer`.
