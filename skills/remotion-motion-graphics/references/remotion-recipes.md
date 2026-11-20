# Remotion recipes

Remotion ships frequent 4.x releases. Package names below are stable, but
check the docs for exact function signatures before relying on them, and keep
every `remotion` and `@remotion/*` package on the same version.

## Voice-over with ducked music

```tsx
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';

export const Soundtrack: React.FC<{ voStartSec: number; voEndSec: number }> = ({ voStartSec, voEndSec }) => {
  const { fps } = useVideoConfig();
  const voStart = Math.round(voStartSec * fps);
  const voEnd = Math.round(voEndSec * fps);
  return (
    <AbsoluteFill>
      <Audio
        src={staticFile('music.mp3')}
        volume={(f) =>
          interpolate(f, [0, 15, voStart, voStart + 10, voEnd, voEnd + 15], [0, 0.6, 0.6, 0.15, 0.15, 0.6], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />
      <Sequence from={voStart}>
        <Audio src={staticFile('voiceover.wav')} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

The `volume` callback receives the frame relative to the audio's own start.
Input ranges passed to `interpolate` must be strictly increasing.

## Duration from data (`calculateMetadata`)

```tsx
import type { CalculateMetadataFunction } from 'remotion';
import { staticFile } from 'remotion';
import { getAudioDurationInSeconds } from '@remotion/media-utils'; // newer docs may point to @remotion/media-parser

type PromoProps = { title: string; voiceover: string };
const FPS = 30;

export const calculatePromoMetadata: CalculateMetadataFunction<PromoProps> = async ({ props }) => {
  const seconds = await getAudioDurationInSeconds(staticFile(props.voiceover));
  return { durationInFrames: Math.ceil((seconds + 1.5) * FPS), props };   // 1.5 s tail for the outro
};
// <Composition ... fps={FPS} calculateMetadata={calculatePromoMetadata} />
```

## Transitions

```tsx
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={90}><Intro /></TransitionSeries.Sequence>
  <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
  <TransitionSeries.Sequence durationInFrames={120}><Demo /></TransitionSeries.Sequence>
</TransitionSeries>
```

Transitions overlap neighbouring scenes: total length is 90 + 120 - 15 frames.

## Fonts

```ts
import { loadFont } from '@remotion/google-fonts/Inter';
export const { fontFamily } = loadFont();            // use fontFamily in styles
```

```ts
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';
loadFont({ family: 'Brand Sans', url: staticFile('fonts/BrandSans-Bold.woff2'), weight: '700' });
```

Check font licenses allow embedding in rendered video.

## Captions

1. Get word timings: transcribe the final voice-over (for example with
   `@remotion/install-whisper-cpp`, which expects 16 kHz mono WAV:
   `ffmpeg -i vo.wav -ar 16000 -ac 1 vo16k.wav`), or align the script with a
   cloud speech-to-text service.
2. Store as JSON in the `Caption` shape from `@remotion/captions`
   (text plus start/end in milliseconds).
3. Group into pages with `createTikTokStyleCaptions()` and render each page in a
   `<Sequence>`; highlight the token whose time range contains the current
   millisecond (`frame / fps * 1000`).
4. Proofread against the script: transcription errors in brand names are common.

Style: 2 lines maximum, high contrast with an outline or box, inside the
platform safe zone, at least about 4 % of frame height for text size on
vertical video.

## One component, several aspect ratios

```tsx
const formats = [
  { id: 'Promo-16x9', width: 1920, height: 1080 },
  { id: 'Promo-9x16', width: 1080, height: 1920 },
  { id: 'Promo-1x1', width: 1080, height: 1080 },
] as const;

export const RemotionRoot: React.FC = () => (
  <>
    {formats.map((f) => (
      <Composition key={f.id} id={f.id} component={Promo} schema={promoSchema}
        durationInFrames={300} fps={30} width={f.width} height={f.height}
        defaultProps={{ title: 'Ship faster', accent: '#4f46e5' }} />
    ))}
  </>
);
// inside Promo: const { width, height } = useVideoConfig(); const vertical = height > width;
```

Re-laying out per format beats cropping a 16:9 master: text stays in safe zones.

## Batch rendering from data (Node API)

```ts
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
for (const item of items) {                          // items: { slug, title }[] loaded from JSON
  const inputProps = { title: item.title, accent: '#4f46e5' };
  const composition = await selectComposition({ serveUrl, id: 'Promo-16x9', inputProps });
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: `out/${item.slug}.mp4`, inputProps });
}
```

Bundle once, render many. Render sequentially (each render already uses
multiple browser tabs) or cap parallel renders to avoid exhausting memory.

## Remotion Lambda outline (requires user approval)

```bash
npx remotion lambda policies role          # prints the IAM policy to attach manually
npx remotion lambda functions deploy
npx remotion lambda sites create src/index.ts --site-name=promo
npx remotion lambda render <serve-url> Promo-16x9 --props=./props.json
```

Credentials come from environment variables documented by Remotion; never
hardcode them. Confirm the AWS account, region, concurrency limits and
expected cost before running any deploy command, and check the Lambda docs for
current flags.

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| Flicker between frames | Non-deterministic values or CSS animation | Derive everything from `useCurrentFrame()`; `random(seed)` |
| Blank images or video in output | Plain `<img>`/`<video>` | Remotion media components |
| `delayRender` timeout | 404/CORS on an asset, or a handle never continued | Check the network tab in Studio; always call `continueRender` or `cancelRender` |
| Audio drifts from visuals | fps mismatch between assumptions and composition | Read `fps` from `useVideoConfig()`; round seconds to frames once |
| Wrong font in render | Font loaded after first frame | Load fonts at module level via the font packages |
| Slow renders | Per-frame heavy work, big blurs, huge images | Precompute, pre-size images, run `npx remotion benchmark` |
