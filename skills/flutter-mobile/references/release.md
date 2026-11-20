# Flutter release: flavors, configuration, signing, Fastlane

## Flavors and configuration

- One entry point per flavor (`lib/main_dev.dart`, `lib/main_prod.dart`) that builds an `AppConfig` and calls a shared `bootstrap()`.
- Android: `productFlavors` in `android/app/build.gradle` or `build.gradle.kts` with a `flavorDimensions` entry and `applicationIdSuffix` for non-prod. iOS: one Xcode scheme per flavor with matching build configurations (`Debug-dev`, `Release-dev`, ...).
- Run and build:

  ```bash
  flutter run --flavor dev -t lib/main_dev.dart
  flutter build appbundle --flavor prod -t lib/main_prod.dart --release
  flutter build ipa --flavor prod -t lib/main_prod.dart --release
  ```

- Non-secret configuration with `--dart-define=API_BASE=https://api.example.com` or `--dart-define-from-file=config/prod.json`, read with `const String.fromEnvironment('API_BASE')`. These values are compiled into the binary: never put secrets there.
- Obfuscation and symbols for crash reporting: add `--obfuscate --split-debug-info=build/symbols` and upload the symbols to your crash reporter; keep them per release.

## Versioning

`version: 1.4.0+42` in `pubspec.yaml` (name plus build number). Override in CI with `--build-name=1.4.0 --build-number=$BUILD_NUMBER`. Store build numbers must increase monotonically.

## Android signing

1. Create an upload keystore (once), store it and its passwords in a secret manager, and back it up:

   ```bash
   keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

2. `android/key.properties` (git-ignored) or CI environment variables provide `storeFile`, `storePassword`, `keyAlias`, `keyPassword`; `signingConfigs.release` in the Gradle file reads them.
3. Enrol in Play App Signing so Google holds the app signing key and you hold only the upload key.

Never commit the keystore or `key.properties`. Add both to `.gitignore` before creating them.

## iOS signing

- Automatic signing in Xcode works for a single developer; teams should use Fastlane `match` (certificates and profiles stored encrypted in a private repo or cloud bucket) or CI-managed signing.
- `flutter build ipa` uses `ios/ExportOptions.plist` when passed with `--export-options-plist`.
- Bump `CFBundleShortVersionString` and `CFBundleVersion` through the Flutter build name and number, not by hand.

## Fastlane

```ruby
# android/fastlane/Fastfile
lane :internal do
  sh("flutter", "build", "appbundle", "--flavor", "prod", "-t", "lib/main_prod.dart", "--release")
  upload_to_play_store(track: "internal",
                       aab: "../build/app/outputs/bundle/prodRelease/app-prod-release.aab")
end

# ios/fastlane/Fastfile
lane :beta do
  match(type: "appstore", readonly: true)
  sh("flutter", "build", "ipa", "--flavor", "prod", "-t", "lib/main_prod.dart", "--release")
  upload_to_testflight(ipa: "../build/ios/ipa/<App>.ipa", skip_waiting_for_build_processing: true)
end
```

Run with `bundle exec fastlane internal` (from `android/`) or `bundle exec fastlane beta` (from `ios/`). Store credentials (Play service-account JSON, App Store Connect API key) come from CI secrets, never from the repo. Uploading to any store track is an outward-facing action: confirm with the user first.

## CI outline

1. `flutter pub get`, `flutter analyze`, `dart format --output=none --set-exit-if-changed .`
2. `flutter test --coverage` (goldens on a pinned runner OS)
3. Android build on Linux; iOS build on a macOS runner
4. Upload artifacts and debug symbols; deploy to an internal or TestFlight track on tagged builds only

Details for GitHub Actions caching, matrices and secrets: `ci-cd-github-actions`.

## Pre-release checklist

- [ ] Version name and build number bumped; changelog written.
- [ ] Release build tested on a low-end Android device and an older supported iOS version.
- [ ] Obfuscation symbols uploaded to the crash reporter.
- [ ] Permissions in `AndroidManifest.xml` and `Info.plist` usage strings are minimal and explained.
- [ ] Store listing, privacy labels and data-safety form match what the app collects.
