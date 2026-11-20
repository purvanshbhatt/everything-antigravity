---
name: procedural-generation
description: >-
  Implements seeded, reproducible procedural content: PRNGs and hash-based
  seeding, Perlin, Simplex and OpenSimplex2 noise with fBm and domain warping,
  BSP and cellular-automata dungeons, wave function collapse, Poisson-disk
  sampling, L-systems, heightmap terrain with erosion, and chunk streaming with
  determinism tests. Use when generating levels, maps, terrain, vegetation or
  loot, or when the same seed yields different worlds.
---

# Procedural Generation

Generate content that is varied, valid and exactly reproducible from a seed.
A generator is a pure function `generate(seed, params) -> data`: no global
randomness, no dependence on generation order, and invariants that tests
check across thousands of seeds.

## When to use

- Building dungeons, caves, overworld maps, terrain, vegetation scatter, loot or names from rules.
- Infinite or streamed worlds split into chunks.
- Bugs where one seed produces different output on another machine, run or load order.
- Choosing between noise types or level algorithms for a design goal.

## When not to use

- Loop, entity and save architecture: use `game-architecture` (it consumes generators from here).
- Rendering terrain meshes or instancing vegetation: use `threejs-webgl` or `godot-engine`.
- AI-generated art or textures: use `ai-image-generation`.
- Randomness for security (tokens, keys): use a CSPRNG via `security-audit`, never a game PRNG.

## Workflow

1. **Write the contract and tests first.** Record inputs (seed as uint32, params), output shape, invariants (all rooms reachable, spawn not inside a wall, room count within range) and a time budget per chunk or level. Write a golden test and an invariant sweep before the algorithm (`/tdd`).

   **Check:** Tests exist and fail because the generator is not implemented yet.

2. **Set up seeded streams.** Never use `Math.random()`, the global `random` module or engine-global RNG. Derive independent streams from the world seed with an integer hash (code below) so adding one random call in vegetation does not change the dungeon.

   **Check:** `grep_search` for `Math.random`, `random.random(`, `randf(` and `randi(` finds nothing inside generator modules.

3. **Pick the algorithm** from the decision table. Prototype it on a 2D grid with an ASCII or PNG debug dump before building 3D or engine assets.

   **Check:** A debug image for three seeds is saved and looks like the intended design.

4. **Implement as a pure, engine-free module.** Inputs in, plain data out (arrays, typed arrays, room lists). Rendering, physics and spawning consume the data elsewhere. Algorithms and pseudocode: [algorithms](references/algorithms.md); noise and terrain: [noise and terrain](references/noise-and-terrain.md).

5. **Validate and repair.** Flood-fill reachability, bounds and overlap checks run after generation. On failure, retry with a derived sub-seed (`hash(seed, attempt)`) up to a fixed limit, then fall back to a hand-made layout. Log the seed on every failure.

   **Check:** A 1,000-seed sweep has zero invariant violations and zero fallbacks above the agreed rate.

6. **Chunk and stream** (open worlds). Chunk coordinates use floor division (correct for negatives). Each chunk is generated only from `(worldSeed, cx, cy)` and world-space noise, so seams match and order does not matter. Generate in a worker or thread; keep an LRU cache; use a larger unload radius than load radius to avoid thrashing.

   **Check:** Generating chunk A then B equals generating B then A, byte for byte, and seams show no discontinuity in a debug view.

7. **Lock determinism.** Golden-hash tests per generator version; cross-platform runs (Windows/Linux, Node/browser) when worlds are shared between players; version the generator so old saves keep their worlds.

   **Check:** CI compares the SHA-256 of serialized output for fixed seeds against committed values.

8. **Expose and tune.** Show the seed in the UI and store it in saves; keep tunables in one params object; capture favourite seeds as regression fixtures.

## Patterns

### Seeded PRNG and stream derivation (TypeScript)

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;   // [0, 1)
  };
}

// lowbias32 integer hash (Chris Wellons): good avalanche, cheap
export function hash32(x: number): number {
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export const streamSeed = (world: number, salt: number, cx = 0, cy = 0): number =>
  hash32(world ^ hash32(salt ^ hash32(cx ^ hash32(cy))));

// const rngTrees = mulberry32(streamSeed(worldSeed, SALT.trees, cx, cy));
```

mulberry32 has a 2^32 period: fine for content, not for cryptography or very
long Monte Carlo runs (use xoshiro128** or PCG32 there).

Python equivalents: `random.Random(seed)` per stream (never module-level
`random.seed`), or `numpy.random.default_rng([world_seed, salt, cx_offset,
cy_offset])` (entries must be non-negative, so offset coordinates). Never
derive seeds from built-in `hash()` of a string: it is salted per process.

### Algorithm decision table

| Goal | Algorithm | Guarantees / caveats |
| :--- | :--- | :--- |
| Rooms and corridors, always connected | BSP split + room per leaf + sibling corridors | Connected by construction; can look grid-like |
| Organic caves | Cellular automata (fill about 45 %, 4-5 smoothing passes) | Needs flood fill to keep or connect regions |
| Hand-authored look from small tiles | Wave function collapse (tiled model) | Can contradict: bound retries, or backtrack |
| Natural scatter (trees, rocks, stars) | Poisson-disk (Bridson) | Minimum spacing; O(n) |
| Plants, rivers, branching structures | L-systems with a turtle | Grows exponentially per iteration; cap depth |
| Terrain heightmaps | fBm of OpenSimplex2/Perlin + domain warp + erosion | Erosion is non-local: run per region with overlap |
| Biomes | Two low-frequency noise fields (temperature, moisture) mapped through a table | Smooth borders; tune frequencies separately |
| Loot and encounters | Weighted tables + pity timers driven by a seeded stream | Test distributions statistically |

### Noise selection

| Noise | Use for | Notes |
| :--- | :--- | :--- |
| Value noise | Cheap blobs, retro | Blocky artifacts |
| Perlin (gradient) | Classic terrain, clouds | Axis-aligned artifacts visible at low octave counts |
| Simplex / OpenSimplex2 | Terrain, 3D/4D fields, animation | Fewer directional artifacts; OpenSimplex2 avoids the old simplex patent concerns (expired for 3D+ anyway) |
| Worley (cellular) | Cells, stones, cracks, biome regions | Distance to feature points |

Libraries: FastNoiseLite (many languages; Godot's built-in `FastNoiseLite`
resource), `simplex-noise` on npm (seed it by passing a seeded PRNG function;
check its docs for the current factory API).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| One global RNG shared by every system | Independent seeded streams per subsystem and chunk | Any new call reshuffles every later result |
| Seeding from the clock in generators | Seed is an explicit input, shown and saved | Bugs become unreproducible |
| `Math.trunc(x / size)` for chunk coordinates | `Math.floor(x / size)` | Negative coordinates map two chunks onto one |
| Sampling noise in chunk-local space | Sample in world space | Seams appear at chunk borders |
| Unbounded "retry until valid" loops | Bounded retries, then a fallback layout | Rare seeds hang the game |
| Testing one seed by eye | Golden hashes + 1,000-seed invariant sweep | Rare failures ship to players |
| Changing the algorithm silently | Bump a generator version; keep old versions for old saves | Existing worlds change under players |

## Verification checklist

- [ ] No unseeded randomness in generator code (grep proves it).
- [ ] Same seed and params produce byte-identical output across runs and platforms that share worlds.
- [ ] Chunk output is independent of generation order; seams verified.
- [ ] Invariants hold across a 1,000-seed sweep; p99 generation time is within budget.
- [ ] Golden-hash tests are committed and the generator is versioned.
- [ ] The seed is visible to players and stored in saves.

## Related

- Workflows: `/tdd`, `/game-build`, `/verify`.
- Knowledge: `game-architecture`, `godot-engine`, `threejs-webgl`, `tdd-testing`.
- Agents: `game-engine-specialist`, `test-engineer`, `performance-optimizer`.
