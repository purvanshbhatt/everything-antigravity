# Canvas 2D starter (TypeScript + Vite)

An original, minimal arena game: collect 10 orbs, avoid bouncing hazards.
It demonstrates every requirement of `/game-build`: pure seeded simulation,
fixed timestep with interpolation, latched input, win/lose/restart, pooled
particles, screen shake, hit-stop, synthesized SFX, reduced-motion support, a
debug overlay and a dev-only test hook. Replace the mechanic; keep the
structure.

## `index.html` (body)

```html
<canvas id="game" width="960" height="540"></canvas>
<style>
  html, body { margin: 0; height: 100%; background: #05070d; display: grid; place-items: center; }
  canvas { width: min(100vw, 960px); height: auto; }
</style>
<script type="module" src="/src/main.ts"></script>
```

## `src/rng.ts`

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

## `src/sim.ts` (pure: no DOM, audio or clock)

```ts
import { mulberry32 } from './rng';

export const CFG = {
  w: 960, h: 540, speed: 260, orbsToWin: 10, hazardCount: 6, hazardSpeed: 140,
  collectStop: 0.04, deathStop: 0.12,
} as const;

export type Phase = 'title' | 'playing' | 'won' | 'lost';
export type GameEvent = 'start' | 'collect' | 'death' | 'win';
export interface Body { x: number; y: number; px: number; py: number; vx: number; vy: number; r: number }
export interface Input { x: number; y: number; start: boolean; restart: boolean }

export interface World {
  phase: Phase; seed: number; tick: number; score: number;
  hitStop: number; pendingLoss: boolean; rng: () => number;
  player: Body; orb: Body; hazards: Body[]; events: GameEvent[];
}

const body = (x: number, y: number, r: number, vx = 0, vy = 0): Body => ({ x, y, px: x, py: y, vx, vy, r });
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const overlaps = (a: Body, b: Body): boolean => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < (a.r + b.r) ** 2;
const savePrev = (b: Body): void => { b.px = b.x; b.py = b.y; };

export function createWorld(seed: number): World {
  const rng = mulberry32(seed);
  const hazards = Array.from({ length: CFG.hazardCount }, () => {
    const a = rng() * Math.PI * 2;
    return body(rng() * CFG.w, rng() < 0.5 ? 30 : CFG.h - 30, 14, Math.cos(a) * CFG.hazardSpeed, Math.sin(a) * CFG.hazardSpeed);
  });
  const w: World = {
    phase: 'title', seed, tick: 0, score: 0, hitStop: 0, pendingLoss: false, rng,
    player: body(CFG.w / 2, CFG.h / 2, 12), orb: body(0, 0, 9), hazards, events: [],
  };
  placeOrb(w);
  return w;
}

function placeOrb(w: World): void {
  w.orb.x = w.orb.px = 40 + w.rng() * (CFG.w - 80);   // teleport: reset previous too
  w.orb.y = w.orb.py = 40 + w.rng() * (CFG.h - 80);
}

export function step(w: World, input: Input, dt: number): void {
  if (input.restart || (w.phase !== 'playing' && input.start)) {
    Object.assign(w, createWorld(w.seed + 1), { phase: 'playing' as Phase });
    w.events.push('start');
    return;
  }
  if (w.phase !== 'playing') return;
  if (w.hitStop > 0) {                                  // hit-stop: simulation frozen, rendering continues
    w.hitStop -= dt;
    if (w.hitStop <= 0 && w.pendingLoss) w.phase = 'lost';
    return;
  }
  w.tick++;
  const p = w.player;
  savePrev(p); savePrev(w.orb);
  for (const h of w.hazards) savePrev(h);

  const len = Math.hypot(input.x, input.y) || 1;
  p.x = clamp(p.x + (input.x / len) * CFG.speed * dt, p.r, CFG.w - p.r);
  p.y = clamp(p.y + (input.y / len) * CFG.speed * dt, p.r, CFG.h - p.r);

  for (const h of w.hazards) {
    h.x += h.vx * dt; h.y += h.vy * dt;
    if (h.x < h.r || h.x > CFG.w - h.r) { h.vx = -h.vx; h.x = clamp(h.x, h.r, CFG.w - h.r); }
    if (h.y < h.r || h.y > CFG.h - h.r) { h.vy = -h.vy; h.y = clamp(h.y, h.r, CFG.h - h.r); }
    if (overlaps(p, h)) {
      w.hitStop = CFG.deathStop; w.pendingLoss = true; w.events.push('death');
      return;
    }
  }
  if (overlaps(p, w.orb)) {
    w.score++; w.hitStop = CFG.collectStop; w.events.push('collect');
    if (w.score >= CFG.orbsToWin) { w.phase = 'won'; w.events.push('win'); }
    else placeOrb(w);
  }
}
```

## `src/main.ts` (loop, input, render, juice, audio)

```ts
import { CFG, createWorld, step, type Body, type GameEvent, type Input } from './sim';
import { mulberry32 } from './rng';

const DT = 1 / 60;
const MAX_FRAME = 0.25;
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ctx = canvas.getContext('2d')!;
const seed = Number(new URLSearchParams(location.search).get('seed')) || (Date.now() >>> 0);
const world = createWorld(seed);                          // seed shown in the overlay; ?seed= reproduces a run
const fx = mulberry32(0xc0ffee);                          // cosmetic randomness, separate from the simulation
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- input: held keys plus latched presses consumed by the next tick
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);
const held = new Set<string>();
let startLatch = false, restartLatch = false, debug = false;
addEventListener('keydown', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();          // no page scrolling
  held.add(e.code);
  if (!e.repeat && (e.code === 'Enter' || e.code === 'Space')) startLatch = true;
  if (!e.repeat && e.code === 'KeyR') restartLatch = true;
  if (!e.repeat && e.code === 'Backquote') debug = !debug;
  unlockAudio();
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());
const axis = (neg: string, neg2: string, pos: string, pos2: string): number =>
  (held.has(pos) || held.has(pos2) ? 1 : 0) - (held.has(neg) || held.has(neg2) ? 1 : 0);
const input: Input = { x: 0, y: 0, start: false, restart: false };

// ---- audio: unlocked by the first key press, synthesized blips
let actx: AudioContext | undefined;
function unlockAudio(): void {
  actx ??= new AudioContext({ latencyHint: 'interactive' });
  if (actx.state !== 'running') void actx.resume();
}
function sfx(f0: number, f1: number, dur: number, type: OscillatorType = 'square'): void {
  if (!actx || actx.state !== 'running') return;
  const t = actx.currentTime, pitch = 1 + (fx() * 2 - 1) * 0.05;
  const osc = new OscillatorNode(actx, { type });
  const g = new GainNode(actx, { gain: 0.15 });
  osc.frequency.setValueAtTime(f0 * pitch, t);
  osc.frequency.exponentialRampToValueAtTime(f1 * pitch, t + dur);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(actx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// ---- juice: trauma shake, flash, pooled particles
let trauma = 0, flash = 0;
interface Particle { x: number; y: number; vx: number; vy: number; life: number }
const pool: Particle[] = Array.from({ length: 256 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0 }));
function burst(x: number, y: number, n: number, speed: number): void {
  for (const p of pool) {
    if (n <= 0) break;
    if (p.life > 0) continue;
    const a = fx() * Math.PI * 2, s = speed * (0.4 + fx() * 0.6);
    p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = 0.3 + fx() * 0.3;
    n--;
  }
}
function onEvent(e: GameEvent): void {
  const { x, y } = world.player;
  if (e === 'collect') { trauma = Math.min(1, trauma + 0.25); burst(x, y, 12, 220); sfx(660, 1320, 0.12); }
  if (e === 'death') { trauma = 1; flash = 0.08; burst(x, y, 40, 360); sfx(300, 40, 0.4, 'sawtooth'); }
  if (e === 'win') sfx(523, 1046, 0.5, 'triangle');
  if (e === 'start') { trauma = 0; for (const p of pool) p.life = 0; }
}
function updateFx(dt: number): void {
  trauma = Math.max(0, trauma - 1.5 * dt);
  flash = Math.max(0, flash - dt);
  for (const p of pool) {
    if (p.life <= 0) continue;
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
  }
}

// ---- rendering with interpolation
const MESSAGES = { title: 'Collect 10 orbs, avoid red. Enter to start', won: 'You win! Enter to play again', lost: 'Hit! Enter to retry' } as const;
function disc(b: Body, alpha: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(b.px + (b.x - b.px) * alpha, b.py + (b.y - b.py) * alpha, b.r, 0, Math.PI * 2);
  ctx.fill();
}
function draw(alpha: number): void {
  const s = reducedMotion ? 0 : 12 * trauma * trauma;
  ctx.setTransform(1, 0, 0, 1, (fx() * 2 - 1) * s, (fx() * 2 - 1) * s);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(-16, -16, CFG.w + 32, CFG.h + 32);
  disc(world.orb, alpha, '#f5b700');
  for (const h of world.hazards) disc(h, alpha, '#ef4444');
  disc(world.player, alpha, '#38bdf8');
  ctx.fillStyle = '#ffffff';
  for (const p of pool) if (p.life > 0) ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (flash > 0 && !reducedMotion) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 0, CFG.w, CFG.h); }
  ctx.fillStyle = '#e5e7eb'; ctx.font = '20px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(world.phase === 'playing' ? `${world.score} / ${CFG.orbsToWin}` : MESSAGES[world.phase], CFG.w / 2, 32);
  if (debug) drawOverlay();
}

// ---- frame stats, overlay and dev-only test hook
const frameMs = new Float32Array(120);
let frameIdx = 0;
function frameStats(): { avgMs: number; p95Ms: number; fps: number } {
  const v = Array.from(frameMs).filter((x) => x > 0).sort((a, b) => a - b);
  const avgMs = v.reduce((sum, x) => sum + x, 0) / Math.max(v.length, 1);
  return { avgMs, p95Ms: v[Math.floor(v.length * 0.95)] ?? 0, fps: avgMs ? 1000 / avgMs : 0 };
}
function drawOverlay(): void {
  const { avgMs, p95Ms, fps } = frameStats();
  ctx.textAlign = 'left'; ctx.font = '14px ui-monospace, monospace'; ctx.fillStyle = '#a3e635';
  ctx.fillText(`fps ${fps.toFixed(0)}  avg ${avgMs.toFixed(1)}ms  p95 ${p95Ms.toFixed(1)}ms  seed ${world.seed}  tick ${world.tick}`, 8, CFG.h - 10);
}
declare global { interface Window { __game?: { world: typeof world; stats: typeof frameStats } } }
if (import.meta.env.DEV) window.__game = { world, stats: frameStats };

// ---- fixed-timestep loop
let acc = 0, last = performance.now() / 1000;
function frame(nowMs: number): void {
  const now = nowMs / 1000, raw = now - last;
  last = now;
  frameMs[frameIdx++ % frameMs.length] = raw * 1000;
  acc += Math.min(raw, MAX_FRAME);
  input.x = axis('ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD');
  input.y = axis('ArrowUp', 'KeyW', 'ArrowDown', 'KeyS');
  input.start = startLatch; input.restart = restartLatch;
  while (acc >= DT) {
    step(world, input, DT);
    input.start = input.restart = false; startLatch = restartLatch = false;   // latches consumed once
    for (const e of world.events) onEvent(e);
    world.events.length = 0;
    updateFx(DT);
    acc -= DT;
  }
  draw(acc / DT);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

## `tests/sim.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CFG, createWorld, step, type Input } from '../src/sim';

const DT = 1 / 60;
const idle: Input = { x: 0, y: 0, start: false, restart: false };
const start: Input = { ...idle, start: true };

function run(seed: number, ticks: number, input: Input) {
  const w = createWorld(seed);
  step(w, start, DT);
  for (let i = 0; i < ticks; i++) step(w, input, DT);
  return w;
}

describe('sim', () => {
  it('is deterministic for the same seed and inputs', () => {
    const a = run(7, 600, { ...idle, x: 1 });
    const b = run(7, 600, { ...idle, x: 1 });
    expect([a.player.x, a.player.y, a.score, a.phase, a.tick]).toEqual([b.player.x, b.player.y, b.score, b.phase, b.tick]);
  });

  it('keeps the player inside the arena', () => {
    const w = run(3, 600, { ...idle, x: 1, y: 1 });
    expect(w.player.x).toBeLessThanOrEqual(CFG.w - w.player.r);
    expect(w.player.y).toBeLessThanOrEqual(CFG.h - w.player.r);
  });

  it('scores when the player touches the orb', () => {
    const w = createWorld(1);
    step(w, start, DT);
    w.hazards.length = 0;
    w.orb.x = w.player.x; w.orb.y = w.player.y;
    step(w, idle, DT);
    expect(w.score).toBe(1);
  });

  it('loses after hit-stop when touching a hazard', () => {
    const w = createWorld(1);
    step(w, start, DT);
    const h = w.hazards[0];
    h.x = w.player.x; h.y = w.player.y; h.vx = 0; h.vy = 0;
    for (let i = 0; i < 30; i++) step(w, idle, DT);
    expect(w.phase).toBe('lost');
  });
});
```

Add `"test": "vitest run"` to `package.json` scripts. The Vite `vanilla-ts`
template's `vite-env.d.ts` provides the `import.meta.env` types used above.
