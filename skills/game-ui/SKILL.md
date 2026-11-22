---
name: game-ui
description: >-
  Designs and implements game UI and UX: HUD information hierarchy and safe
  areas, menu flows, controller and keyboard focus navigation, input-glyph
  switching, resolution and UI scaling, readability and accessibility options,
  and localization-ready layouts, with notes for Unity, Unreal and Godot. Use
  when building HUDs or menus, adding gamepad support to UI, or preparing an
  interface for other languages, screens and players.
---

# Game UI

Game UI must be readable at a glance in the middle of action, fully usable
with whatever device is in the player's hands, and robust to other languages
and screen shapes. Design the flow and the information hierarchy first, then
build focus navigation and scaling in from the start; retrofitting either is
painful.

## When to use

- Designing or building a HUD, pause menu, settings, inventory or shop screen.
- Making menus work with a gamepad, keyboard, mouse and touch, including button prompts.
- UI breaks on ultrawide, Steam Deck, TV or phone notches, or text overflows in translation.
- Adding accessibility options such as UI scale, subtitles, remapping and colour-blind support.

## When not to use

- App and web UI outside games: use `ui-ux-design` and `accessibility-a11y`.
- Translation workflow and ICU messages in general: use `i18n-localization`.
- Engine-specific scene and node structure: use `unity`, `unreal-engine` or `godot-engine` alongside this skill.

## Workflow

1. **Map the screen flow.** Draw every screen (title, main menu, settings, pause, inventory, results) with its purpose, default focused element and back target. Put the diagram in the implementation plan artifact.

   **Check:** Every screen has a back path, and no screen is a dead end with a controller.

2. **Rank HUD information.** List what the player needs during play, by priority (health, ammo, objective, minimap). Keep critical items glanceable in consistent places, show secondary items contextually (fade out when full or unchanged), and consider diegetic options.

   **Check:** In a five-second look, a new player can name the three most important HUD elements.

3. **Lay out for every screen.** Choose a reference resolution, anchor elements to edges, respect safe areas (OS insets on phones, title-safe margins on TVs; verify each platform's requirements), and test 16:9, 16:10 (Steam Deck), 21:9 and phone aspect ratios. Add a UI scale setting.

   **Check:** Screenshots at each target aspect ratio and the minimum and maximum UI scale show nothing clipped or overlapping.

4. **Build focus navigation.** Every interactive element reachable by d-pad, stick and keyboard; a default focus when a screen opens; previous focus restored on back; explicit neighbours where automatic navigation fails (grids, wrap-around, tabs); a visible focus state that is not colour-only; hold-to-repeat with an initial delay; mouse hover moves focus.

   **Check:** A controller-only pass through every screen reaches every control with no traps.

5. **Swap input glyphs.** Track the last used device and show matching prompts (keyboard, Xbox, PlayStation, Nintendo, Steam Deck), reflecting the player's current bindings. On Steam, the Steam Input API can supply glyphs.

   **Check:** Rebinding jump updates every prompt that mentions jump, and prompts switch within a frame of changing devices.

6. **Make it readable and accessible.** Text contrast of at least 4.5:1 against its backplate (borrowing the WCAG figure), outlines or panels behind text over gameplay, colour-blind-safe palettes with redundant icons or shapes, subtitles with size, background and speaker options, remapping, hold-or-toggle choices, and options to reduce shake and flashing. Use the Game Accessibility Guidelines and the Xbox Accessibility Guidelines as checklists.

   **Check:** The accessibility options in the plan exist and persist, and a grayscale screenshot still communicates every state.

7. **Make it localization-ready.** All strings in string tables with keys; no concatenated sentences; plural and gender support; layouts that allow roughly 30 to 40 percent text expansion via wrapping, auto-size or scrolling; fonts with fallbacks for CJK, Cyrillic and Arabic scripts; right-to-left mirroring where needed; no text baked into textures. Run a pseudo-localization pass (accented, padded strings).

   **Check:** The pseudo-locale build shows no truncation and no untranslated (hard-coded) strings.

8. **Add feedback without blocking input.** Distinct normal, focused, pressed and disabled states; sounds for focus, confirm and cancel; transitions short (about 200 to 300 ms) and skippable; input accepted during animations.

   **Check:** Rapidly pressing confirm and back never soft-locks a menu.

9. **Playtest the UI.** Test from couch distance on a TV, on a handheld, and on a phone; watch new players find settings and the objective. Profile UI cost (layout rebuilds, overdraw, draw calls) on minimum-spec hardware.

   **Check:** Findings are logged with severity, and UI frame cost fits its budget.

## Patterns

### Engine notes

| Engine | UI system | Focus and navigation | Localization |
| :--- | :--- | :--- | :--- |
| Unity | UI Toolkit (UXML, USS) or uGUI | uGUI `EventSystem` plus `Selectable` navigation (automatic or explicit); UI Toolkit focusable elements | Localization package: string tables, smart strings |
| Unreal | UMG with CommonUI | CommonUI activatable widgets and input routing for gamepads | Localization Dashboard: gather, translate, compile |
| Godot | `Control` nodes and themes | `focus_mode`, `focus_neighbor_*` properties, `grab_focus()` | `TranslationServer` with CSV or PO files and `tr()` |

### HUD placement

| Information | Placement and behaviour |
| :--- | :--- |
| Vital (health, ammo) | Fixed corner, always visible or shown on change, large and high contrast |
| Navigation (objective, compass) | Top centre or edge; world-space markers clamped to screen edges |
| Transient (pickups, damage numbers) | Near the action, short-lived, pooled |
| Reference (map, quest log) | Separate screen or overlay, never permanent clutter |

### Localization string rules

```text
Bad:   "You have " + count + " " + item + "s"
Good:  key "inventory.count" = "{count, plural, one {# {item}} other {# {item}}}"
       (item names are their own keys with their own plural forms)
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Design for mouse and add gamepad later | Plan focus navigation from the first screen | Retrofitting navigation means rebuilding layouts |
| Hard-code "Press A" | Prompts from current device and bindings | Wrong on other pads and after remapping |
| Fixed pixel layouts | Anchors, reference resolution and a scale setting | Breaks on ultrawide, handhelds and TVs |
| Colour as the only signal | Colour plus icon, shape or text | Unreadable for colour-blind players |
| Text inside textures | String tables and runtime text | Cannot be translated without re-exporting art |
| Unskippable menu animations | Short transitions that accept input | Players feel the menu fighting them |

## Verification checklist

- [ ] Every screen has a default focus and a back path; no controller dead ends.
- [ ] HUD priorities are documented, and critical items read at a glance.
- [ ] Layout holds at all target aspect ratios, safe areas and UI scales.
- [ ] Prompts follow the active device and current bindings.
- [ ] Accessibility options (scale, subtitles, remapping, colour, shake) exist and persist.
- [ ] Pseudo-localization shows no truncation or hard-coded strings.

## Related

- Workflows: `/game-build`, `/a11y-audit`, `/ui-polish`.
- Knowledge: `game-architecture`, `unity`, `unreal-engine`, `godot-engine`, `i18n-localization`, `ui-ux-design`, `accessibility-a11y`.
- Agents: `game-engine-specialist`, `ux-designer`, `accessibility-auditor`.
