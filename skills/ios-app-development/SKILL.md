---
name: ios-app-development
description: >-
  Builds iOS apps end to end: SwiftUI-first architecture with UIKit interop,
  SwiftData and Core Data persistence and migrations, Keychain for secrets,
  APNs push setup, privacy manifests and usage strings, code signing and
  provisioning, and xcodebuild-based test, archive and export for CI. Use when
  starting an iOS app, mixing SwiftUI and UIKit, choosing persistence, setting
  up push, or fixing signing and archive failures.
---

# iOS App Development

Ship an iOS app whose architecture, data and signing are boring and
reproducible: SwiftUI for new screens, UIKit where it is still better, one
persistence story with tested migrations, and builds that come out of the
command line rather than one developer's Xcode.

## When to use

- Starting an iOS app or adding a major feature to one.
- Embedding UIKit views in SwiftUI or SwiftUI screens in a UIKit app.
- Choosing between SwiftData, Core Data and SQLite, or writing a migration.
- Setting up push notifications, entitlements, privacy manifests or CI signing.

## When not to use

- SwiftUI view, state and layout depth: use `swiftui`. Actors, `Sendable` and Swift 6 checking: use `swift-concurrency`.
- Store metadata, TestFlight and phased release: use `app-store-release`.
- Push payload design and token backends: use `push-notifications`.
- Shared Kotlin logic for iOS and Android: use `kotlin-multiplatform`.

## Workflow

1. **Confirm the toolchain.** iOS builds need macOS with Xcode; on Windows or Linux, use a Mac, a cloud macOS CI runner or Xcode Cloud. Pin the Xcode version in CI.

   ```bash
   xcodebuild -version
   xcodebuild -list                                   # schemes and configurations
   xcrun simctl list devices available                # pick a simulator name
   xcodebuild test -scheme App -destination 'platform=iOS Simulator,name=<device>'
   ```

   **Check:** Tests run green from the command line, not only inside Xcode.

2. **Set the architecture.** SwiftUI views over `@Observable` models; features in local Swift packages for build speed and boundaries; dependencies passed in through initializers or the environment, not singletons. Use UIKit for what SwiftUI still does poorly in your deployment target (complex text editing, some camera and collection-view cases) via `UIViewRepresentable` and `UIViewControllerRepresentable`; host SwiftUI in UIKit with `UIHostingController`.

   **Check:** Each feature's model is unit-testable without launching the app.

3. **Choose persistence once** with the table below. For SwiftData, version schemas with `VersionedSchema` and a `SchemaMigrationPlan`. For Core Data, write on background contexts (`performBackgroundTask`) and set `viewContext.automaticallyMergesChangesFromParent = true`.

   **Check:** A test opens a store fixture from the previous version and migrates it without data loss.

4. **Keep secrets in the Keychain.** Tokens and credentials go to the Keychain with an accessibility class such as `kSecAttrAccessibleAfterFirstUnlock`; never `UserDefaults` or plist files. API keys for paid services stay on your server.

   **Check:** `grep_search` finds no tokens in `UserDefaults` calls, plists or source.

5. **Set up push.** Enable the Push Notifications capability (adds the `aps-environment` entitlement), create an APNs auth key (`.p8`) and store it in a secret manager, request authorization at a moment the user understands, register, and send the device token to your backend. Test locally:

   ```bash
   xcrun simctl push booted com.example.app payload.apns
   ```

   **Check:** A simulator push arrives, and a TestFlight build receives a push through the production APNs environment.

6. **Declare privacy.** Add `PrivacyInfo.xcprivacy` with required-reason API declarations and tracking domains, a purpose string for every permission (`NSCameraUsageDescription` and so on), and App Tracking Transparency only if you track. Audit third-party SDKs for their own manifests.

   **Check:** The archive's privacy report in the Organizer lists what you expect and nothing more.

7. **Make signing reproducible.** Automatic signing for local development. In CI, use an App Store Connect API key plus fastlane `match` or a keychain created per job; credentials come from CI secrets, never the repo.

   ```bash
   xcodebuild archive -scheme App -configuration Release \
     -destination 'generic/platform=iOS' -archivePath build/App.xcarchive
   xcodebuild -exportArchive -archivePath build/App.xcarchive \
     -exportPath build/export -exportOptionsPlist ExportOptions.plist
   ```

   **Check:** A clean CI runner produces a signed `.ipa` and uploads dSYMs to your crash reporter.

## Patterns

### UIKit inside SwiftUI and back

```swift
struct MapView: UIViewRepresentable {
    var region: MKCoordinateRegion
    func makeUIView(context: Context) -> MKMapView { MKMapView() }
    func updateUIView(_ view: MKMapView, context: Context) {
        view.setRegion(region, animated: true)
    }
}

// In a UIKit app:
let settings = UIHostingController(rootView: SettingsView(model: model))
navigationController?.pushViewController(settings, animated: true)
```

### SwiftData model and query

```swift
@Model final class Note {
    var title: String
    var createdAt: Date
    init(title: String, createdAt: Date = .now) { self.title = title; self.createdAt = createdAt }
}

@main struct NotesApp: App {
    var body: some Scene { WindowGroup { NotesList() }.modelContainer(for: Note.self) }
}

struct NotesList: View {
    @Query(sort: \Note.createdAt, order: .reverse) private var notes: [Note]
    @Environment(\.modelContext) private var context
    var body: some View {
        List(notes) { Text($0.title) }
            .toolbar { Button("Add") { context.insert(Note(title: "New")) } }
    }
}
```

### Persistence choice

| Option | Choose when |
| :--- | :--- |
| SwiftData | New app targeting iOS 17+, straightforward model graph, SwiftUI-first |
| Core Data | Older deployment targets, existing stores, complex migrations, `NSFetchedResultsController` |
| SQLite via a library (for example GRDB) | You want SQL, explicit migrations and full query control |
| `UserDefaults` | Small preferences only; never secrets or large data |
| Keychain | Tokens, passwords, keys |

### Signing errors

| Error says | Usual cause and fix |
| :--- | :--- |
| No profiles for the bundle ID were found | Profile does not match the bundle ID or team; regenerate or let automatic signing manage it |
| Profile doesn't include the `aps-environment` entitlement | Capability enabled after the profile was made; regenerate the profile |
| Certificate has no private key | Cert created on another Mac; export a `.p12` from there or use `match` |
| Build number already used | Increment `CFBundleVersion` for every upload |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Archive only from one laptop | Scripted `xcodebuild` archive in CI | Releases stall when that laptop or its keychain changes |
| Commit certificates or `.p8` keys | Secret manager plus `match` or per-job keychains | Leaked signing keys let others ship as you |
| Write Core Data on the main context | Background contexts with merge-on-save | Main-thread writes hitch scrolling |
| Ship schema changes without a migration test | Versioned schema plus fixture test | Users lose data on update |
| Ask for every permission at launch | Ask in context, after explaining the benefit | Early denials are hard to reverse |
| Tokens in `UserDefaults` | Keychain | `UserDefaults` is a readable plist |

## Verification checklist

- [ ] Tests and archive both run from the command line on a clean machine.
- [ ] Persistence is one deliberate choice with migration tests from the previous version.
- [ ] Secrets live in the Keychain or the server, never in defaults, plists or the repo.
- [ ] Push works on the simulator and through production APNs from TestFlight.
- [ ] The privacy manifest and every permission purpose string are present and accurate.
- [ ] CI signing uses an API key and secrets, and dSYMs are uploaded.

## Related

- Workflows: `/feature-dev`, `/tdd`, `/verify`.
- Knowledge: `swiftui`, `swift-concurrency`, `app-store-release`, `push-notifications`, `mobile-performance`, `kotlin-multiplatform`, `secrets-management`.
- Agents: `swift-reviewer`, `mobile-engineer`, `mobile-build-resolver`.
