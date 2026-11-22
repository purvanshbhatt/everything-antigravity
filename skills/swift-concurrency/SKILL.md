---
name: swift-concurrency
description: >-
  Applies Swift structured concurrency correctly: async/await, async let and
  task groups, cancellation, actors and reentrancy, MainActor isolation,
  Sendable and sending, continuations around callback APIs, AsyncStream, and a
  staged migration to Swift 6 strict data-race checking. Use when writing async
  Swift, fixing Sendable or isolation errors, adopting the Swift 6 language
  mode, or debugging races and UI-thread violations.
---

# Swift Concurrency

Let the compiler prove the absence of data races: give every piece of mutable
state one isolation domain (an actor, the main actor, or a single task), pass
only `Sendable` values across domains, and keep work structured so cancellation
and errors flow to the caller.

## When to use

- Writing `async` functions, task groups, actors or `AsyncSequence` pipelines.
- Compiler errors about `Sendable`, actor isolation or "main actor-isolated property".
- Migrating a module or app target to the Swift 6 language mode or complete checking.
- Bridging completion-handler, delegate or Combine APIs into async code.
- Intermittent crashes or UI updates off the main thread.

## When not to use

- View state, Observation and navigation: use `swiftui`.
- App architecture, persistence, push and signing: use `ios-app-development`.
- Concurrency debugging techniques across languages: use `concurrency-bugs`.
- Swift build or signing failures: delegate to the `mobile-build-resolver` agent.

## Workflow

1. **Find the current checking level.** Read `Package.swift` (`swift-tools-version`, `swiftSettings`) or the Xcode build settings `SWIFT_VERSION` and `SWIFT_STRICT_CONCURRENCY`.

   ```bash
   swift --version
   grep -n "swift-tools-version\|swiftLanguageMode\|StrictConcurrency\|enableUpcomingFeature" Package.swift
   grep -rn "SWIFT_VERSION\|SWIFT_STRICT_CONCURRENCY" --include=project.pbxproj .
   ```

   **Check:** You know, per target, whether it builds in Swift 5 mode (minimal, targeted or complete checking) or Swift 6 mode.

2. **Map isolation before writing code.** For each type with mutable state, decide its domain: `@MainActor` for UI-facing state, a custom `actor` for shared mutable state, or a value type owned by one task. Record the map in the implementation plan artifact.

   **Check:** No class with mutable state is shared across tasks without an actor or a lock.

3. **Write structured code first.** Use `async let` for a fixed number of concurrent calls and `withThrowingTaskGroup` for a dynamic number. Use `Task {}` only at boundaries (a button action, `.task` in SwiftUI) and keep its handle if it must be cancelled. Avoid `Task.detached` unless you need to shed the current actor and task-local values.

   **Check:** Every unstructured `Task` has an owner that cancels it, or a comment saying why it may outlive its caller.

4. **Make cancellation work.** Cancellation is cooperative: call `try Task.checkCancellation()` in loops and before expensive steps, and use `withTaskCancellationHandler` to cancel underlying callback work.

   **Check:** A test cancels the operation mid-way and observes `CancellationError` (or a partial result) promptly.

5. **Handle actor reentrancy.** Every `await` inside an actor is a suspension point where other calls can run and change state. Re-check invariants after each `await`, and deduplicate in-flight work by storing a `Task` in the actor.

   **Check:** No actor method reads state, awaits, then writes based on the stale read.

6. **Migrate in stages.** Per module: enable complete checking in Swift 5 mode, fix the warnings, then switch the module to Swift 6 mode. Start from leaf modules. Use `@preconcurrency import` for dependencies that are not yet annotated, and remove it when they are.

   ```swift
   // Package.swift, swift-tools-version 6.0 or later: Swift 6 mode is the default.
   .target(name: "Legacy", swiftSettings: [.swiftLanguageMode(.v5),
                                           .enableUpcomingFeature("StrictConcurrency")])
   ```

   Xcode: set Strict Concurrency Checking to Complete, then Swift Language Version to 6. Swift 6.2 adds opt-in "approachable concurrency" settings, such as default `MainActor` isolation and `nonisolated(nonsending)`/`@concurrent`; verify their names and behaviour against the current Swift docs before enabling them. **Check:** The module builds in Swift 6 mode with no new `@unchecked Sendable` or `nonisolated(unsafe)` added without a written justification.

7. **Test under Thread Sanitizer.** `swift test --sanitize=thread`, or enable Thread Sanitizer in the Xcode scheme's Diagnostics. Swift packages also build and test on the Linux and Windows toolchains.

   **Check:** The async test suite passes with TSan enabled and no warnings.

## Patterns

### Structured fan-out with a concurrency limit

```swift
func thumbnails(for urls: [URL], maxConcurrent: Int = 4) async throws -> [URL: Image] {
    try await withThrowingTaskGroup(of: (URL, Image).self) { group in
        var results: [URL: Image] = [:]
        var iterator = urls.makeIterator()
        for _ in 0..<maxConcurrent {
            guard let url = iterator.next() else { break }
            group.addTask { (url, try await loadThumbnail(url)) }
        }
        while let (url, image) = try await group.next() {
            results[url] = image
            if let next = iterator.next() {
                group.addTask { (next, try await loadThumbnail(next)) }
            }
        }
        return results
    }
}
```

The group cancels the remaining children if one throws.

### Actor with in-flight deduplication

```swift
actor ImageCache {
    private var cache: [URL: Image] = [:]
    private var inFlight: [URL: Task<Image, Error>] = [:]

    func image(for url: URL) async throws -> Image {
        if let cached = cache[url] { return cached }
        if let task = inFlight[url] { return try await task.value }
        let task = Task { try await download(url) }
        inFlight[url] = task
        defer { inFlight[url] = nil }
        let image = try await task.value      // suspension: state may change here
        cache[url] = image
        return image
    }
}
```

### Bridging a callback API

```swift
func currentLocation() async throws -> Location {
    try await withCheckedThrowingContinuation { continuation in
        locator.request { result in continuation.resume(with: result) }  // resume exactly once
    }
}
```

A checked continuation traps if resumed twice and logs if never resumed. For
streams of values, use `AsyncStream.makeStream(of:)` and set
`continuation.onTermination` to stop the producer.

### Sendable decisions

| Type | Make it safe by |
| :--- | :--- |
| Struct or enum of `Sendable` fields | Nothing; it is inferred `Sendable` when not public, declare it when public |
| Final class with only `let` `Sendable` properties | Mark `final class X: Sendable` |
| Class with mutable state | Convert to an actor, isolate to `@MainActor`, or protect with a lock and mark `@unchecked Sendable` with a comment |
| Non-Sendable value handed off once | Use a `sending` parameter or result (Swift 6) so the compiler checks the transfer |
| Closure crossing domains | `@Sendable` closure that captures only `Sendable` values |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `DispatchQueue.main.async` inside async code | `@MainActor` functions or `await MainActor.run` | The compiler cannot check GCD hops |
| `@unchecked Sendable` to silence errors | Fix the isolation, or add a real lock and document it | Hides real races from the checker |
| `Task.detached` by default | Structured tasks, or plain `Task` at a boundary | Loses priority, task locals and cancellation |
| Fire-and-forget `Task {}` in view models | Store the handle and cancel on teardown, or use SwiftUI `.task` | Leaks work and updates stale state |
| Blocking with semaphores to wait for async work | `await` the work; restructure callers to be async | Can deadlock the cooperative thread pool |
| Assuming actor state is unchanged after `await` | Re-read and re-validate after each suspension | Reentrancy interleaves other calls |
| Global mutable `var` | Isolate it to an actor or `@MainActor`, or make it a `let` | Swift 6 rejects unsafe globals |

## Verification checklist

- [ ] Every mutable shared type has a clear isolation domain.
- [ ] Unstructured tasks have owners and are cancelled on teardown.
- [ ] Long operations check cancellation, and a test proves it.
- [ ] Actor methods re-validate state after each `await`.
- [ ] Each `@unchecked Sendable`, `nonisolated(unsafe)` and `@preconcurrency` has a justification comment.
- [ ] The target builds with complete checking or in Swift 6 mode, and tests pass under Thread Sanitizer.

## Related

- Workflows: `/build-fix`, `/code-review`, `/verify`, `/tdd`.
- Knowledge: `swiftui`, `ios-app-development`, `concurrency-bugs`, `kotlin-coroutines`, `mobile-performance`.
- Agents: `swift-reviewer`, `mobile-build-resolver`, `mobile-engineer`.
