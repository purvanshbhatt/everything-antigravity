---
name: flutter-mobile
disable-model-invocation: true
description: >-
  Builds Flutter 3 and Dart 3 apps: feature-first architecture with Riverpod
  or BLoC, go_router navigation, platform channels and Pigeon, rebuild
  control and DevTools profiling, widget/golden/integration_test testing,
  accessibility, and release with flavors, signing and Fastlane. Use when
  starting or structuring a Flutter app, fixing jank or state bugs, adding
  tests, or preparing store builds for Android and iOS.
---

# Flutter Mobile

Structure the app by feature, keep state in one predictable place, rebuild
only what changed, and make every release reproducible from the command line.
Measure performance in profile mode on a real device, never in debug.

## When to use

- New Flutter app or a growing one that needs structure, state management or routing.
- Jank, excessive rebuilds, memory growth or slow start-up.
- Adding widget, golden or integration tests; setting up CI.
- Flavors (dev, staging, prod), signing, store builds and Fastlane.

## When not to use

- Web-only React or Next.js front ends: use `frontend-react-nextjs`.
- Backend APIs the app calls: use `api-design` and `backend-patterns`.
- Firebase or GCP backend provisioning: use `cloud-devops`.
- Deep accessibility audits across platforms: use `accessibility-a11y` and the `accessibility-auditor` agent.

## Workflow

1. **Check the toolchain.** `flutter --version`, `flutter doctor -v`, and the SDK constraint in `pubspec.yaml` (`environment: sdk: ^3.x`). Use `flutter_lints` or a stricter set such as `very_good_analysis` in `analysis_options.yaml`.

   **Check:** `flutter analyze` reports no issues and `dart format --output=none --set-exit-if-changed .` exits 0.

2. **Lay out by feature, layers inside.** Follow the Flutter team's architecture guide (UI layer of views plus view models, data layer of repositories plus services) inside each feature folder:

   ```text
   lib/
     main_dev.dart  main_prod.dart        # flavor entry points
     app/        router.dart theme.dart   # app shell
     features/
       checkout/
         data/          checkout_repository.dart  payment_service.dart  dtos/
         domain/        order.dart (pure Dart, optional layer)
         presentation/  checkout_screen.dart  checkout_controller.dart
     core/       network/ storage/ widgets/
   ```

   **Check:** Nothing under `domain/` imports `package:flutter/`, and features import each other only through their public files.

3. **Choose one state approach and use it consistently.** Riverpod (`flutter_riverpod`, optionally `riverpod_generator`) for dependency injection plus async state with little ceremony; BLoC or Cubit (`flutter_bloc`) when you want explicit event-to-state streams and strict separation. Model states with Dart 3 sealed classes and exhaustive `switch`. Check the package's current major version and migration notes before starting.

   **Check:** Widgets never call repositories or HTTP clients directly; they read state from providers or blocs.

4. **Route with go_router.** Declare routes centrally, use `StatefulShellRoute` for tab navigation that preserves state, `redirect` plus `refreshListenable` for auth guards, and path parameters for deep links. Test deep links on both platforms.

   **Check:** Cold-starting the app from a deep link lands on the right screen with a working back stack.

5. **Cross into native code deliberately.** Prefer an existing plugin. Otherwise use Pigeon (`dart run pigeon --input pigeons/api.dart`) to generate type-safe host APIs instead of hand-written `MethodChannel` string protocols; use `EventChannel` for streams and `dart:ffi` for C libraries.

   **Check:** Channel calls handle `PlatformException` and the missing-implementation case on every platform you ship.

6. **Profile before optimizing.** `flutter run --profile` on a physical device, DevTools Performance and "Track widget rebuilds", then fix the patterns in the table below.

   **Check:** Frame build and raster times stay under the frame budget (about 16 ms at 60 Hz) on the target low-end device during the slow interaction.

7. **Test at three levels** and wire them into CI: unit tests for logic, widget tests for screens, golden tests for key visuals, `integration_test` for one or two critical journeys. See the testing section.

   **Check:** `flutter test` passes locally and in CI; goldens are generated on the same platform as CI.

8. **Release from the command line.** Flavors, signing and Fastlane are in [release guide](references/release.md). Uploading to the stores or changing signing keys requires explicit user confirmation.

   **Check:** A clean checkout builds a signed `appbundle` and `ipa` with one documented command each.

## Patterns

### Rebuild and performance fixes

| Symptom | Fix |
| :--- | :--- |
| Whole screen rebuilds on any state change | Watch narrowly: `ref.watch(provider.select((s) => s.total))`, `BlocSelector`, `context.select` |
| Static subtrees rebuild | `const` constructors; extract widgets into classes, not helper methods |
| Long lists stutter | `ListView.builder` / `SliverList` with `itemExtent` or `prototypeItem` when fixed height |
| Expensive paint repaints with siblings | `RepaintBoundary` around animated or heavy custom paint regions |
| Large images | `cacheWidth`/`cacheHeight` or `ResizeImage` to decode at display size |
| Heavy JSON parsing on the UI thread | `compute()` or `Isolate.run()` |
| `Opacity`, `ClipPath`, `saveLayer` in animations | `FadeTransition`, `AnimatedOpacity`, pre-clipped assets |
| App size | `flutter build appbundle --analyze-size`, deferred components, tree-shaken icons |

### Testing

```dart
testWidgets('shows total and disables pay when cart is empty', (tester) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [cartRepositoryProvider.overrideWithValue(FakeCartRepository.empty())],
    child: const MaterialApp(home: CheckoutScreen()),
  ));
  await tester.pumpAndSettle();
  expect(find.text('Total: €0.00'), findsOneWidget);
  expect(tester.widget<FilledButton>(find.byKey(const Key('pay'))).onPressed, isNull);
  await expectLater(find.byType(CheckoutScreen), matchesGoldenFile('goldens/checkout_empty.png'));
});
```

- Fakes over mocks (`mocktail` when a mock is unavoidable); override providers or inject blocs in tests.
- Update goldens with `flutter test --update-goldens`, review the image diffs in the PR, and pin fonts so goldens are stable.
- Integration tests: `integration_test` package, run with `flutter test integration_test/app_test.dart -d <device>`.

### Accessibility

- Every tappable icon has a `tooltip` or `Semantics(label: ...)`; decorative images use `excludeFromSemantics: true`.
- Tap targets at least 48x48 logical pixels; support text scaling (read `MediaQuery.textScalerOf(context)`, never clamp to 1.0).
- Contrast and target checks in widget tests:

  ```dart
  final handle = tester.ensureSemantics();
  await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
  await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
  await expectLater(tester, meetsGuideline(textContrastGuideline));
  handle.dispose();
  ```

- Verify with TalkBack and VoiceOver on a device for the main journeys.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Business logic and HTTP calls inside `build()` | Controllers, notifiers or blocs plus repositories | `build` runs many times; logic becomes untestable |
| Helper methods returning widgets (`_buildHeader()`) | Small `StatelessWidget` classes with `const` | Methods cannot short-circuit rebuilds |
| Mixing setState, Provider, Riverpod and BLoC | One approach per app, documented | Two sources of truth drift |
| Measuring performance in debug mode | `flutter run --profile` on a real device | Debug mode is JIT-compiled and much slower |
| Secrets in `--dart-define` or assets | Fetch at runtime from your backend; ship only public identifiers | Anything in the app binary can be extracted |
| Hand-rolled `MethodChannel` string APIs | Pigeon-generated APIs | Typos and type mismatches fail only at runtime |
| Manual signing on one laptop | Fastlane match or CI-managed keystores with backups | Lost keys block updates forever (Android upload key reset is slow) |

## Verification checklist

- [ ] `flutter analyze` is clean and formatting check passes.
- [ ] Feature-first layout; domain code is free of Flutter imports.
- [ ] A single state-management approach; widgets do not touch repositories directly.
- [ ] Deep links and auth redirects tested on Android and iOS.
- [ ] Profile-mode trace on a low-end device shows no frames over budget on key screens.
- [ ] Unit, widget, golden and at least one integration test run in CI.
- [ ] Accessibility guideline checks pass; screen readers tested on the main journey.
- [ ] Release builds are reproducible from documented commands; store uploads were confirmed by the user.

## Related

- Knowledge: `accessibility-a11y`, `api-design`, `auth-patterns`, `ci-cd-github-actions`, `cloud-devops`, `tdd-testing`.
- Workflows: `/feature-dev`, `/tdd`, `/e2e`, `/build-fix`, `/verify`.
- Agents: `accessibility-auditor`, `performance-optimizer`, `test-engineer`, `code-reviewer`.
