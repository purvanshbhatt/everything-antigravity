---
trigger: glob
globs: "**/*.swift"
description: Swift conventions
---

# Swift

## Tooling

- Build and test with the project's entry point: `swift build` / `swift test` for packages, or `xcodebuild test -scheme <Scheme> -destination '<dest>'` for apps. Lint with SwiftLint or swift-format if configured.
- Respect the Swift language mode and deployment targets in `Package.swift` or the project; do not raise them as a side effect.

## Safety

- No force unwrap (`!`), `try!` or `as!` in production code. Use `guard let`, `if let`, `??` or throw. Exceptions: `IBOutlet`s and tests.
- `let` over `var`. Prefer value types (`struct`, `enum`); mark classes `final` unless designed for inheritance.
- Model errors as `enum` types conforming to `Error`, with associated values for context. Use `throws` / typed throws; do not hide meaningful failures with `try?`.
- Keep access control tight: `private` by default, `internal` for module use, `public` only for the intended API.
- Use `precondition` for programmer errors that must hold in release builds; `assert` is debug-only.

## Concurrency

- Use Swift concurrency (`async`/`await`, actors, `TaskGroup`, `async let`) for new code, not completion handlers or `DispatchQueue` chains.
- Under strict concurrency checking, fix `Sendable` warnings properly; do not silence them with `@unchecked Sendable` or `nonisolated(unsafe)` without a written invariant.
- UI state and UI calls are `@MainActor`. Protect shared mutable state with an actor.
- Unstructured `Task { }` must be stored and cancelled when the owner goes away. Check `Task.isCancelled` or call `try Task.checkCancellation()` in long loops.

## Memory

- Use `[weak self]` in escaping closures stored by long-lived objects (timers, notification observers, stored callbacks). Delegates are `weak var`.
- Avoid retain cycles between view models and services; verify with the Memory Graph debugger when in doubt.

## SwiftUI

- Keep views small and `body` cheap: no I/O, sorting large data or formatting in a loop inside `body`.
- `@State` is `private` and owned by the view. Use `@Observable` (iOS 17+/macOS 14+) or `ObservableObject` per the deployment target; do not mix both in one feature.
- Pass dependencies explicitly or through `@Environment`; avoid singletons for testable logic.
- Support Dynamic Type, provide `accessibilityLabel` for image-only controls, and avoid fixed frames for text.

## Data and security

- Store secrets and tokens in the Keychain, never in `UserDefaults`, plists or source.
- Decode network data with `Codable` into typed models; handle decoding errors explicitly.
- Log with `Logger` (OSLog) and mark dynamic values `privacy: .private` when they could contain personal data. No `print` in shipping code.

## Tests

- Use Swift Testing (`@Test`, `#expect`, `#require`) or XCTest, matching the project.
- `async` tests await results directly; no `sleep` or arbitrary expectations timeouts as synchronization.
- Inject protocols for network, clock and storage to keep tests deterministic.
