---
trigger: model_decision
description: Apply when building or modifying a game, game prototype, interactive real-time simulation or game loop in any engine or framework (Godot, Three.js, Phaser, Unity, Bevy, custom canvas or WebGL loops), including movement, physics, input, spawning, effects and game feel.
---

# Game development

## Time

- Never tie movement or simulation to frame rate. Multiply per-frame changes by delta time in variable-rate updates.
- Run physics and gameplay simulation on a fixed timestep with an accumulator, clamp the frame delta to avoid the spiral of death, and interpolate rendering between states:

  ```js
  acc += Math.min(frameDt, 0.25);
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render(acc / STEP); // interpolation alpha
  ```

- Do not double-apply delta: engine APIs such as Godot's `move_and_slide()` or rigid bodies already integrate velocity over the timestep.
- Timers, cooldowns and animations use accumulated time, not frame counts.

## Determinism

- Seed random number generators per system and record the seed so runs, bugs and procedural content are reproducible.
- Replays, lockstep netcode and rollback need a fixed step, a fixed update order and no reliance on unordered iteration or wall-clock time.

## Architecture

- Keep input, game logic and rendering decoupled: input maps devices to actions or intents, logic updates state, rendering reads state and never mutates it.
- Use rebindable input actions, not raw key codes, and buffer inputs per frame.
- Model player, AI and game flow (menu, playing, paused, game over) as explicit state machines.
- Keep game rules (damage, scoring, inventory, progression) in plain, engine-independent code that can be unit-tested headlessly.
- Put tunable values in data (config files, resources, scriptable objects), not magic numbers in code.

## Memory and performance

- Pool frequently spawned objects (bullets, particles, enemies, pickups, audio voices) instead of allocating and freeing each frame.
- No allocations in hot loops: reuse vectors, arrays and temporary objects (for example, scratch `Vector3`s in Three.js).
- Preload assets before gameplay; stream large levels asynchronously.
- Release GPU resources you create (`geometry.dispose()`, `material.dispose()`, `texture.dispose()` in Three.js).
- Budget the frame: 16.6 ms at 60 fps, 8.3 ms at 120 fps. Profile with the engine's profiler before optimizing; watch draw calls, overdraw and physics body counts.

## Game feel (juice)

- Responsive controls: input buffering, coyote time (about 0.1 s) on platformers, variable jump height, acceleration curves.
- Feedback for every player action: sound, particles, hit-stop, camera shake with trauma decay, squash and stretch.
- Make screen shake, flashes and motion effects adjustable or disableable; avoid rapid full-screen flashing (photosensitivity) and respect reduced-motion settings in web games.
- On the web, unlock audio on the first user gesture; browsers block autoplay.

## Persistence and builds

- Version save data and migrate old saves; never crash on an unknown version.
- Pause the simulation when the window or tab loses focus, unless the design says otherwise.
- Test on the lowest target hardware and on high-refresh displays to catch frame-rate-dependent bugs.
