# Level and placement algorithms

All code takes an explicit `rng: () => number` in `[0, 1)` created from a
seeded stream (see SKILL.md). Iterate in a fixed order so RNG consumption is
reproducible.

## BSP rooms and corridors (pseudocode)

```text
split(node, depth):
  if depth == MAX_DEPTH or (node.w < 2*MIN_LEAF and node.h < 2*MIN_LEAF): leaf; return
  horizontal = node.h > node.w ? true : node.w > node.h ? false : rng() < 0.5
  pick cut so both halves >= MIN_LEAF (if impossible: leaf; return)
  node.a, node.b = halves
  split(node.a, depth + 1); split(node.b, depth + 1)

rooms: each leaf gets one room of random size inside the leaf minus a margin
connect(node):
  if leaf: return
  connect(node.a); connect(node.b)
  carve an L-shaped corridor between a room in node.a and a room in node.b
```

Connectivity is guaranteed because every split is bridged once. Add a few
extra corridors between random nearby rooms for loops.

## Cellular-automata caves

```ts
export function caveGrid(w: number, h: number, rng: () => number, fill = 0.45, passes = 5): Uint8Array {
  let g = new Uint8Array(w * h);                       // 1 = wall, 0 = floor
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    g[y * w + x] = edge || rng() < fill ? 1 : 0;
  }
  for (let p = 0; p < passes; p++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let walls = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        walls += nx < 0 || ny < 0 || nx >= w || ny >= h ? 1 : g[ny * w + nx];
      }
      next[y * w + x] = walls > 4 ? 1 : walls < 4 ? 0 : g[y * w + x];
    }
    g = next;
  }
  return g;
}
```

Afterwards: label floor regions with a flood fill, keep the largest (or carve
tunnels between region centroids), and reject maps whose largest region is
below a minimum share of the area.

## Wave function collapse (tiled model)

```text
cells[i] = bitset of all tiles; apply fixed constraints (borders, entrances) first
loop:
  c = uncollapsed cell with the lowest entropy (ties broken by rng)
  if none: success
  pick tile for c weighted by tile frequency (rng)
  propagate with a queue (AC-3): for each neighbour, remove tiles that have no
  compatible tile on the shared side; enqueue neighbours of any changed cell
  if a cell reaches zero options: contradiction
on contradiction: restart with hash(seed, attempt) up to N attempts, or
backtrack to the last decision; after N, return a fallback layout
```

Precompute adjacency as bitsets per tile and side. Large outputs contradict
more often: generate in overlapping blocks or add more permissive tiles.

## Poisson-disk sampling (Bridson)

```ts
export function poissonDisk(w: number, h: number, r: number, rng: () => number, k = 30): [number, number][] {
  const cell = r / Math.SQRT2;
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const grid = new Int32Array(gw * gh).fill(-1);
  const pts: [number, number][] = [];
  const active: number[] = [];
  const add = (x: number, y: number): void => {
    pts.push([x, y]);
    active.push(pts.length - 1);
    grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = pts.length - 1;
  };
  add(rng() * w, rng() * h);
  while (active.length > 0) {
    const ai = Math.floor(rng() * active.length);
    const [px, py] = pts[active[ai]];
    let found = false;
    for (let i = 0; i < k && !found; i++) {
      const ang = rng() * Math.PI * 2, rad = r * (1 + rng());
      const x = px + Math.cos(ang) * rad, y = py + Math.sin(ang) * rad;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let ok = true;
      for (let yy = Math.max(gy - 2, 0); yy <= Math.min(gy + 2, gh - 1) && ok; yy++) {
        for (let xx = Math.max(gx - 2, 0); xx <= Math.min(gx + 2, gw - 1) && ok; xx++) {
          const j = grid[yy * gw + xx];
          if (j >= 0) {
            const dx = pts[j][0] - x, dy = pts[j][1] - y;
            if (dx * dx + dy * dy < r * r) ok = false;
          }
        }
      }
      if (ok) { add(x, y); found = true; }
    }
    if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
  }
  return pts;
}
```

`Math.cos`/`Math.sin` can differ in the last bit between JS engines; if worlds
are shared across browsers, quantize positions or use a jittered grid (one
point per cell at a hashed offset), which is also trivially chunkable.

## L-systems

```ts
type Rule = string | [string, number][];          // deterministic or weighted stochastic

export function expand(axiom: string, rules: Record<string, Rule>, n: number, rng: () => number, cap = 1_000_000): string {
  let s = axiom;
  for (let i = 0; i < n; i++) {
    let out = '';
    for (const ch of s) {
      const r = rules[ch];
      if (r === undefined) { out += ch; continue; }
      if (typeof r === 'string') { out += r; continue; }
      const total = r.reduce((a, [, w]) => a + w, 0);
      let t = rng() * total;
      let pick = r[r.length - 1][0];
      for (const [rep, w] of r) { if ((t -= w) < 0) { pick = rep; break; } }
      out += pick;
    }
    if (out.length > cap) throw new Error(`L-system exceeded ${cap} symbols at iteration ${i}`);
    s = out;
  }
  return s;
}
```

Turtle: `F` move forward drawing, `+`/`-` turn by the angle, `[` push state,
`]` pop state. Example plant: axiom `X`, rules `X -> F+[[X]-X]-F[-FX]+X`,
`F -> FF`, angle 25 degrees, 5 iterations.

## Weighted loot with a pity timer

```ts
export function rollLoot(table: { id: string; weight: number }[], rng: () => number): string {
  const total = table.reduce((a, e) => a + e.weight, 0);
  let t = rng() * total;
  for (const e of table) { if ((t -= e.weight) < 0) return e.id; }
  return table[table.length - 1].id;
}
```

Pity: count rolls since the last rare drop and add weight to the rare entry as
the counter grows; reset on drop. Publish odds where regulations require it.

## Tests that catch real failures

```ts
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS, generateDungeon, isFullyConnected } from '../src/gen/dungeon';

const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

describe('dungeon generator v3', () => {
  it('matches golden output', () => {
    expect(sha(generateDungeon(12345, DEFAULT_PARAMS).tiles)).toBe('<committed sha256>');
  });
  it('is connected for 1000 seeds', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      expect(isFullyConnected(generateDungeon(seed, DEFAULT_PARAMS)), `seed ${seed}`).toBe(true);
    }
  });
});
```

Add: an order-independence test for chunks, a timing test (p99 under budget
over the sweep), and a statistical test for loot (observed share within a
tolerance of the expected weight over 100,000 rolls with a fixed seed).
