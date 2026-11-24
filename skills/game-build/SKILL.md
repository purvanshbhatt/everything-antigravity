---
name: game-build
disable-model-invocation: true
description: >-
  Scaffolds a playable game prototype fast: picks the engine (Canvas, Phaser,
  Three.js or Godot) from constraints, builds the core loop on a fixed
  timestep, ships one mechanic with win and lose states, adds a juice pass
  (screen shake, hit-stop, particles, SFX) and verifies it runs at 60 fps with
  no console errors, using the browser for web games. Use when the user asks
  to make, prototype or jam a game. Invoke with /game-build.
---

# /game-build

Get from idea to something playable and verified in one session. The order is
fixed: core loop, one mechanic, win and lose, juice, verification. Content,
menus and polish come after the loop is fun, never before.

## When to use

- "Make a game", "prototype this mechanic", "game jam", "build a small browser game".
- Turning a one-line game idea into a runnable project with tests.
- Rebuilding a broken prototype on a sound loop before adding features.

## When not to use

- Architecture decisions for a large or long-lived game: use `game-architecture` first, then this workflow.
- Deep engine work in an existing Godot or Three.js project: use `godot-engine` or `threejs-webgl`.
- Level or world generation as the main task: use `procedural-generation`.
- Cloning an existing commercial game: decline the clone and offer an original design in the same genre.

## Workflow

1. **One-page design.** Write the core loop in one sentence ("The player X to Y while avoiding Z; wins when..., loses when..."), the controls, target session length, platform and art style (shapes first, art later). Keep names, characters, levels, art and audio original; genres and common mechanics are fine. Put it in an implementation plan artifact with a task list.

   **Check:** The plan states the core-loop sentence, the win condition, the lose condition and the controls.

2. **Pick the engine.**

   | Constraint | Choose |
   | :--- | :--- |
   | Fastest 2D prototype, zero dependencies, runs anywhere | Canvas 2D + TypeScript + Vite |
   | 2D with sprites, tilemaps, arcade physics, scenes built in | Phaser (check the current major version) |
   | 3D in the browser | Three.js (R3F if the host app is React) |
   | Native desktop or mobile export, editor workflow | Godot 4.x (if installed or preferred) |
   | Must live inside an existing web app | Canvas or Three.js in that app |

   **Check:** The choice and its reason are recorded in the plan.

3. **Scaffold and run.**

   ```bash
   npm create vite@latest my-game -- --template vanilla-ts   # Canvas or Three.js (pnpm/yarn/bun create also work)
   cd my-game
   npm install
   npm install -D vitest
   npm run dev                                               # start in the background with run_command
   ```

   Phaser: add `phaser` to the Vite project, or use Phaser's project generator (`npm create @phaserjs/game@latest`; verify). Three.js: `npm install three` and `npm install -D @types/three`. Godot: see [engine quickstarts](references/engine-quickstarts.md).

   **Check:** The dev server serves a page (Vite defaults to http://localhost:5173) with a canvas and zero console errors.

4. **Core loop on a fixed timestep.** Input sampled per frame and latched; simulation in a pure `step(world, input, dt)` with no DOM, audio or clock; rendering interpolates between ticks. Separate files: `sim.ts`, `main.ts` (loop, input, render, juice, audio). A complete original starter is in [Canvas scaffold](references/canvas-scaffold.md). Add a debug overlay (backquote key) with fps, p95 frame time, seed and tick, and a dev-only `window.__game` hook for tests.

   **Check:** The overlay shows a stable frame time, and a Vitest test proves two runs with the same seed and inputs end in identical state (`npx vitest run`).

5. **One mechanic, win, lose, restart.** Implement a single verb well. Game states: title → playing → won or lost → restart in under 2 s without reloading. All tunables live in one config object.

   **Check:** You can win, lose and restart five times in a row with no leaked entities, timers or listeners.

6. **Juice pass.** Every player action gets visual and audio feedback within one frame.

   | Technique | Starting values |
   | :--- | :--- |
   | Screen shake | Trauma 0-1, offset = max (8-16 px) x trauma², decays about 1.5 per second |
   | Hit-stop | Freeze simulation 40-120 ms on impacts; keep rendering |
   | Particles | 8-40 per event, 0.3-0.6 s life, from a preallocated pool |
   | Flash | One 50-80 ms flash on damage; never repeated more than 3 times per second |
   | SFX | One sound per action, ±5 % pitch variation, audio unlocked on first key or click |
   | Squash and stretch | 10-20 % on jump, land or collect |

   Respect `prefers-reduced-motion`: disable shake and flash when set. Audio details: `game-audio-sfx`.

   **Check:** A 30 s play session shows feedback for every action and no console warnings.

7. **Verify in the browser** (web games). Run `npm run build` (type-check and bundle). With the dev server running, delegate to Antigravity's browser subagent: open the local URL, read the console, play through win and lose, run the frame-time snippet from the quickstarts (or `window.__game.stats()`), and take a screenshot. Keep the tab visible: background tabs throttle `requestAnimationFrame`. For Godot, run the headless smoke run and tests from the quickstarts.

   **Check:** Build passes; console has zero errors; p95 frame time at or below 16.7 ms (60 fps) during a stress moment; screenshot captured.

8. **Playtest and hand off.** Run the playtest checklist in the quickstarts, fix the top issues, then write a walkthrough artifact: how to run, controls, tunables, verification evidence (frame times, console state, screenshot), known issues and next steps. Publishing (itch.io, stores, hosting) only with explicit approval.

   **Check:** The walkthrough contains the evidence, and every checklist item is either passed or listed as a known issue.

## Output contract

The walkthrough artifact always has these sections: `Run` (exact commands),
`Controls`, `Tunables` (file and names), `Verification` (build result, console
errors count, average and p95 frame time, test results, screenshot),
`Playtest notes`, `Known issues`, `Next steps`.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start with menus, art or level editors | Core loop first, shapes as art | Fun is decided by the loop; everything else is wasted if it is not |
| `x += speed` per rendered frame | Fixed timestep with `dt` | Speed varies with monitor refresh rate |
| Simulation code that touches DOM or audio | Pure `sim.ts`, adapters in `main.ts` | Untestable and non-deterministic |
| Spawn particles with `new` per hit | Preallocated pool | GC hitches exactly when the game feels best |
| Shake and flash with no opt-out | Reduced-motion setting | Motion sickness and photosensitivity risks |
| Declaring done because it compiles | Browser run, console check, frame-time numbers | Most prototype bugs only appear at runtime |
| Copying a commercial game's names, levels or art | Original content in the same genre | Legal risk; unoriginal prototypes teach nothing |

## Verification checklist

- [ ] Core-loop sentence, win and lose conditions written in the plan.
- [ ] Engine choice recorded with a reason.
- [ ] Fixed-timestep loop with interpolation; simulation is pure and seeded.
- [ ] Determinism test and at least one mechanic test pass.
- [ ] Win, lose and fast restart work repeatedly without leaks.
- [ ] Juice pass done; reduced-motion respected.
- [ ] `npm run build` passes (or Godot headless run is clean); zero console errors.
- [ ] p95 frame time at or below 16.7 ms on the dev machine; numbers in the walkthrough.

## Related

- Workflows: `/blueprint`, `/tdd`, `/verify`, `/e2e`, `/checkpoint`.
- Knowledge: `game-architecture`, `godot-engine`, `threejs-webgl`, `procedural-generation`, `game-audio-sfx`, `ai-image-generation`, `accessibility-a11y`, `web-performance`.
- Agents: `game-engine-specialist`, `test-engineer`, `e2e-runner`, `performance-optimizer`.
