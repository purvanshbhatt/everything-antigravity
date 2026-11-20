# Web Audio recipes

All recipes assume the `ctx` and `buses` from SKILL.md after `unlockAudio()`.
Check MDN browser-compatibility tables for any API marked "where supported".

## Deferred decoding

Fetch bytes during loading, decode after the unlock gesture:

```ts
const pending = new Map<string, Promise<ArrayBuffer>>();
const decoded = new Map<string, AudioBuffer>();

export function preload(id: string, url: string): void {
  pending.set(id, fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Audio fetch failed (${r.status}): ${url}`);
    return r.arrayBuffer();
  }));
}

export async function decodeAll(ctx: AudioContext): Promise<void> {
  await Promise.all([...pending].map(async ([id, bytes]) => {
    decoded.set(id, await ctx.decodeAudioData(await bytes));
  }));
  pending.clear();
}
```

## Audio sprite

```json
{ "jump": [0.0, 0.25], "coin": [0.5, 0.18], "hit": [1.0, 0.32] }
```

```ts
export function playSprite(ctx: AudioContext, sheet: AudioBuffer, map: Record<string, [number, number]>, id: string, out: AudioNode): void {
  const [offset, duration] = map[id];
  const src = new AudioBufferSourceNode(ctx, { buffer: sheet });
  src.connect(out);
  src.start(ctx.currentTime, offset, duration);
}
```

Leave about 50 ms of silence between sprites: lossy encoders add padding, and
browsers trim it inconsistently, so tight offsets bleed into neighbours.
Measure offsets from the decoded buffer, not from the source WAV, when in doubt.

## Ducking with a dedicated gain

```ts
export function duck(bus: GainNode, ctx: AudioContext, db = -9, attack = 0.08, hold = 0.6, release = 0.5): void {
  const g = bus.gain;
  const t = ctx.currentTime;
  const target = 10 ** (db / 20);
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(target, t + attack);
  g.setValueAtTime(target, t + attack + hold);
  g.linearRampToValueAtTime(1, t + attack + hold + release);
}
// duck(buses.get('music')!.duck, ctx) when a voice line or stinger starts
```

For voice lines of known length, set `hold` to the line duration.

## Vertical layering (stems)

```ts
export function startStems(ctx: AudioContext, stems: AudioBuffer[], out: AudioNode): GainNode[] {
  const when = ctx.currentTime + 0.1;               // shared start keeps stems sample-aligned
  return stems.map((buffer, i) => {
    const gain = new GainNode(ctx, { gain: i === 0 ? 1 : 0 });
    const src = new AudioBufferSourceNode(ctx, { buffer, loop: true });
    src.connect(gain).connect(out);
    src.start(when);
    return gain;
  });
}

export function setIntensity(ctx: AudioContext, gains: GainNode[], level: number): void {
  gains.forEach((g, i) => g.gain.setTargetAtTime(i <= level ? 1 : 0, ctx.currentTime, 0.4));
}
```

All stems must have identical length and tempo, exported from the same session.

## Horizontal re-sequencing on bar boundaries

```ts
export function nextBarTime(ctx: AudioContext, songStart: number, bpm: number, beatsPerBar = 4): number {
  const bar = (60 / bpm) * beatsPerBar;
  const elapsed = ctx.currentTime - songStart;
  return songStart + Math.ceil(elapsed / bar + 1e-6) * bar;
}
// schedule: next.start(t); current.stop(t); where t = nextBarTime(...)
```

If `t - ctx.currentTime` is under about 50 ms, skip to the following bar so the
scheduler is never late.

## Spatial audio

```ts
const panner = new PannerNode(ctx, {
  panningModel: 'HRTF', distanceModel: 'inverse',
  refDistance: 1, maxDistance: 50, rolloffFactor: 1,
});
source.connect(panner).connect(buses.get('sfx')!.volume);

// per frame: emitter and listener positions
panner.positionX.value = e.x; panner.positionY.value = e.y; panner.positionZ.value = e.z;
const L = ctx.listener;
if (L.positionX) {
  L.positionX.value = cam.x; L.positionY.value = cam.y; L.positionZ.value = cam.z;
  L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z;
  L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
} else {
  L.setPosition(cam.x, cam.y, cam.z);              // deprecated fallback for older engines
  L.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
}
```

Three.js wraps this as `AudioListener` (attach to the camera) and
`PositionalAudio`. HRTF costs more CPU than `equalpower`; use it for a handful
of important emitters only.

## Procedural SFX (jsfxr-style)

sfxr-family tools describe a sound with a few parameters: waveform, start
frequency, slide, envelope (attack, sustain, decay), vibrato, duty cycle and
filters. Design sounds in a browser sfxr tool such as jsfxr and export WAV, or
synthesize at runtime:

```ts
export function blip(ctx: AudioContext, out: AudioNode,
  p = { type: 'square' as OscillatorType, f0: 880, f1: 1760, attack: 0.005, sustain: 0.05, decay: 0.12, gain: 0.3 }): void {
  const t = ctx.currentTime;
  const end = t + p.attack + p.sustain + p.decay;
  const osc = new OscillatorNode(ctx, { type: p.type });
  osc.frequency.setValueAtTime(p.f0, t);
  osc.frequency.exponentialRampToValueAtTime(p.f1, end);   // slide
  const env = new GainNode(ctx, { gain: 0 });
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(p.gain, t + p.attack);
  env.gain.setValueAtTime(p.gain, t + p.attack + p.sustain);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(end + 0.02);
}

export function noiseBurst(ctx: AudioContext, out: AudioNode, seconds = 0.4): void {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = new AudioBufferSourceNode(ctx, { buffer: buf });
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 4000 });
  const env = new GainNode(ctx, { gain: 0.6 });
  const t = ctx.currentTime;
  lp.frequency.setValueAtTime(4000, t);
  lp.frequency.exponentialRampToValueAtTime(200, t + seconds);  // explosion "thump"
  env.gain.setValueAtTime(0.6, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  src.connect(lp).connect(env).connect(out);
  src.start(t);
}
```

Recipes: coin = square, rising slide, short decay; laser = saw or square,
falling slide; jump = square, fast rising slide; hit = noise + short decay;
power-up = arpeggio of three blips. Cache the noise buffer instead of
regenerating it per explosion.

## Performance notes

- Disconnect finished nodes (`onended`) only if you keep references; unreferenced
  ended nodes are garbage-collected.
- Keep decoded audio in memory under control: one minute of 48 kHz stereo float
  PCM is about 23 MB. Stream music.
- Pause by `ctx.suspend()` on tab hide (`visibilitychange`) and resume on return.
