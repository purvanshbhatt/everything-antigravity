---
name: kotlin-multiplatform
description: >-
  Structures Kotlin Multiplatform projects: targets and source-set hierarchy,
  expect/actual versus interfaces, shared networking, serialization and
  persistence libraries, Compose Multiplatform UI, and iOS interop through
  frameworks, XCFrameworks and Swift Package Manager, including Swift-friendly
  coroutine and Flow wrappers. Use when sharing Kotlin between Android, iOS,
  desktop or web, or when Swift callers struggle with Kotlin APIs.
---

# Kotlin Multiplatform

Share the code that should be identical everywhere (domain rules, networking,
persistence, validation) and keep platform code thin and explicit. The two
failure modes are sharing too little to pay for the build complexity and
exporting Kotlin APIs that are painful to call from Swift.

## When to use

- Sharing business logic between an Android app and an iOS app, optionally desktop or web.
- Adding Compose Multiplatform UI to share screens as well as logic.
- Designing the API surface that Swift code consumes, or fixing awkward Swift interop.
- Setting up iOS framework distribution (direct embed, XCFramework, SPM).

## When not to use

- Android-only apps: use `android-jetpack-compose`. iOS-only apps: use `ios-app-development`.
- Kotlin idioms in general: use `kotlin-patterns`. Coroutine and Flow design: use `kotlin-coroutines`.
- Cross-platform apps with a JavaScript team: compare `react-native-expo` and `flutter-mobile` first.

## Workflow

1. **Decide what to share.** List modules as shared (domain, data, networking, validation), maybe shared (view models, UI through Compose Multiplatform) and platform-only (platform SDKs, widgets, push handling). Record the decision and the iOS team's sign-off in an implementation plan artifact.

   **Check:** Every shared module has a named owner on both platform teams.

2. **Configure targets and source sets.** Use the default hierarchy template, which creates `commonMain`, `appleMain`, `iosMain` and friends automatically. Drop `iosX64()` if nobody builds on Intel Macs, and check current target support tiers.

   ```bash
   ./gradlew :shared:allTests                              # PowerShell: .\gradlew.bat :shared:allTests
   ./gradlew :shared:iosSimulatorArm64Test                 # macOS only
   ./gradlew :shared:linkDebugFrameworkIosSimulatorArm64
   ```

   **Check:** `allTests` passes, including at least one native iOS test run on macOS CI.

3. **Abstract platform differences.** Prefer interfaces in `commonMain` with implementations injected per platform (Koin or constructor injection). Use `expect fun` or `expect val` for small leaf functions. Treat `expect class` as a last resort (still Beta; verify status).

   **Check:** `commonMain` compiles without any platform import, and fakes of each interface exist in `commonTest`.

4. **Pick multiplatform libraries.** Ktor client (OkHttp engine on Android, Darwin on iOS), kotlinx.serialization, kotlinx.coroutines, kotlinx-datetime, SQLDelight or Room (KMP support in recent versions), DataStore for preferences. Verify each library's supported targets before adding it.

   **Check:** Every dependency in `commonMain` publishes artifacts for all declared targets.

5. **Design the Swift-facing API.** Expose a small facade, not every class. Flows and sealed hierarchies are the pain points (table below); add SKIE or KMP-NativeCoroutines, or write callback wrappers. Annotate functions that can fail with `@Throws(SomeException::class)`, because an undeclared Kotlin exception crashes the iOS app.

   **Check:** An iOS developer can call the facade with `async`/`await` and an exhaustive `switch` without casting.

6. **Choose iOS distribution.** Same-repo apps embed the framework with the `embedAndSignAppleFrameworkForXcode` Gradle task in an Xcode build phase. Separate repos consume an XCFramework, ideally as an SPM binary target. Treat CocoaPods integration as legacy for new projects.

   **Check:** A clean Xcode build on CI links the shared framework without manual steps.

7. **Add shared UI only if it pays.** Compose Multiplatform lets `commonMain` hold screens; iOS hosts them with `ComposeUIViewController { App() }`. Check iOS stability and accessibility support for your version in current docs, and keep platform-native screens where users expect native behaviour.

   **Check:** Shared screens pass VoiceOver and TalkBack smoke tests and match platform navigation conventions.

## Patterns

### Shared module build file

```kotlin
kotlin {
    androidTarget()
    listOf(iosArm64(), iosSimulatorArm64()).forEach {
        it.binaries.framework { baseName = "Shared"; isStatic = true }
    }
    jvm("desktop")

    sourceSets {
        commonMain.dependencies {
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.ktor.client.core)
        }
        androidMain.dependencies { implementation(libs.ktor.client.okhttp) }
        iosMain.dependencies { implementation(libs.ktor.client.darwin) }
        commonTest.dependencies { implementation(kotlin("test")) }
    }
}
```

### Interface first, `expect` for leaves

```kotlin
// commonMain
interface SecureStore { fun put(key: String, value: String); fun get(key: String): String? }
expect fun platformName(): String

// androidMain
actual fun platformName(): String = "Android ${android.os.Build.VERSION.SDK_INT}"

// iosMain
actual fun platformName(): String =
    UIDevice.currentDevice.systemName() + " " + UIDevice.currentDevice.systemVersion
```

`SecureStore` gets a Keystore-backed implementation in `androidMain` and a Keychain-backed one in `iosMain`, both injected at app start.

### Swift interop pain points

| Kotlin construct | What Swift sees | Fix |
| :--- | :--- | :--- |
| `suspend fun` | Completion handler or `async` function | Fine for one-shot calls; add `@Throws` for errors |
| `Flow<T>` | An opaque object with no Swift `AsyncSequence` | SKIE, KMP-NativeCoroutines or a callback wrapper with cancel |
| `sealed class` | Class hierarchy, non-exhaustive `switch` | SKIE enums, or a `when`-based visitor in Kotlin |
| Default arguments | Must pass every argument | Overloads or builder for Swift callers |
| Generic interfaces | Type erasure through Objective-C headers | Concrete facade types |
| Unchecked exception | App crash | `@Throws` on every throwing public function |

Swift export (direct Kotlin to Swift without Objective-C headers) is experimental; check its status before relying on it.

### iOS integration options

| Option | Use when |
| :--- | :--- |
| Direct framework via `embedAndSignAppleFrameworkForXcode` | Monorepo, one team, fast iteration |
| XCFramework as SPM binary target | Separate iOS repo, versioned releases |
| CocoaPods plugin | Existing Pods-based apps only |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `expect class` for every platform service | Interface plus injected implementations | Easier to fake, fewer Beta features |
| Export the whole shared module to Swift | A small, Swift-shaped facade | Huge headers, slow builds, confusing API |
| Hand raw `Flow` to Swift | Wrapper or interop plugin | Swift cannot collect or cancel it idiomatically |
| Run tests only on the JVM | Also run iOS native tests on macOS CI | Threading, formatting and memory behave differently on Kotlin/Native |
| One giant `shared` module | Feature modules with an umbrella export | Faster incremental builds and clearer ownership |
| Share UI by default | Share logic first, UI where the product allows | Users notice non-native behaviour |

## Verification checklist

- [ ] The sharing decision is documented and agreed by both platform teams.
- [ ] `commonMain` has no platform imports, and platform services sit behind interfaces.
- [ ] Every `commonMain` dependency supports all declared targets.
- [ ] Swift callers use a facade with `async` calls, exhaustive switches and `@Throws` errors.
- [ ] `allTests` runs on CI, including native iOS tests on macOS.
- [ ] Xcode builds link the shared framework with no manual steps.

## Related

- Workflows: `/feature-dev`, `/verify`, `/blueprint`.
- Knowledge: `kotlin-patterns`, `kotlin-coroutines`, `android-jetpack-compose`, `ios-app-development`, `swiftui`, `ktor-server`.
- Agents: `kotlin-reviewer`, `swift-reviewer`, `mobile-engineer`, `mobile-build-resolver`.
