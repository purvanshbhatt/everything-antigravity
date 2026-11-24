---
name: react-native-expo
disable-model-invocation: true
description: >-
  Builds and ships React Native apps with Expo: project setup, Expo Router
  navigation and deep links, development builds, config plugins and native
  modules, EAS Build and Submit, EAS Update over-the-air releases with runtime
  versions, secure storage, list and animation performance, and testing. Use
  when starting or maintaining an Expo app, adding a native dependency,
  setting up EAS, or fixing slow screens.
---

# React Native with Expo

Ship one TypeScript codebase to iOS and Android with Expo tooling while keeping
native escape hatches open. The expensive mistakes are hand-edited native
folders that prebuild overwrites, OTA updates sent to incompatible binaries,
and secrets embedded in the JavaScript bundle.

## When to use

- Creating an app with `create-expo-app`, or adopting Expo tooling in an existing React Native app.
- Adding navigation, a native SDK, permissions, deep links or notifications.
- Setting up EAS Build, EAS Submit or EAS Update channels for development, preview and production.
- Lists stutter, startup is slow, or animations drop frames.

## When not to use

- Flutter apps: use `flutter-mobile`. Fully native apps: use `android-jetpack-compose` or `ios-app-development`.
- Store listings, review and staged rollouts: use `app-store-release`.
- Deep cross-platform profiling (Perfetto, Instruments): use `mobile-performance`.
- Web-only React concerns: use `react-patterns`.

## Workflow

1. **Create or audit the project.**

   ```bash
   npx create-expo-app@latest my-app   # TypeScript + Expo Router template
   cd my-app
   npx expo start                      # press a / i, or scan the QR code
   npx expo-doctor                     # dependency and config health check
   ```

   Add libraries with `npx expo install <pkg>`, not a plain `npm install`, so versions match the SDK. Read the Expo SDK changelog before any SDK upgrade (React Native and New Architecture defaults move with it; verify against current docs).

   **Check:** `npx expo-doctor` passes and the app opens on one Android and one iOS target.

2. **Adopt Continuous Native Generation.** Keep `android/` and `ios/` out of git and express every native change in `app.config.ts` and config plugins. Regenerate with `npx expo prebuild --clean`. Write custom native code as an Expo module (`npx create-expo-module`) instead of patching generated folders.

   **Check:** A clean clone followed by `npx expo prebuild` produces a working build.

3. **Move to a development build** as soon as you need a native module that Expo Go lacks: `npx expo install expo-dev-client`, then `npx expo run:android` or `npx expo run:ios` (iOS needs macOS and Xcode), or `eas build --profile development` from any OS.

   **Check:** The dev client launches and loads the bundle served by `npx expo start`.

4. **Structure navigation with Expo Router.** Files under `app/` are routes: `_layout.tsx` defines stacks or tabs, `(group)` folders organize without changing URLs, `[id].tsx` is dynamic and `+not-found.tsx` catches unknown links. Set `scheme` in the app config and test links from a cold start:

   ```bash
   adb shell am start -W -a android.intent.action.VIEW -d "myapp://items/42"
   xcrun simctl openurl booted "myapp://items/42"
   ```

   **Check:** Every deep link in the plan opens the right screen with the app killed first.

5. **Configure EAS.**

   ```bash
   npm install -g eas-cli
   eas login
   eas build:configure                            # writes eas.json
   eas build --platform android --profile preview
   eas build --platform ios --profile production
   ```

   Give each profile in `eas.json` its own `channel`. Keep secrets in EAS environment variables (`eas env:create`; verify the command against current docs), never as literals in `app.config.ts`.

   **Check:** Each profile builds and installs on a real device.

6. **Ship OTA updates safely.** Set `runtimeVersion` (policy `appVersion` or `fingerprint`) so an update only reaches binaries with matching native code. After the user confirms, publish with `eas update --branch production --message "fix: ..."`. Any native change (new module, permission, SDK upgrade) needs a new store build. OTA changes must stay within store policies: no change to the app's primary purpose.

   **Check:** A preview build receives a test update, and a build with a different runtime version does not.

7. **Protect data.** Store tokens in `expo-secure-store` (Keychain/Keystore), not AsyncStorage. Anything prefixed `EXPO_PUBLIC_` is inlined into the bundle and is public; call third-party APIs that need secrets through your backend.

   **Check:** `grep_search` for key-like strings in `app/`, `src/` and `app.config.*` finds nothing.

8. **Make it fast, then test it.** Apply the performance table below in a release build. Unit and component tests use the `jest-expo` preset with React Native Testing Library; E2E flows use Maestro (`maestro test flows/`) or Detox against release builds.

   **Check:** CI runs unit tests on every push, and one E2E flow covers sign-in plus the core task.

## Patterns

### app.config.ts with plugins

```ts
import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Receipts',
  slug: 'receipts',
  scheme: 'receipts',
  runtimeVersion: { policy: 'appVersion' },
  ios: { bundleIdentifier: 'com.example.receipts' },
  android: { package: 'com.example.receipts' },
  plugins: [
    'expo-router',
    ['expo-camera', { cameraPermission: 'Allow $(PRODUCT_NAME) to scan receipts.' }],
  ],
};

export default config;
```

`eas update:configure` adds the `updates.url` field for EAS Update.

### EAS channel model

| Build profile | Channel | Audience | Distribution |
| :--- | :--- | :--- | :--- |
| `development` | `development` | Developers | Dev client, internal |
| `preview` | `preview` | Testers, QA | Internal distribution links |
| `production` | `production` | Store users | `eas submit` to the stores |

### Performance fixes

| Symptom | Fix |
| :--- | :--- |
| Long lists stutter | `FlashList` (or `FlatList` with `keyExtractor` and `getItemLayout` for fixed rows); memoized `renderItem`; no inline objects in item props |
| Animations drop during JS work | `react-native-reanimated` worklets run on the UI thread; gestures via `react-native-gesture-handler` |
| Images flicker or re-download | `expo-image` with caching and explicit dimensions |
| Slow startup | Hermes (default), lazy-load heavy screens, defer analytics and SDK init until after first render, avoid huge JSON imports |
| Re-render storms | Split contexts, selector-based stores, `React.memo`; confirm with the React DevTools Profiler |

Measure in release mode: `npx expo run:android --variant release` or `npx expo run:ios --configuration Release`. Dev mode is several times slower and hides real problems.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Hand-edit `ios/` or `android/` in a prebuild project | Config plugin or Expo module | `prebuild --clean` silently discards the edit |
| `npm install` a native library | `npx expo install` | Mismatched native versions crash at launch |
| Ship a native dependency change as an OTA update | New build with a bumped runtime version | Old binaries load JS that calls missing native code |
| Put secrets in `EXPO_PUBLIC_*` or the bundle | Proxy through a backend | Anyone can unzip the app and read them |
| Profile in Expo Go or dev mode | Release build on a low-end Android device | Dev overhead swamps the signal |
| Tokens in AsyncStorage | `expo-secure-store` | AsyncStorage is unencrypted |

## Verification checklist

- [ ] `npx expo-doctor` passes; native folders are generated, not hand-edited (or the exception is documented).
- [ ] Deep links work from a cold start on both platforms.
- [ ] Every EAS profile has its own channel, and `runtimeVersion` is set.
- [ ] No secrets in the bundle, app config or `EXPO_PUBLIC_*` variables.
- [ ] Performance was checked in a release build on a low-end device.
- [ ] Unit tests and at least one E2E flow run in CI.
- [ ] OTA publishes and store submissions happened only after user confirmation.

## Related

- Workflows: `/feature-dev`, `/verify`, `/e2e`.
- Knowledge: `react-patterns`, `typescript-patterns`, `mobile-performance`, `app-store-release`, `push-notifications`, `auth-patterns`, `flutter-mobile`.
- Agents: `mobile-engineer`, `mobile-build-resolver`, `react-reviewer`, `typescript-reviewer`.
