---
name: remotion-motion-graphics
disable-model-invocation: true
description: >-
  Builds programmatic videos with Remotion (React): compositions,
  useCurrentFrame, interpolate and spring animation, Sequence and Series
  timing, audio sync, fonts and assets via staticFile, captions, data-driven
  props, and local or cloud rendering with performance tuning. Use when the
  user wants an animated explainer, product demo, social clip or templated
  video generated from code or data, or a Remotion render is slow or wrong.
---

# Remotion Motion Graphics

Author videos as React components whose every pixel is a pure function of the
frame number. If a frame depends on wall-clock time, CSS transitions or
unseeded randomness, preview and render will disagree; this skill keeps every
frame deterministic and the render fast.

## When to use

- Animated typography, product demos, data-driven or templated videos, social clips, intros and outros.
- Rendering many personalised variants from JSON or a database.
- Syncing animation to voice-over, music beats or captions.
- A Remotion render is slow, flickers, shows missing fonts or images, or drifts out of sync.

## When not to use

- Trimming, transcoding, concatenating or packaging existing footage: use `ffmpeg-multimedia`.
- Planning a whole production (script, voice, storyboard, exports): use `video-production-pipeline`, or `/video-render` for the end-to-end render workflow.
- Interactive real-time 3D in the browser: use `threejs-webgl` (Remotion can embed it via `@remotion/three` for rendered output).

## Workflow

1. **Check the license and set up.** Remotion is free for individuals and small teams, but larger for-profit organisations need a paid company license. Tell the user to check the current terms at remotion.dev/license; do not decide for them. Scaffold with `npx create-video@latest` (pick a template) or add Remotion to an existing repo, on a current LTS Node.

   **Check:** `npx remotion studio` opens and lists the compositions.

2. **Define the composition.** In `src/Root.tsx`, register a `<Composition>` with `id`, `component`, `durationInFrames`, `fps`, `width`, `height`, `defaultProps` and a zod `schema` (editable in Studio). Use `calculateMetadata` when duration depends on data (for example the voice-over length).

   **Check:** The composition appears in Studio with the right resolution, fps and duration.

3. **Animate with frame math only.** `useCurrentFrame()`, `useVideoConfig()`, `interpolate()` with clamping, `spring()`, `Easing`. Never CSS transitions/animations, `setTimeout`, `Date.now()` or `Math.random()`; use `random('seed')` from `remotion` for deterministic randomness.

   **Check:** Scrubbing back and forth in Studio shows identical frames, and two `npx remotion still` renders of the same frame are byte-identical.

4. **Structure time.** `<Sequence from durationInFrames>` shifts time for children (inside it, `useCurrentFrame()` starts at 0). `<Series>` places scenes back to back; `<TransitionSeries>` from `@remotion/transitions` adds fades and slides. Mount heavy scenes slightly early with `premountFor` (verify availability in your version).

5. **Load assets deterministically.** Put files in `public/` and reference them with `staticFile()`. Use Remotion's `<Img>`, video and `<Audio>` components (they block rendering until loaded; check the docs for the currently recommended video/audio components). Load fonts with `@remotion/google-fonts` or `@remotion/fonts`. For async data, wrap fetches in `delayRender()`/`continueRender()`, or better, fetch in `calculateMetadata`.

   **Check:** A render log shows no `delayRender` timeouts and no fallback fonts in stills.

6. **Sync audio.** Convert seconds to frames with `Math.round(seconds * fps)`. Place voice lines in `<Sequence>`s at their cue frames, duck music with a `volume` callback, and derive total duration from the audio in `calculateMetadata`. Recipes: [Remotion recipes](references/remotion-recipes.md).

7. **Add captions.** Generate timed captions (transcription or script alignment), store them as JSON in the `@remotion/captions` `Caption` shape, and render pages of words with highlight on the active word. Keep captions inside platform safe zones.

8. **Render locally.**

   ```bash
   npx remotion render Promo out/promo.mp4 --props=./props.json
   npx remotion still Promo out/frame-090.png --frame=90
   npx remotion render Promo out/promo.mp4 --codec=h264 --crf=18 --concurrency=8
   ```

   `--props` accepts a JSON file path, which avoids shell quoting problems (especially in PowerShell). Run `npx remotion benchmark` to pick a concurrency value.

   **Check:** `ffprobe` reports the expected duration, resolution and fps (see `/video-render` for the full verification).

9. **Render in the cloud only with approval.** Remotion Lambda (`@remotion/lambda`) is the mature option; Cloud Run (`@remotion/cloudrun`) has had a lower maturity status, so check its docs before choosing it. Both create billable cloud resources and need credentials: confirm the account, region and cost with the user before deploying.

10. **Profile slow renders.** Look for heavy work per frame (parsing data, building large arrays, measuring text) and move it into `calculateMetadata` or `useMemo`. Avoid large CSS blurs and filters, oversized images, and thousands of DOM nodes per frame. Delegate deeper analysis to the `multimedia-producer` subagent with the render log and timings.

## Patterns

### Composition and a scene

```tsx
// src/Root.tsx
import { Composition } from 'remotion';
import { z } from 'zod';
import { Promo } from './Promo';

export const promoSchema = z.object({ title: z.string(), accent: z.string() });

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Promo"
    component={Promo}
    schema={promoSchema}
    durationInFrames={300}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ title: 'Ship faster', accent: '#4f46e5' }}
  />
);
```

```tsx
// src/Title.tsx
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Title: React.FC<{ text: string; accent: string }> = ({ text, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });           // 0 -> 1, no overshoot
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b1020' }}>
      <h1 style={{ opacity, transform: `translateY(${(1 - enter) * 40}px)`, color: accent, fontSize: 120 }}>
        {text}
      </h1>
    </AbsoluteFill>
  );
};
```

### Timing helpers

| Need | Use |
| :--- | :--- |
| Scene starts at 2.5 s | `<Sequence from={Math.round(2.5 * fps)}>` |
| Back-to-back scenes | `<Series><Series.Sequence durationInFrames={90}>` |
| Crossfade between scenes | `<TransitionSeries>` with `fade()` and `linearTiming({ durationInFrames: 15 })` |
| Bouncy entrance | `spring({ frame, fps, config: { damping: 12 } })` |
| Exact ease | `interpolate(frame, [a, b], [0, 1], { easing: Easing.bezier(0.33, 1, 0.68, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })` |
| Deterministic jitter | `random('particle-' + i)` |

### Render settings

| Goal | Settings |
| :--- | :--- |
| Social upload master | `--codec=h264 --crf=18` (then let `/video-render` derive variants) |
| Editing intermediate | `--codec=prores` (large files; check the ProRes profile option in the docs) |
| Transparent overlay | ProRes 4444 or VP9/WebM with an alpha-capable pixel format; check the transparency guide |
| Quick preview | `--scale=0.5` or `--frames=0-89` |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| CSS `transition`/`@keyframes` | `interpolate`/`spring` on `useCurrentFrame()` | Frames render out of order in parallel; CSS time does not exist |
| `Math.random()` or `Date.now()` in components | `random(seed)` and frame-derived values | Each render tab produces different frames: flicker |
| Fetch data inside a component without `delayRender` | Fetch in `calculateMetadata` and pass as props | Frames render before data arrives |
| Plain `<img>`/`<video>` tags | Remotion's media components | They are not awaited; frames capture blank media |
| Inline JSON props in PowerShell | `--props=./props.json` | Quoting differs across shells and breaks silently |
| Heavy computation per frame | Precompute once (`calculateMetadata`, `useMemo`) | Cost multiplies by every frame and every tab |
| Deploying Lambda without asking | Confirm account, region and budget first | Creates billable cloud resources |

## Verification checklist

- [ ] The user was told to check Remotion's license terms for their organisation.
- [ ] No CSS animation, `Math.random()` or wall-clock time inside compositions.
- [ ] Stills of the same frame are identical across two renders.
- [ ] Fonts and assets load via `staticFile`/font packages; no `delayRender` timeouts.
- [ ] Audio cues land on the intended frames; music ducks under voice.
- [ ] Output verified with `ffprobe` (duration, resolution, fps, audio present).
- [ ] Cloud rendering, if any, was explicitly approved.

## Related

- Workflows: `/video-render`, `/verify`, `/marketing-launch`.
- Knowledge: `video-production-pipeline`, `ffmpeg-multimedia`, `image-processing-canvas`, `ai-image-generation`, `game-audio-sfx`, `frontend-react-nextjs`.
- Agents: `multimedia-producer`, `typescript-reviewer`, `performance-optimizer`.
