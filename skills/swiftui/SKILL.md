---
name: swiftui
disable-model-invocation: true
description: >-
  Builds and reviews SwiftUI apps: state ownership with @State, @Binding and
  the @Observable macro (and the older ObservableObject wrappers), environment
  injection, NavigationStack and value-based routing, sheets, layout and lists,
  #Preview, .task lifetimes, view-model and UI testing, and diagnosing slow or
  over-rendering views. Use when creating SwiftUI screens, fixing state or
  navigation bugs, or speeding up SwiftUI on Apple platforms.
---

# SwiftUI

A SwiftUI view is a function of state. Most bugs come from state owned in the
wrong place or identity that changes when it should not. Decide who owns each
piece of state, pass the narrowest dependency down, and keep `body` cheap.

## When to use

- Building or refactoring SwiftUI screens, components or app structure.
- State that resets unexpectedly, does not update, or updates too often.
- Navigation: stacks, deep links, split views, sheets and alerts.
- Slow scrolling, janky animations or views that re-render on unrelated changes.
- Adding previews, view-model tests or UI tests.

## When not to use

- Async work, actors and Sendable errors: use `swift-concurrency`.
- App-level architecture, persistence, push and signing: use `ios-app-development`.
- Store submission and review: use `app-store-release`.
- Cross-platform mobile UI: use `flutter-mobile` or `react-native-expo`.

## Workflow

1. **Check deployment targets first.** The `@Observable` macro, `#Preview` and many modifiers depend on OS versions. Read the deployment target in the project or `Package.swift` platforms.

   ```bash
   grep -rn "IPHONEOS_DEPLOYMENT_TARGET\|MACOSX_DEPLOYMENT_TARGET" --include=project.pbxproj . | sort -u
   grep -n "platforms" Package.swift
   ```

   **Check:** You know the minimum OS. `@Observable` requires iOS 17 / macOS 14 or later; below that use `ObservableObject`. Building and running requires macOS with Xcode; on Windows or Linux you can edit and review only.

2. **Decide state ownership.** Use the table below. Exactly one view owns each source of truth; children get a `Binding`, a plain value or the observable object.

   **Check:** No view creates an observable object in a stored property initializer without `@State` (or `@StateObject` on older targets).

3. **Model navigation as data.** Use `NavigationStack(path:)` with a `Hashable` route enum and `.navigationDestination(for:)`. Keep the path in an owned router object so deep links and state restoration can set it. Present sheets with `.sheet(item:)` bound to optional state.

   **Check:** A deep link can be handled by appending to the path, with no view-hierarchy hacks.

4. **Load data with view lifetimes.** Use `.task { }` (cancelled when the view disappears) or `.task(id: query) { }` (restarted when `query` changes) instead of `onAppear` plus an unstructured `Task`.

   **Check:** Navigating away cancels in-flight loads, and changing the input restarts them.

5. **Write previews for every state.** Add `#Preview` blocks for loading, empty, error and populated states, with in-memory fakes injected through the environment or initializers.

   **Check:** Each preview renders without network access or real persistence.

6. **Test logic outside views.** Put decisions in observable models or plain types and unit test them with Swift Testing or XCTest. Use XCUITest for a few critical flows, locating elements with `.accessibilityIdentifier`.

   ```bash
   xcrun simctl list devices available            # pick an installed simulator name
   xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=<device>'
   ```

   **Check:** Model tests run without launching a simulator; UI tests cover the main happy path.

7. **Profile when it feels slow.** Temporarily add `let _ = Self._printChanges()` inside `body` to see why a view re-renders, then use the SwiftUI template in Instruments. Fix identity and dependency width before micro-optimizing.

   **Check:** Scrolling a long list or typing in a field does not re-render unrelated views.

## Patterns

### Who owns state

| Need | iOS 17+ (Observation) | Older targets |
| :--- | :--- | :--- |
| Value owned by this view | `@State var text = ""` | `@State` |
| Write access to a parent's value | `@Binding var text: String` | `@Binding` |
| Reference model owned by this view | `@State private var model = Model()` | `@StateObject private var model = Model()` |
| Model passed in, read only | `let model: Model` (tracked automatically) | `@ObservedObject var model: Model` |
| Bindings into a passed-in model | `@Bindable var model: Model` | `@ObservedObject` then `$model.field` |
| App-wide dependency | `.environment(model)` and `@Environment(Model.self)` | `.environmentObject(model)` and `@EnvironmentObject` |

With `@Observable`, views re-render only when properties they read in `body`
change, so pass models down freely but read narrowly.

### Observable model and value-based navigation

```swift
import Observation
import SwiftUI

enum Route: Hashable { case detail(Item.ID), settings }

@Observable @MainActor
final class AppModel {
    var path: [Route] = []
    var items: [Item] = []
    var loadError: String?

    func load(using api: ItemsAPI) async {
        do { items = try await api.fetchItems() }
        catch is CancellationError { }
        catch { loadError = error.localizedDescription }
    }
}

struct RootView: View {
    @State private var model = AppModel()
    @Environment(\.itemsAPI) private var api

    var body: some View {
        NavigationStack(path: $model.path) {
            List(model.items) { item in
                NavigationLink(item.title, value: Route.detail(item.id))
            }
            .navigationDestination(for: Route.self) { route in
                switch route {
                case .detail(let id): DetailView(id: id)
                case .settings: SettingsView()
                }
            }
            .task { await model.load(using: api) }
        }
    }
}

#Preview { RootView().environment(\.itemsAPI, .fake) }
```

`\.itemsAPI` is a custom environment value; define it with an `EnvironmentKey`
or the `@Entry` macro where your toolchain supports it.

### Layout and lists

- Prefer stacks, `Grid`, `ViewThatFits` and the `Layout` protocol; use `GeometryReader` only when you truly need the proposed size.
- Give `ForEach`/`List` stable identifiers (`Identifiable` with persistent IDs), never array indices for mutable collections.
- Use `LazyVStack`/`LazyVGrid` inside `ScrollView` for long content; `List` is already lazy.
- Keep `body` free of formatting, sorting and filtering on large collections; compute in the model and cache.
- Support Dynamic Type and add `.accessibilityLabel` to icon-only buttons.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `@ObservedObject var model = Model()` | `@StateObject` (or `@State` with `@Observable`) | Recreated on every parent re-render, losing state |
| Mirror a parent's value into child `@State` | Pass a `Binding` or a plain value | Two sources of truth drift apart |
| `.id(UUID())` or index-based IDs | Stable model IDs | Identity changes reset state and kill animations |
| Heavy work or network calls in `body` or `init` | `.task` and models | `body` and `init` run many times |
| `onAppear { Task { ... } }` | `.task { }` or `.task(id:)` | Automatic cancellation and restart |
| One giant view with many `@State` vars | Small subviews that take only the data they read | Narrower invalidation and simpler previews |
| `AnyView` to unify branches | `@ViewBuilder`, `Group` or generics | Type erasure defeats diffing |

## Verification checklist

- [ ] Every source of truth has one owner; children receive bindings or values.
- [ ] Navigation is driven by a route value and supports deep links.
- [ ] Async loading uses `.task`/`.task(id:)` and handles cancellation.
- [ ] Previews cover loading, empty, error and populated states with fakes.
- [ ] Model logic is unit tested; critical flows have UI tests with accessibility identifiers.
- [ ] No unexpected re-renders on scroll or typing, checked with `_printChanges` or Instruments.

## Related

- Workflows: `/tdd`, `/verify`, `/code-review`, `/a11y-audit`, `/ui-polish`.
- Knowledge: `swift-concurrency`, `ios-app-development`, `mobile-performance`, `app-store-release`, `accessibility-a11y`.
- Agents: `swift-reviewer`, `mobile-engineer`, `mobile-build-resolver`, `accessibility-auditor`.
