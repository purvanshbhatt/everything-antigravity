---
name: game-architecture
disable-model-invocation: true
description: >-
  Designs the runtime architecture of a game: fixed-timestep loops with
  interpolation, ECS versus scene-graph versus component models, state
  machines and behaviour trees, input buffering and coyote time, object
  pooling, deterministic seeded simulation, versioned saves and frame-budget
  profiling. Use when starting a game codebase, when movement varies with
  frame rate, or when a game needs replays, saves or a performance budget.
---

# Game Architecture

Build a game runtime whose simulation is independent of the display rate, whose
state can be saved, replayed and tested headlessly, and whose frame time stays
inside a stated budget. These decisions are expensive to reverse, so make them
explicitly and write them down.

## When to use

- Starting a game or prototype and choosing the loop, entity model and state management.
- Movement speed changes with frame rate, physics jitters or tunnels, or the game "runs faster at 144 Hz".
- Adding AI (FSM, HFSM, behaviour tree), save games, replays, or lockstep/rollback networking.
- Frame-time spikes from garbage collection, spawning or unbounded per-frame work.

## When not to use

- Godot node, signal or GDScript questions: use `godot-engine`. Three.js rendering: use `threejs-webgl`.
- Generating levels, terrain or loot tables: use `procedural-generation`.
- Getting a playable prototype on screen end to end: use `/game-build`, which applies this skill.
- Non-game service or application architecture: use `software-architecture`.

## Workflow

1. **Fix the constraints.** Record in an implementation plan artifact: target platforms, display target (60 Hz = 16.67 ms, 120 Hz = 8.33 ms), simulation tick rate, whether determinism is required (replays, lockstep, rollback), peak entity counts, and save requirements.

   **Check:** The plan names the tick rate, the frame budget, determinism yes/no, and the peak entity count.

2. **Build the loop before any gameplay.** Use a fixed-timestep accumulator (below). Gameplay and physics run only in `step(DT)`. Rendering reads state interpolated between the previous and current tick. Clamp the frame delta so a stall cannot cause a spiral of death.

   **Check:** A headless run of N ticks twice yields identical state, and distance travelled after 5 s of simulated time is the same at 30, 60 and 144 fps (throttle with the browser's CPU throttling or a sleep in the loop).

3. **Choose the entity model** with the decision matrix. Default to the engine's native model; add flat arrays for hot homogeneous sets (bullets, particles) before adopting a full ECS.

   **Check:** The rationale is in the plan and one representative entity works end to end.

4. **Model behaviour as explicit states.** FSM for controllers, HFSM when states share sub-behaviour (Grounded → Idle/Run), behaviour trees for AI with many conditions. Each state has `enter`, `exit` and `step(dt)`; transitions live in one table. See [state and AI patterns](references/behaviour-and-saves.md).

   **Check:** Every state has an exit path, and a unit test asserts that an illegal transition is rejected.

5. **Make input responsive.** Sample devices once per rendered frame, latch edges ("pressed since last tick") and consume them in fixed ticks. Implement jump buffering and coyote time as named tunables.

   **Check:** Tests prove a jump pressed 80 ms before landing fires, and one pressed 80 ms after walking off a ledge fires.

6. **Remove allocation from the hot path.** Pool bullets, particles, enemies, damage numbers and audio voices. In JS/C#, avoid per-frame temporary vectors, closures and array spreads.

   **Check:** A 60 s stress run shows a flat heap (DevTools Memory or the engine profiler) and no GC pause above 2 ms in the frame trace.

7. **Make the simulation deterministic** when the plan requires it: seeded PRNG streams per subsystem, no wall-clock reads or `Math.random()` in `step`, stable iteration order, inputs recorded per tick, and a per-tick state checksum. See [simulation notes](references/simulation.md).

   **Check:** Replaying recorded inputs with the same seed reproduces the checksum stream exactly.

8. **Design saves as versioned data.** Serialize plain data with a `version` field, migrate forward step by step, write atomically (temp file, then rename), keep one backup. Never serialize engine objects or use unsafe deserializers (`pickle`, `BinaryFormatter`, arbitrary `.tres` from users).

   **Check:** A round-trip test passes, and a migration test loads a fixture saved by every previous version.

9. **Profile against the budget.** Measure p95/p99 frame time on the minimum-spec target in a stress scene, not average fps. Delegate deep investigations to the `performance-optimizer` subagent with the trace and the budget table.

   **Check:** p99 frame time is under budget, and the numbers are recorded in the walkthrough artifact.

## Patterns

### Fixed timestep with interpolation (TypeScript)

```ts
const DT = 1 / 60;          // simulation step in seconds
const MAX_FRAME = 0.25;     // clamp: drop time instead of spiralling
let acc = 0;
let last = performance.now() / 1000;

function frame(nowMs: number): void {
  const now = nowMs / 1000;
  acc += Math.min(now - last, MAX_FRAME);
  last = now;
  input.poll();                           // once per rendered frame
  while (acc >= DT) {
    world.savePrevious();                 // copy current -> previous transforms
    world.step(DT, input.consumeTick());  // gameplay + physics only here
    acc -= DT;
  }
  renderer.draw(world, acc / DT);         // alpha in [0,1): lerp(prev, curr, alpha)
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

Teleports (respawn, portals) must also reset `previous`, or the renderer draws a streak.

### Entity model decision matrix

| Model | Choose when | Costs |
| :--- | :--- | :--- |
| Scene graph / node tree (Godot nodes, Three.js `Object3D`) | Hierarchical transforms, UI, editor-driven content, up to a few hundred active objects | Per-node overhead; deep trees are slow to traverse |
| Entity + components (GameObject style) | Mixed behaviours composed per object, designer-authored prefabs | Virtual-call overhead; behaviour scattered across components |
| ECS (archetype or sparse set) | Thousands of similar entities, cache-friendly batch systems, parallel systems | Indirection, harder debugging, overkill for small games |
| Data-oriented manager (struct-of-arrays inside one system) | One hot homogeneous set inside a node-based game | Must be wired to the rest of the game by hand |

### Behaviour model selection

| Need | Use |
| :--- | :--- |
| Player controller, door, UI flow, under ~10 states | FSM with a transition table |
| States that share sub-states (Grounded/Airborne) or global interrupts (Hurt, Dead) | HFSM |
| AI with priorities, fallbacks and long-running actions | Behaviour tree (Selector, Sequence, Decorators; ticks return Success/Failure/Running) |
| Many competing actions scored by context | Utility AI |

### Jump buffer and coyote time

```ts
const JUMP_BUFFER = 0.12, COYOTE = 0.10;   // seconds; tune in playtests
let sincePress = Infinity, sinceGround = Infinity;

function stepJump(dt: number, jumpPressedEdge: boolean): void {
  sincePress = jumpPressedEdge ? 0 : sincePress + dt;
  sinceGround = player.onGround ? 0 : sinceGround + dt;
  if (sincePress <= JUMP_BUFFER && sinceGround <= COYOTE) {
    player.vy = -JUMP_SPEED;
    sincePress = sinceGround = Infinity;   // consume both windows
  }
}
```

### Frame budget

| Target | Budget | Typical split (CPU) |
| :--- | :--- | :--- |
| 30 fps | 33.3 ms | Console/mobile cinematic games |
| 60 fps | 16.67 ms | Input 0.5, sim/physics 4, AI 2, animation 2, render submit 4, headroom 4 |
| 120 fps | 8.33 ms | Halve every line above; headroom 1.5 |
| 144 fps | 6.94 ms | Competitive PC; profile on target hardware only |

Keep at least 15-25 % headroom: OS, browser and driver work share the same frame.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `pos += speed` per rendered frame | Multiply by a fixed `DT` inside the tick loop | Speed otherwise scales with refresh rate |
| Variable `dt` into physics | Fixed step plus render interpolation | Variable steps tunnel, jitter and break determinism |
| `Math.random()` inside the simulation | Seeded PRNG stream per subsystem | Replays, tests and networking desync |
| Booleans like `isJumping && !isAttacking` | Explicit states with a transition table | Flag soup yields impossible states |
| `new Bullet()` on every shot | Pre-allocated pool with acquire/release | Allocation churn causes GC hitches |
| Saving engine objects or pickles | Versioned plain data with migrations | Old saves break; unsafe deserializers allow code execution |
| Reporting average fps | Report p95/p99 frame time | Averages hide the hitches players feel |

## Verification checklist

- [ ] Simulation runs only in fixed ticks; rendering interpolates; frame delta is clamped.
- [ ] Movement distance is identical at 30, 60 and 144 fps for the same simulated time.
- [ ] Entity-model and behaviour-model choices are recorded with reasons.
- [ ] Input buffering and coyote time are tunables with tests.
- [ ] Pools cover every frequently spawned object; the stress-run heap is flat.
- [ ] Determinism (if required) is proven by a replay checksum test.
- [ ] Saves carry a version, migrate forward, write atomically and have fixture tests.
- [ ] p99 frame time meets the budget on the minimum-spec target.

## Related

- Workflows: `/game-build`, `/blueprint`, `/tdd`, `/verify`.
- Knowledge: `godot-engine`, `threejs-webgl`, `procedural-generation`, `game-audio-sfx`, `software-architecture`, `tdd-testing`, `web-performance`.
- Agents: `game-engine-specialist`, `performance-optimizer`, `code-architect`, `test-engineer`.
