---
name: game-publishing
disable-model-invocation: true
description: >-
  Prepares and ships PC and web games on Steam and itch.io: release timeline
  and wishlists, Steamworks store pages and required disclosures, SteamPipe
  depots and beta branches, butler uploads, demos and playtests, age ratings
  through IARC and regional boards, signing and crash reporting, pricing, press
  kits, and a launch-day checklist with rollback. Use when planning a game
  release, building a store page, uploading builds, or preparing launch day.
---

# Game Publishing

Shipping a game is a project with dates, reviews and irreversible public
steps. Put the store page up early, rehearse uploads on a private branch, keep
every claim on the page true, and treat pressing "release", publishing posts
and sending keys as actions that need the user's explicit go-ahead.

## When to use

- Planning a release timeline, festival participation, demo or playtest.
- Creating or improving a Steam or itch.io page, trailer and capsule art brief.
- Uploading builds with SteamPipe or butler, and managing branches or channels.
- Preparing ratings, disclosures, pricing and the launch-day checklist.

## When not to use

- Mobile app stores: use `app-store-release`.
- Producing the trailer or capsule art: use `video-production-pipeline` and `ai-image-generation`, then return here.
- Marketing campaign strategy beyond the store page: use `/marketing-launch` and `growth-marketing`.
- Contracts with publishers or porting partners: use `contract-review` with qualified counsel.

## Workflow

1. **Plan the timeline.** Work back from the launch date: store page live months ahead to collect wishlists, the "Coming Soon" period the platform requires (verify the current minimum), festival dates such as Steam Next Fest, demo and playtest windows, press and creator outreach, localization and certification lead times. Avoid launching against major releases in your genre.

   **Check:** A dated plan artifact lists every milestone with an owner.

2. **Set up accounts and business details** (not legal, tax or financial advice). Steamworks and itch.io accounts, company or individual identity, tax interview and payment details. The user enters banking, tax and identity information personally; the agent never types them. Note the per-app fee and revenue terms from the current platform docs.

   **Check:** The user confirms onboarding is complete, and the app ID exists.

3. **Build the store page.** Capsule images in every required size (get the current list from Steamworks docs), at least five gameplay screenshots, a trailer that shows gameplay in its first seconds, short and long descriptions, accurate tags, system requirements, supported languages you have actually tested, controller and Steam Deck support, accessibility features, the mature-content survey, and the generative-AI content disclosure where it applies (verify the current rules). Platform review of the page and build takes several business days; schedule for it.

   **Check:** Every claim on the page is true for the build that will ship, and the page passed review before announcement.

4. **Make release builds trustworthy.** Reproducible release builds per platform, Windows Authenticode signing, macOS Developer ID signing and notarization, crash reporting with symbol upload, save compatibility across versions, gamepad support, and a Steam Deck pass if you claim support.

   **Check:** Fresh installs on clean Windows, macOS and Linux machines (as claimed) run without security warnings and report a test crash with symbols.

5. **Upload to Steam on a private branch first.** Use SteamPipe with `steamcmd` and an app build script (pattern below). The user signs in to the builder account themselves; the agent never handles the password or Steam Guard code. Test the branch through the Steam client.

   ```powershell
   steamcmd +login <builder_account> +run_app_build "C:\steam\scripts\app_build_<appid>.vdf" +quit
   ```

   **Check:** The beta branch installs and launches through Steam with achievements and cloud saves working.

6. **Upload to itch.io with butler** (the user completes `butler login` in the browser):

   ```bash
   butler push build/windows yourname/yourgame:windows --userversion 1.0.3
   butler push build/web yourname/yourgame:html5 --userversion 1.0.3
   butler status yourname/yourgame
   ```

   For browser builds, zip with `index.html` at the root, set the viewport size on the page, and mark the upload as playable in the browser.

   **Check:** Each channel shows the new version, and the itch app installs it.

7. **Run demos and playtests.** A Steam demo is its own app attached to the base game; Steam Playtest gives gated access; itch.io suits early builds. Plan whether demo progress carries over.

   **Check:** Demo telemetry or feedback has a destination, and the demo ends with a wishlist prompt.

8. **Handle ratings and compliance** (not legal advice). Consoles and many storefronts require IARC or regional ratings (ESRB, PEGI, USK, CERO, ClassInd, GRAC, ACB); Steam relies on its content survey. Add a privacy policy if you collect data, and handle children's privacy rules if minors are an audience.

   **Check:** Required ratings and policies exist for every storefront and region in the plan, reviewed by qualified counsel where needed.

9. **Price deliberately** (not financial advice). Base price, regional pricing (the platform suggests conversions), launch discount, and future discount cadence within platform rules (verify current rules).

   **Check:** Prices are set for every region before the release date, and the discount schedule is written down.

10. **Launch with confirmation and a rollback.** Walk the checklist below. Ask the user before each public step: releasing the game, setting a build live on the default branch, publishing announcements and sending keys. If the new build is bad, set the previous build live again from the Steam build history, or push the previous build to the itch channel, then fix forward.

    **Check:** Each public step was explicitly confirmed, and the rollback was rehearsed on the beta branch.

## Patterns

### SteamPipe app build script (verify keys against current SteamPipe docs)

```text
"AppBuild"
{
  "AppID" "<appid>"
  "Desc" "1.0.3 release candidate"
  "ContentRoot" "..\content\"
  "BuildOutput" "..\output\"
  "SetLive" "beta"
  "Depots"
  {
    "<depotid>"
    {
      "FileMapping" { "LocalPath" "windows\*" "DepotPath" "." "Recursive" "1" }
    }
  }
}
```

Promote to the default branch from the Steamworks dashboard after testing.

### Launch-day checklist

- [ ] Final build on the beta branch matches the release candidate that passed QA.
- [ ] Store page: price, release time, languages, requirements and disclosures correct.
- [ ] Crash reporting, analytics consent and server capacity (if online) verified.
- [ ] Press kit (fact sheet, logo, screenshots, trailer, contact) published; review keys sent with user approval.
- [ ] Patch branch and hotfix process ready; rollback rehearsed.
- [ ] Community channels staffed for the first 48 hours; known-issues post drafted.
- [ ] Release button pressed by, or with explicit approval of, the user.

### Platform notes

| Channel | Notes |
| :--- | :--- |
| Steam | Wishlists drive launch visibility; festivals need an approved demo; branches allow private testing |
| itch.io | Fast iteration, pay-what-you-want, browser games; set your revenue share on the project |
| Consoles | Developer programs (ID@Xbox, PlayStation Partners, Nintendo Developer Portal); certification requirements are under NDA |
| Web portals | Check each portal's SDK, ads and exclusivity terms before integrating |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Announce the store page the week of launch | Page live months ahead for wishlists | Little visibility at launch |
| Upload straight to the default branch | Beta branch, test, then promote | Players download untested builds |
| Claim features or languages not in the build | Claim only what ships | Refunds, negative reviews and policy problems |
| Share builder passwords with tools or agents | User signs in; dedicated builder account | Account takeover risk |
| Skip AI content or mature content disclosures | Fill them in accurately | Store rejection or removal |
| Launch without a rollback path | Rehearse restoring the previous build | Bad patches stay live for hours |

## Verification checklist

- [ ] A dated timeline with owners exists, including platform review time.
- [ ] Business, tax and banking onboarding was completed by the user personally.
- [ ] The store page is accurate, reviewed, and includes required disclosures.
- [ ] Builds are signed, crash reporting works, and uploads were tested on a private branch.
- [ ] Ratings, privacy policy and pricing are in place for every target region.
- [ ] Every public step was confirmed by the user, and rollback was rehearsed.

## Related

- Workflows: `/marketing-launch`, `/release-management`, `/game-build`.
- Knowledge: `app-store-release`, `growth-marketing`, `copywriting`, `video-production-pipeline`, `ai-image-generation`, `community-management`, `contract-review`.
- Agents: `marketing-strategist`, `product-manager`, `game-engine-specialist`.
