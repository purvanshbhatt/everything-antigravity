---
name: app-store-release
disable-model-invocation: true
description: >-
  Ships mobile apps to the Apple App Store and Google Play: identifiers,
  signing and Play App Signing, version and build numbers, TestFlight and Play
  testing tracks, metadata and screenshots, privacy labels and Data safety,
  common review rejections, phased and staged rollouts, halting a bad release,
  and fastlane or EAS automation. Use when preparing a first submission,
  fixing a rejection, or planning a production rollout.
---

# App Store Release

Get a build from CI to users without surprises: identifiers and signing that
cannot be lost, declarations that match what the app really does, testers
before the public, and a rollout that can be paused. Store binaries cannot be
rolled back, so every release plan is a fix-forward plan.

## When to use

- First submission of an app to either store, or adding the second platform.
- A build was rejected, or a Play policy warning arrived.
- Setting up TestFlight, Play testing tracks, or automated uploads from CI.
- Planning a phased or staged production rollout and its halt criteria.

## When not to use

- Building the app itself: use `ios-app-development`, `android-jetpack-compose`, `react-native-expo` or `flutter-mobile`.
- Desktop and PC game stores: use `game-publishing`.
- Versioning and changelogs across a whole product: use `/release-management`.
- Writing the privacy policy text: use `policy-drafting` with qualified counsel.

## Workflow

1. **Fix identities and accounts.** Apple Developer Program membership and an App Store Connect record; a Google Play Console account and app. Decide the bundle ID and application ID now: Play never lets you change it after publishing.

   **Check:** Both store records exist with the final identifiers, and two people on the team have admin access.

2. **Automate versioning.** iOS: `CFBundleShortVersionString` (marketing) plus `CFBundleVersion` (build, must increase for each upload). Android: `versionName` plus an integer `versionCode` that strictly increases. Derive build numbers from CI.

   **Check:** Two consecutive CI builds produce different, increasing build numbers on both platforms.

3. **Secure signing.** iOS: distribution certificate and App Store profile (or managed signing) with an App Store Connect API key for CI. Android: enroll in Play App Signing; keep only the upload key, in a secret manager, never in git. A lost upload key can be reset through Play support; a lost app signing key cannot, which is why Google holds it.

   **Check:** CI signs release builds using only secrets, and the keystore and `.p8` files are absent from the repository.

4. **Build release artifacts.** iOS archive via `xcodebuild`, fastlane `gym` or EAS; Android App Bundle via `./gradlew bundleRelease` (PowerShell: `.\gradlew.bat bundleRelease`). Upload crash symbols: dSYMs, the R8 `mapping.txt` and native debug symbols.

   **Check:** The artifact is a release configuration, not debuggable, and a test crash symbolicates in your crash reporter.

5. **Make declarations match reality** (not legal advice; involve qualified counsel for privacy policies). Apple: App Privacy details, privacy manifest, age rating, export compliance (`ITSAppUsesNonExemptEncryption`). Google: Data safety form, content rating questionnaire, target API level requirement, sensitive-permission declarations. Inventory every third-party SDK's data collection first.

   **Check:** Each declared data type maps to a line in the SDK inventory, and nothing in the inventory is undeclared.

6. **Prepare metadata.** Name, subtitle or short description, description, keywords (iOS), screenshots for the currently required device sizes (verify in store docs), support and privacy policy URLs, release notes, and review notes with a working demo account created for review, never a real user's credentials.

   **Check:** Screenshots show the current UI, and the demo account works on the release build.

7. **Beta first.** TestFlight internal testers (no review), then external groups (Beta App Review). Play internal testing, then closed and open tracks. New personal Play developer accounts must complete a closed test with a minimum number of testers and days before production access (12 testers for 14 days at time of writing; verify).

   **Check:** Crash-free sessions in beta meet the target, and the Play pre-launch report has no crashes.

8. **Submit and roll out, with the user's go-ahead.** Ask before submitting for review or promoting to production. iOS: phased release for automatic updates spreads over seven days and can be paused (verify current limits). Play: staged rollout such as 1, 5, 20, 50, 100 percent, advancing only when vitals hold.

   **Check:** The rollout plan lists the metrics and thresholds that gate each step.

9. **Monitor and halt.** Watch crash-free users, ANR rate, reviews and business metrics after each step. Halt with Play's "Halt rollout" or App Store "Pause phased release" (users can still update manually). Fix forward with a higher build number.

   **Check:** A named owner watches the first 48 hours, and the halt steps are written in the release notes artifact.

## Patterns

### Common rejections

| Store and area | Typical cause | Fix |
| :--- | :--- | :--- |
| Apple 2.1 App Completeness | Crash, placeholder content, broken demo login | Test the exact release build; supply a working demo account |
| Apple 2.3 Accurate Metadata | Screenshots or description do not match the app | Regenerate screenshots from the current build |
| Apple 3.1.1 In-App Purchase | Digital goods sold outside IAP | Use IAP, or follow current regional exceptions (verify) |
| Apple 4.2 Minimum Functionality | Thin web wrapper | Add native value or ship as a website |
| Apple 5.1.1 Data Collection | Missing purpose strings, no in-app account deletion | Purpose strings for each permission; account deletion inside the app |
| Play Data safety | Form does not match SDK behaviour | Re-audit SDKs; update the form before release |
| Play permissions | SMS, call log, background location or all-files access without approval | Remove, or submit the permission declaration with justification |

Guideline numbers change; confirm against the current App Review Guidelines and Play policy center.

### Automation commands

```bash
fastlane match appstore                                    # sync iOS signing assets
fastlane pilot upload                                      # build to TestFlight
fastlane deliver                                           # metadata, screenshots, submission
fastlane supply --aab app-release.aab --track internal     # Play upload to a track
eas submit --platform ios                                  # Expo projects
eas submit --platform android
```

### Rollout gates (example; set your own)

| Step | Advance when |
| :--- | :--- |
| 1 percent, 24 h | Crash-free users at or above baseline, no new top crash |
| 5 to 20 percent | ANR rate and support tickets flat; key funnel unchanged |
| 50 to 100 percent | All of the above for 48 h |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Commit keystores or signing keys | Secret manager and Play App Signing | Leaks let others ship as you; loss blocks updates |
| Reuse or hand-edit build numbers | CI-derived, monotonic numbers | Uploads are rejected, and builds become ambiguous |
| Release to 100 percent on day one | Phased or staged rollout with gates | A bad build reaches everyone before you see it |
| Declare "no data collected" by default | Audit SDKs, then declare | Mismatches trigger removals |
| Give reviewers a personal account | A dedicated review account | Exposes real user data |
| Plan a store rollback | Plan halt plus fix-forward | Stores do not let users downgrade |

## Verification checklist

- [ ] Identifiers are final, and signing material lives only in secret storage.
- [ ] Build numbers increase automatically on both platforms.
- [ ] Privacy, data safety, rating and export declarations match the SDK inventory.
- [ ] Metadata, screenshots and the review demo account are current.
- [ ] Beta testing met its crash-free target before submission.
- [ ] Submission and each rollout step were confirmed by the user, with halt criteria written down.

## Related

- Workflows: `/release-management`, `/verify`, `/pr-ready`.
- Knowledge: `ios-app-development`, `android-jetpack-compose`, `react-native-expo`, `flutter-mobile`, `mobile-performance`, `gdpr-privacy`, `policy-drafting`.
- Agents: `mobile-engineer`, `mobile-build-resolver`, `compliance-auditor`.
