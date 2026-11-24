---
name: mobile-performance
disable-model-invocation: true
description: >-
  Diagnoses and fixes mobile app performance on Android and iOS, including
  Flutter and React Native: cold and warm startup, jank and dropped frames,
  ANRs and hangs, memory growth and leaks, battery drain and app size, using
  field vitals, Perfetto, Android Studio profilers, Macrobenchmark, Baseline
  Profiles, Instruments and MetricKit. Use when an app starts slowly, scrolls
  with jank, is killed in the background or drains battery.
---

# Mobile Performance

Start from field data, reproduce on a slow device in a release build, fix the
biggest measured cost, and prove the win with the same measurement. Mobile
performance problems are mostly main-thread work, unbounded memory and
background activity, and they are invisible in debug builds on flagship phones.

## When to use

- Users or store vitals report slow startup, jank, ANRs, hangs, crashes from memory pressure, or battery drain.
- Before a launch, to set budgets and a regression guard.
- After adding a heavy SDK, a new list screen, or background work.

## When not to use

- Web page performance: use `web-performance`. Server latency: use `profiling` or `/perf-audit`.
- General leak-hunting technique across runtimes: use `memory-leaks`.
- Framework-specific structure: use `android-jetpack-compose`, `ios-app-development`, `react-native-expo` or `flutter-mobile`, then return here to measure.

## Workflow

1. **Read field data and set budgets.** Google Play Android vitals, Xcode Organizer (launch, hangs, memory, energy), MetricKit payloads, and Firebase Performance Monitoring or Crashlytics. Write budgets per metric into the plan (see Reference).

   **Check:** The plan names the worst metric, the affected devices and OS versions, and a numeric target.

2. **Reproduce realistically.** A low or mid-tier device, release or profile build (`flutter run --profile`; React Native release variant; Android release with R8), production-like data, and a clean install for startup tests.

   **Check:** The local measurement is within roughly 20 percent of the field percentile you are chasing.

3. **Measure startup.**

   ```bash
   adb shell am force-stop com.example.app
   adb shell am start -W -n com.example.app/.MainActivity   # prints TotalTime and WaitTime
   ```

   Automate with Jetpack Macrobenchmark (`StartupTimingMetric`, cold mode). On iOS, an XCTest with `measure(metrics: [XCTApplicationLaunchMetric()]) { XCUIApplication().launch() }`. Fix by deferring SDK initialization, removing disk and network work from the main thread before first frame, shipping a Baseline Profile (Android), reducing dynamic frameworks (iOS) and simplifying the first screen.

   **Check:** Median and p90 cold start over at least 10 runs beat the baseline.

4. **Find jank.** Record a system trace (Perfetto or the Android Studio CPU profiler; Instruments with Time Profiler and Animation Hitches). Quick Android stats:

   ```bash
   adb shell dumpsys gfxinfo com.example.app reset
   # scroll the screen for 10 seconds
   adb shell dumpsys gfxinfo com.example.app             # janky frame percentage and percentiles
   ```

   Look for long main-thread slices: layout, image decoding, JSON parsing, database reads, excessive recomposition or rebuilds, JS-thread stalls.

   **Check:** The trace attributes each long frame to a named function or phase.

5. **Remove ANRs and hangs.** Enable `StrictMode` (disk and network on main thread) in debug builds; move I/O to background dispatchers or queues; avoid locks shared with the main thread. Use Organizer hang reports and MetricKit hang diagnostics on iOS.

   **Check:** StrictMode is silent through the core flows, and no main-thread slice exceeds the hang threshold.

6. **Bound memory.** `adb shell dumpsys meminfo com.example.app`, Android Studio heap dumps and LeakCanary in debug builds; Xcode Memory Graph Debugger and Instruments Allocations and Leaks on iOS. Size images to their views, cap caches, and release listeners.

   **Check:** Memory returns to its baseline after entering and leaving the heaviest screen 20 times.

7. **Cut battery and network cost.** Batch requests, prefer push over polling, schedule deferrable work with WorkManager or `BGTaskScheduler` constraints, reduce location accuracy and background use, release wake locks. Use `adb shell dumpsys batterystats com.example.app` and the Xcode energy reports.

   **Check:** No wake ups or network calls while the app is idle in the background beyond what the plan allows.

8. **Shrink the app.** Android: App Bundle, `isMinifyEnabled = true` and `isShrinkResources = true`, Analyze APK. iOS: App Thinning size report from export, asset catalogs, remove unused architectures and resources.

   **Check:** Download size is recorded per release and has not grown without a reason.

9. **Guard against regressions.** Run Macrobenchmarks and XCTest metrics on physical devices in CI or a device lab (for example Firebase Test Lab), store results, and fail on a set threshold. Delegate a deep trace analysis to the `performance-optimizer` subagent with the trace and the budget.

   **Check:** A deliberate regression in a test branch fails the performance job.

## Reference

### Budgets and vitals thresholds (verify current values)

| Metric | Typical target | Store "bad behaviour" signal |
| :--- | :--- | :--- |
| Cold start | under 1.5 to 2 s on mid-tier | Android vitals flags cold starts of 5 s or more |
| Frame time | 16.7 ms at 60 Hz, 11.1 ms at 90 Hz, 8.3 ms at 120 Hz | Slow frames over 16 ms; frozen frames over 700 ms |
| ANR | Zero in core flows | User-perceived ANR rate around 0.47 percent |
| Crash rate | As low as possible | User-perceived crash rate around 1.09 percent |
| Memory | Stable across navigation | iOS jetsam and Android low-memory kills in field data |

### Framework hot spots

| Stack | Usual causes | Tools and fixes |
| :--- | :--- | :--- |
| Jetpack Compose | Unstable parameters, missing list keys, early state reads | Layout Inspector recomposition counts, Baseline Profiles, lambda modifiers |
| SwiftUI | Large `body` recomputation, broad observation | `Self._printChanges()` in debug, granular `@Observable` models, `LazyVStack` |
| Flutter | Rebuilding large subtrees, `saveLayer` and opacity, raster-thread spikes | DevTools Performance view, `const` widgets, `RepaintBoundary`, builder lists |
| React Native | JS thread blocked, list re-renders, heavy bridge traffic | Hermes profiler, `FlashList`, Reanimated worklets |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Measure debug builds on a flagship phone | Release or profile build on a mid or low-tier device | Debug overhead and fast hardware hide real costs |
| Report average frame rate | p90 and p99 frame time plus janky-frame percentage | Users feel the spikes, not the mean |
| Initialize every SDK in `Application.onCreate` or app launch | Lazy or deferred initialization | Each SDK adds to every cold start |
| Decode full-size images for thumbnails | Decode at view size off the main thread | Memory spikes and jank |
| Poll the server in the background | Push messages or scheduled, constrained work | Battery drain and OS throttling |
| Fix without a before-and-after number | Same measurement, same device, before and after | Unmeasured fixes often do nothing |

## Verification checklist

- [ ] Field data identified the target metric, devices and a numeric budget.
- [ ] Measurements used release or profile builds on representative devices.
- [ ] Each fix has before-and-after numbers from the same method.
- [ ] Main thread is free of disk and network work in core flows.
- [ ] Memory returns to baseline after repeated navigation.
- [ ] A CI or device-lab benchmark guards startup and frame time.

## Related

- Workflows: `/perf-audit`, `/verify`, `/root-cause`.
- Knowledge: `android-jetpack-compose`, `ios-app-development`, `react-native-expo`, `flutter-mobile`, `profiling`, `memory-leaks`, `web-performance`.
- Agents: `performance-optimizer`, `mobile-engineer`.
