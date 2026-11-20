# Simulation: determinism, replays, pooling

Detail for steps 2, 6 and 7 of the `game-architecture` workflow.

## Loop variants

| Variant | Use when | Notes |
| :--- | :--- | :--- |
| Fixed step + interpolation (default) | Almost every game | Render lags simulation by up to one tick; invisible at 60 Hz |
| Fixed step + extrapolation | Very low tick rates (10-20 Hz servers) | Predict forward from velocity; snaps on collisions |
| Fixed step, render once per tick | Retro/pixel games locked to 60 Hz | Simple, but stutters on 75/144 Hz displays |
| Semi-fixed (variable dt clamped to a max) | Non-physics UI, menus | Not deterministic; never for gameplay physics |

Headless mode: the same `world.step(DT, inputs)` must run without a renderer or
audio device so CI can simulate thousands of ticks in milliseconds. Keep
rendering, audio and input adapters outside the simulation module.

## Determinism rules

1. **One clock.** The simulation counts ticks (`tick: number`). Never read
   `Date.now()`, `performance.now()` or engine time inside `step`.
2. **Seeded randomness.** One PRNG stream per subsystem (`ai`, `loot`, `vfx`),
   each derived from the match seed. Cosmetic randomness (particles, screen
   shake) uses its own stream, so adding a particle never shifts loot rolls.
   See `procedural-generation` for PRNG and hash code.
3. **Stable iteration.** Iterate entities in ID order. Never let gameplay depend
   on hash-map or `Set` iteration order across platforms, or on physics-engine
   contact ordering you do not control.
4. **Floats.** Same binary + same CPU architecture + same inputs is usually
   deterministic. Cross-platform lockstep (x64 vs ARM, different compilers,
   different JS engines' `Math.sin`) is not guaranteed: use fixed-point math or
   a deterministic math library for lockstep, or use server-authoritative state
   sync instead.
5. **Inputs are the only external data.** Record `(tick, playerId, buttons,
   axes)` per tick; quantize analog axes (for example to int8) before they reach
   the simulation so replays match bit for bit.

## Replay and desync detection

```ts
interface TickRecord { tick: number; inputs: Uint8Array; checksum: number }

function checksum(world: World): number {
  // FNV-1a over the fields that matter; skip render-only state
  let h = 0x811c9dc5;
  for (const e of world.entitiesById()) {
    for (const v of [e.id, Math.round(e.x * 1000), Math.round(e.y * 1000), e.hp]) {
      h ^= v & 0xff; h = Math.imul(h, 0x01000193);
      h ^= (v >>> 8) & 0xff; h = Math.imul(h, 0x01000193);
      h ^= (v >>> 16) & 0xff; h = Math.imul(h, 0x01000193);
      h ^= (v >>> 24) & 0xff; h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}
```

Test: record a 60 s session (seed + inputs + checksum per tick), replay it
headlessly, and assert every checksum matches. On mismatch, report the first
diverging tick and diff the two world snapshots at that tick.

## Networking models (choose before writing gameplay)

| Model | Needs | Good for |
| :--- | :--- | :--- |
| Server-authoritative snapshots + client prediction | Server runs the sim; clients predict and reconcile | Shooters, action games, anything with untrusted clients |
| Deterministic lockstep | Bit-exact determinism on all peers; input delay | RTS with thousands of units |
| Rollback (GGPO-style) | Determinism + fast save/load of full state + re-simulation of N ticks per frame | Fighting games, 1v1 action |

Rollback multiplies simulation cost: budget for re-simulating ~8 ticks inside
one frame.

## Object pools

```ts
export class Pool<T> {
  private free: T[] = [];
  constructor(private create: () => T, private reset: (item: T) => void, prewarm = 0) {
    for (let i = 0; i < prewarm; i++) this.free.push(create());
  }
  acquire(): T { return this.free.pop() ?? this.create(); }
  release(item: T): void { this.reset(item); this.free.push(item); }
}

// Usage: const bullets = new Pool(() => new Bullet(), (b) => b.deactivate(), 256);
```

Rules:

- Prewarm to the measured peak during loading, not during gameplay.
- `reset` must clear every field, including listeners, timers and references to
  other entities, or released objects leak state into their next life.
- Guard against double release in debug builds (an `active` flag assert).
- Godot: pool scenes by toggling `visible`, `process_mode` and collision
  layers instead of `queue_free()` + `instantiate()`.

## Spatial partitioning

| Structure | Use when |
| :--- | :--- |
| Uniform grid / spatial hash | Objects of similar size; the default for 2D action games |
| Quadtree / octree | Highly uneven density or very different object sizes |
| Sweep and prune | Many moving objects, mostly along one axis |
| Engine broadphase (Godot, Rapier, Box2D) | Whenever a physics engine is already in use; do not duplicate it |

## Profiling tools

| Platform | Tools |
| :--- | :--- |
| Browser | DevTools Performance (frames, GC, long tasks), Memory heap snapshots, `performance.mark/measure` |
| Godot | Debugger: Profiler, Visual Profiler, Monitors |
| Native C/C++/Rust | Tracy, Superluminal, perf, Instruments, PIX (Windows/Xbox) |
| GPU | RenderDoc, PIX, Xcode GPU capture, Spector.js (WebGL) |
