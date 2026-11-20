---
trigger: glob
globs: "**/*.dart"
description: Dart and Flutter conventions
---

# Dart and Flutter

## Tooling

- Code must pass `dart format .` and `flutter analyze` (or `dart analyze`) with zero issues under the project's lint set (`flutter_lints`, `very_good_analysis` or custom `analysis_options.yaml`). Do not add `// ignore:` without a reason.
- Respect the SDK constraint in `pubspec.yaml`. Run `flutter pub get` after dependency changes, and `dart run build_runner build --delete-conflicting-outputs` when codegen (freezed, json_serializable) is used. Never hand-edit generated `*.g.dart` / `*.freezed.dart` files.

## Language

- Sound null safety: avoid `!`; use `?.`, `??`, pattern matching or early returns. Use `late` only when initialization is guaranteed before use.
- `final` locals and fields by default; `const` constructors and literals wherever possible.
- Immutable models with `copyWith`, value equality (freezed or `==`/`hashCode`), and `sealed` classes with exhaustive `switch` for state.
- Mark intentional fire-and-forget futures with `unawaited(...)`; otherwise await every future (`unawaited_futures` lint).
- Catch specific exceptions (`on FormatException catch (e)`); never `catch (_) {}` silently.

## Widgets

- Keep `build` pure and cheap: no I/O, no heavy computation, no object creation that triggers rebuild churn.
- Split large widgets into small `StatelessWidget` classes, not private methods returning widgets, so they can be `const` and rebuild independently.
- Keep business logic out of widgets. Follow the state management already in the project (BLoC, Riverpod, Provider); do not introduce a second one.
- After any `await` in a `State` or with a `BuildContext`, check `if (!context.mounted) return;` (or `mounted`) before using the context.
- Dispose everything you create in `State`: `TextEditingController`, `AnimationController`, `ScrollController`, `FocusNode`, `StreamSubscription`.
- Use `ListView.builder` / `SliverList` for long or unbounded lists, and give list items stable `Key`s when they reorder.

## Layout and accessibility

- No hard-coded screen sizes. Use `LayoutBuilder`, `MediaQuery.sizeOf(context)`, `Flexible`/`Expanded`, and test with large text scale.
- Provide `Semantics` labels or `tooltip`s for icon-only buttons, and keep tap targets at least 48x48 logical pixels.
- Use theme values (`Theme.of(context).colorScheme`, `textTheme`) instead of literal colors and font sizes.

## Platform and security

- Secrets never go in Dart code or `--dart-define`; compiled apps can be decompiled. Use a backend or secure storage (`flutter_secure_storage`) for user tokens.
- Validate and type all JSON from the network into models; never pass raw `Map<String, dynamic>` through the app.

## Tests

- Unit tests for logic, widget tests with `pumpWidget` and `find`, golden tests where the project uses them, `integration_test` for flows.
- Use `pumpAndSettle` or explicit `pump(duration)`, never real delays; fake clocks with `fake_async` where needed.
- Run one file: `flutter test test/feature/foo_test.dart`.
