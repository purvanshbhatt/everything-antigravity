---
name: game-audio-sfx
description: >-
  Designs and implements game audio: Web Audio API mixer graphs, audio sprites,
  latency, spatial audio with PannerNode, adaptive and layered music, ducking,
  jsfxr-style procedural SFX, loudness normalization with ffmpeg loudnorm,
  Opus/AAC delivery, Godot audio buses, and audio asset licensing. Use when
  adding sound to a game, when audio lags, clips or stays silent on first load,
  or when music must react to gameplay.
---

# Game Audio and SFX

Make every player action audible within a frame, keep the mix from clipping,
and ship assets that are small, consistent in loudness and legally usable.
Audio bugs are usually architectural: no bus structure, no unlock on user
gesture, unbounded voices, or assets mastered at random levels.

## When to use

- Adding SFX, music or ambience to a web (Canvas, Phaser, Three.js) or Godot game.
- Sound is silent until a reload, plays late, crackles, clips, or piles up when spammed.
- Music should change with intensity, area or boss phase; dialogue should duck music.
- Preparing, normalizing, compressing or licensing an audio asset set.

## When not to use

- Voice-over and music for videos: use `video-production-pipeline` (mastering commands live in `ffmpeg-multimedia`).
- General ffmpeg conversion questions: use `ffmpeg-multimedia`.
- Game loop and event architecture: use `game-architecture`; audio subscribes to its events.
- Engine-specific Godot scene work beyond audio buses: use `godot-engine`.

## Workflow

1. **Inventory events and buses.** List every sound event (UI, player, enemies, impacts, ambience, music, voice) with priority and max simultaneous voices. Buses: `music`, `sfx`, `ui`, `voice` into `master`. Each bus has a user volume gain and a separate duck gain.

   **Check:** A table maps every gameplay event to a sound ID, bus, voice limit and pitch variation.

2. **Unlock and build the graph.** Browsers start audio suspended until a user gesture. Create or resume the `AudioContext` inside the first `pointerdown`/`keydown` handler (the title screen's "Press any key" is ideal). Put a limiter (`DynamicsCompressorNode`) on master.

   **Check:** After the first click, `ctx.state === 'running'` and the console has no autoplay warnings.

3. **Load and decode once.** Fetch and `decodeAudioData` short SFX at load time and cache the `AudioBuffer`s. Pack many tiny SFX into an audio sprite (one file plus an offsets JSON) to cut requests. Stream long music through an `<audio>` element with `MediaElementAudioSourceNode` instead of decoding minutes of PCM into memory.

4. **Play with variation and voice limits.** A new `AudioBufferSourceNode` per play (they are one-shot and cheap). Randomize playback rate by about ±5 % and gain by about ±2 dB; cap voices per sound (4-8) and steal the oldest.

   **Check:** Spamming the fire button for 10 s does not clip the master and does not grow the live-voice count past the cap.

5. **Handle latency and timing.** Use `latencyHint: 'interactive'`. Schedule musical or rhythmic events on `ctx.currentTime`, never `setTimeout`. Read `ctx.baseLatency` and `ctx.outputLatency` (where supported) and offer a calibration offset for rhythm games.

6. **Spatialize.** `StereoPannerNode` for 2D games (pan from screen x). `PannerNode` with `HRTF` for 3D, updating the listener from the camera each frame. Tune `refDistance`, `maxDistance`, `rolloffFactor`; add a low-pass filter for occlusion.

7. **Adaptive music and ducking.** Vertical layering: start all stems at the same `when`, crossfade stem gains with intensity. Horizontal re-sequencing: switch sections on the next bar boundary computed from BPM. Duck the music bus 6-10 dB while voice or key stingers play. Recipes: [Web Audio recipes](references/web-audio-recipes.md).

8. **Master and encode the assets.** Trim silence, fix sample rate (48 kHz), normalize loudness (two-pass `loudnorm` for music and voice, peak normalization for short SFX), then encode Opus with an AAC fallback. Commands and targets: [mastering and licensing](references/mastering-and-licensing.md).

   **Check:** Measured integrated loudness of each music track is within ±1 LU of the chosen target and true peak is at or below -1 dBTP.

9. **Godot projects.** Define buses in the Audio panel (saved as `default_bus_layout.tres`), set each `AudioStreamPlayer*.bus`, use `AudioStreamRandomizer` for variation and `max_polyphony` for voice caps, and an `AudioEffectCompressor` with a `sidechain` bus for ducking (verify property names for your 4.x version).

10. **License every file.** Maintain `assets/audio/LICENSES.csv` with source, author, license and required attribution; reject non-commercial licenses for commercial games and check redistribution terms before committing paid assets to a public repo.

    **Check:** Every file under `assets/audio/` has a manifest row; the credits screen includes all required attributions.

## Patterns

### Unlock, buses and variation (TypeScript)

```ts
type Bus = 'music' | 'sfx' | 'ui' | 'voice';
let ctx: AudioContext | undefined;
const buses = new Map<Bus, { volume: GainNode; duck: GainNode }>();

export async function unlockAudio(): Promise<AudioContext> {   // call from a user-gesture handler
  ctx ??= new AudioContext({ latencyHint: 'interactive' });
  if (ctx.state !== 'running') await ctx.resume();
  if (buses.size === 0) {
    const limiter = new DynamicsCompressorNode(ctx, { threshold: -3, ratio: 20, attack: 0.003, release: 0.1 });
    limiter.connect(ctx.destination);
    for (const name of ['music', 'sfx', 'ui', 'voice'] as const) {
      const volume = new GainNode(ctx);
      const duck = new GainNode(ctx);
      volume.connect(duck).connect(limiter);
      buses.set(name, { volume, duck });
    }
  }
  return ctx;
}

const live = new Map<string, AudioBufferSourceNode[]>();
export function playSfx(id: string, buf: AudioBuffer, bus: Bus = 'sfx', maxVoices = 6, pitchVar = 0.05): void {
  if (!ctx || ctx.state !== 'running') return;
  const voices = live.get(id) ?? [];
  if (voices.length >= maxVoices) voices.shift()?.stop();           // steal the oldest voice
  const src = new AudioBufferSourceNode(ctx, { buffer: buf, playbackRate: 1 + (Math.random() * 2 - 1) * pitchVar });
  src.connect(buses.get(bus)!.volume);
  src.onended = () => { const i = voices.indexOf(src); if (i >= 0) voices.splice(i, 1); };
  voices.push(src);
  live.set(id, voices);
  src.start();
}
```

### Format choice

| Target | Format | Notes |
| :--- | :--- | :--- |
| Web, primary | Opus (`.webm` or `.ogg`) | Smallest at good quality; check `canPlayType('audio/webm; codecs="opus"')` |
| Web, Apple fallback | AAC in `.m4a` | Universally decodable on Safari/iOS |
| Web, last resort | MP3 | Universal; encoder padding complicates seamless loops |
| Godot SFX | WAV 16-bit | Cheapest to decode; short files only |
| Godot music | Ogg Vorbis | Streams; set loop points in the import dock |

### Loudness targets (verify current documents)

There is no single game standard. Commonly cited references: Sony's ASWG-R001
guidance (about -24 LUFS integrated for console/PC and -18 LUFS for mobile),
and streaming platforms normalizing near -14 LUFS for trailers and gameplay
videos. Pick one target per platform, write it in the audio plan, and keep
true peak at or below -1 dBTP.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Create and start an `AudioContext` on page load | Create or resume it in the first user-gesture handler | Autoplay policy keeps it suspended; first sounds are lost |
| `new Audio(url).play()` for every shot | Decoded `AudioBuffer` + one-shot source nodes | HTMLAudio has high latency and limited concurrency |
| Unlimited voices of one sound | Per-sound voice cap with oldest-voice stealing | Spam stacks into clipping and CPU spikes |
| Identical pitch every time | ±5 % rate and small gain variation | Repetition fatigue ("machine-gun effect") |
| Ducking by changing the user volume gain | Separate duck gain node per bus | Ducking overwrites the player's settings |
| `setTimeout` for music transitions | Schedule on `ctx.currentTime` at bar boundaries | Timers drift and stall in background tabs |
| Assets downloaded with unclear licenses | License manifest with source and attribution | Takedowns, store rejection, legal risk |

## Verification checklist

- [ ] Event-to-sound table exists with bus, voice cap and variation per sound.
- [ ] Audio unlocks on the first gesture; no autoplay warnings in the console.
- [ ] Master never clips under a 10 s spam test; voice counts stay capped.
- [ ] Music transitions land on bar boundaries; ducking restores to the user's volume.
- [ ] Music and voice loudness measured within ±1 LU of target, true peak at or below -1 dBTP.
- [ ] Opus plus AAC (web) or WAV/Ogg (Godot) exports exist and play on target browsers/devices.
- [ ] Every audio file has a license manifest row and required credits.

## Related

- Workflows: `/game-build`, `/video-render`, `/verify`.
- Knowledge: `game-architecture`, `godot-engine`, `threejs-webgl`, `ffmpeg-multimedia`, `video-production-pipeline`, `accessibility-a11y`.
- Agents: `multimedia-producer`, `game-engine-specialist`, `performance-optimizer`.
