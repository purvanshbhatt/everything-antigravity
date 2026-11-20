# Noise, terrain and chunk streaming

## fBm, ridged and billow

```ts
type Noise2 = (x: number, y: number) => number;   // returns roughly [-1, 1]

export function fbm(noise: Noise2, x: number, y: number, octaves = 5, lacunarity = 2.0, gain = 0.5): number {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise(x * freq + i * 19.1, y * freq + i * 7.3); // per-octave offset avoids origin artifacts
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;                                // back to roughly [-1, 1]
}

export const ridged = (n: number): number => { const r = 1 - Math.abs(n); return r * r; }; // sharp crests
export const billow = (n: number): number => Math.abs(n) * 2 - 1;                        // puffy hills
```

| Parameter | Effect | Typical |
| :--- | :--- | :--- |
| Base frequency | Feature size: `x * (1 / featureSizeInWorldUnits)` | Continents: 1/2000; hills: 1/200 |
| Octaves | Detail levels; cost grows linearly | 4-8 |
| Lacunarity | Frequency multiplier per octave | 2.0 |
| Gain (persistence) | Amplitude multiplier per octave | 0.4-0.6 |

## Domain warping

```ts
export function warped(noise: Noise2, x: number, y: number, strength = 4.0): number {
  const qx = fbm(noise, x, y);
  const qy = fbm(noise, x + 5.2, y + 1.3);
  return fbm(noise, x + strength * qx, y + strength * qy);
}
```

Warping bends features into flowing coastlines and ridges. Apply it at low
frequency; warping every octave is expensive and looks noisy.

## Heightmap pipeline

1. Continent mask: low-frequency fBm, optionally minus a radial falloff for islands.
2. Mountains: ridged fBm multiplied by a mask so peaks appear only inland.
3. Detail: higher-frequency fBm at small amplitude.
4. Redistribution: `h = Math.pow(normalized, exponent)` flattens valleys (exponent above 1) or sharpens them.
5. Water level and beaches by threshold; biomes from a temperature x moisture table driven by two more low-frequency fields.
6. Erosion (below), then export.

Export heightmaps as 16-bit (PNG16, R16, or raw float32). 8-bit heightmaps
produce visible terracing on slopes.

## Erosion

| Type | Idea | Cost |
| :--- | :--- | :--- |
| Thermal | For each neighbour lower by more than the talus threshold, move a fraction of the excess downhill | Cheap; softens cliffs |
| Hydraulic (droplet) | Seeded droplets follow the gradient, pick up sediment on steep descent, deposit when slowing or evaporating | Tens to hundreds of thousands of droplets for 512 x 512; realistic gullies |
| Hydraulic (grid/GPU) | Simulate water and sediment fields per cell | Fast on GPU; harder to keep deterministic |

Erosion is non-local: a droplet crosses chunk borders. For streamed worlds,
erode a region larger than the chunk (with an overlap margin) and crop, or
erode a coarse global map once and add non-eroded detail per chunk. Keep
droplet spawning on a seeded stream and process droplets in a fixed order.

GPU noise is fine for visuals, but gameplay-relevant terrain (collision,
spawn validity) should come from CPU code so every machine agrees.

## Chunk streaming

```ts
const CHUNK = 64;                                       // tiles or world units per chunk side
export const chunkOf = (wx: number, wy: number): [number, number] =>
  [Math.floor(wx / CHUNK), Math.floor(wy / CHUNK)];    // floor, not trunc: correct for negatives

export function generateChunk(worldSeed: number, cx: number, cy: number): Float32Array {
  const out = new Float32Array(CHUNK * CHUNK);
  for (let y = 0; y < CHUNK; y++) for (let x = 0; x < CHUNK; x++) {
    const wx = cx * CHUNK + x, wy = cy * CHUNK + y;     // sample in world space: seams match
    out[y * CHUNK + x] = fbm(noise, wx / 200, wy / 200);
  }
  return out;
}
```

- `noise` is created once from the world seed; per-chunk discrete decisions
  (tree placement, ruins) use `streamSeed(world, salt, cx, cy)`.
- Load chunks within radius R of the player, unload beyond R + 2 (hysteresis).
- Generate in a Web Worker / thread pool; transfer typed arrays without copying.
- Cache recent chunks (LRU); persist only player modifications as a diff
  against the generated baseline, keyed by chunk coordinate.
- Features larger than a chunk (rivers, roads, cities): generate them on a
  coarser "region" grid first, then let chunks query the region data.

## Libraries

| Language | Options |
| :--- | :--- |
| JS/TS | `simplex-noise` (pass a seeded PRNG to its factory), FastNoiseLite JS port |
| Godot | Built-in `FastNoiseLite` resource (set `seed`, `noise_type`, `fractal_*`, `domain_warp_*`) |
| C#/C++/Rust/Python | FastNoiseLite ports; `opensimplex` on PyPI; `noise` crate in Rust |

Check each library's docs for the current API and seeding behaviour before
relying on cross-version determinism; pin the version once worlds are shared.
