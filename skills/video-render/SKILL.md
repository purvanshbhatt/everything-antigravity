---
name: video-render
description: >-
  Produces a rendered video from a brief: chooses Remotion or ffmpeg, builds
  the composition, previews key frames, renders a master, verifies duration,
  resolution, frame rate and loudness with ffprobe and ebur128, and exports
  platform variants such as 16:9, 9:16 and 1:1. Use when the user asks to
  render, make or export a video, clip, demo or animated explainer. Invoke
  with /video-render.
---

# /video-render

Go from a brief to verified video files. Every deliverable is checked by a
script against a written spec, so "it rendered" is never mistaken for "it is
right". For full productions (script, voice, storyboard) run
`video-production-pipeline` first; this workflow is the render-and-deliver half.

## When to use

- "Render this composition", "export this for YouTube and Shorts", "make a 30 s demo clip".
- Turning existing assets (recordings, images, VO, music) into finished files.
- Producing platform variants and proving they meet spec.

## When not to use

- No script or assets yet: start with `video-production-pipeline`.
- A single conversion or trim of an existing file: use `ffmpeg-multimedia`.
- Designing reusable motion components in depth: use `remotion-motion-graphics`.
- Posting or scheduling uploads: out of scope; deliver files and let the user publish.

## Workflow

1. **Write the render spec.** Save `video/render-spec.json` with the master and each variant (example below). Pull numbers from the brief and the platform table in `video-production-pipeline`; mark platform limits as checked today.

   **Check:** Every target has width, height, fps, duration (or maximum), loudness target and true-peak ceiling.

2. **Choose the tool.**

   | Brief | Tool |
   | :--- | :--- |
   | Animated text, UI callouts, charts, branded templates, many data-driven variants | Remotion |
   | Cutting and joining recordings, overlays, captions, audio replacement | ffmpeg |
   | Animated master plus mechanical variants | Remotion for the master, ffmpeg for variants |

   If Remotion is chosen, remind the user that larger companies may need a Remotion company license (remotion.dev/license).

   **Check:** The choice is recorded in the task list with its reason.

3. **Build the composition.** Remotion: one composition per aspect ratio sharing one component (see `remotion-motion-graphics`). ffmpeg: keep the filtergraph in a script file and the inputs in a manifest. Assets come from `public/` (Remotion) or an assets folder with a license manifest.

4. **Preview before the full render.**

   ```bash
   npx remotion still Promo-16x9 out/stills/f0090.png --frame=90
   npx remotion render Promo-16x9 out/preview.mp4 --frames=0-149 --scale=0.5
   ffmpeg -ss 5 -i out/draft.mp4 -frames:v 1 out/stills/t5.png     # ffmpeg route
   ```

   Show the stills (hook, middle, CTA, each aspect ratio) in an artifact. If the brief asked for review, wait for approval here.

   **Check:** Key frames show correct text, fonts, safe-zone placement and branding.

5. **Render the master.**

   ```bash
   npx remotion render Promo-16x9 out/master.mp4 --codec=h264 --crf=18 --props=./props.json
   ```

   ffmpeg route: final encode with `-c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -ar 48000`.

   **Check:** The render log has no errors or `delayRender` timeouts; the file opens and plays.

6. **Fix loudness if needed.** Measure; if outside target, run two-pass `loudnorm` on the audio with `-c:v copy` (scripts in `ffmpeg-multimedia` references). Never re-encode video just to fix audio.

7. **Verify with the script.** Run it from the project root; the script lives at `<plugin-root>/skills/video-render/scripts/verify-video.mjs` (`<plugin-root>` is two levels above this SKILL.md):

   ```bash
   node <plugin-root>/skills/video-render/scripts/verify-video.mjs out/master.mp4 --width 1920 --height 1080 \
     --fps 30 --duration 45 --lufs -14 --max-true-peak -1 --yuv420p 1 > out/verify/master.json
   ```

   It prints a JSON report (checks plus measured info) and exits 0 (pass), 1 (a check failed) or 2 (usage error or ffmpeg/ffprobe missing). In Windows PowerShell 5.1 use `| Out-File -Encoding utf8 out/verify/master.json` instead of `>` (which writes UTF-16). Also run the black/freeze/silence detection command from the `video-production-pipeline` QA list.

   **Check:** Exit code 0, and any detected black or frozen segments are intentional.

8. **Export variants.** Prefer rendering the per-aspect Remotion compositions. Otherwise derive from the master:

   ```bash
   # 9:16 with a blurred fill instead of black bars
   ffmpeg -i out/master.mp4 -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:2[bg];[0:v]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart out/shorts/shorts.mp4
   # 1:1 center crop
   ffmpeg -i out/master.mp4 -vf "crop=ih:ih,scale=1080:1080,setsar=1" -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -c:a copy -movflags +faststart out/square/square.mp4
   ```

   Add `-t <seconds>` when a platform has a maximum length. Run the verify script on every variant with its own spec.

   **Check:** Every variant has a passing `out/verify/<name>.json`.

9. **Deliver.** Write the walkthrough artifact (output contract below). Uploading, posting or sharing links publicly needs the user's explicit go-ahead.

## Render spec example

```json
{
  "id": "launch-promo",
  "master": { "width": 1920, "height": 1080, "fps": 30, "durationSec": 45, "lufs": -14, "maxTruePeak": -1 },
  "variants": [
    { "name": "youtube", "width": 1920, "height": 1080, "fps": 30 },
    { "name": "shorts", "width": 1080, "height": 1920, "fps": 30, "maxDurationSec": 60 },
    { "name": "square", "width": 1080, "height": 1080, "fps": 30 }
  ],
  "specsCheckedOn": "YYYY-MM-DD"
}
```

## Output contract

```text
out/
  master.mp4
  <variant>/<variant>.mp4
  stills/*.png
  verify/<name>.json        # verify-video.mjs reports, all "pass": true
```

The walkthrough lists each file with resolution, fps, duration, size,
integrated loudness and true peak (copied from the verify reports), the stills,
the tool choice, license notes for music and fonts, and anything not verified.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Render the full video to check a font | Stills and a half-scale excerpt first | Minutes per iteration instead of seconds |
| Declare success when the render exits 0 | Run `verify-video.mjs` against the spec | Wrong fps, size or loudness still exit 0 |
| Re-encode video to fix loudness | Loudnorm the audio with `-c:v copy` | Generation loss and wasted time |
| Crop the 16:9 master blindly | Per-aspect compositions, or blurred fill with checked stills | Text and UI fall outside the frame |
| Overwrite the master while making variants | Separate output folders per variant | One bad command destroys the source |
| Upload or post automatically | Deliver files; publish only with approval | Publishing is public and hard to undo |

## Verification checklist

- [ ] `render-spec.json` exists, with platform limits checked today.
- [ ] Key-frame stills reviewed (and approved, if the brief required it).
- [ ] Master and every variant pass `verify-video.mjs` (exit code 0).
- [ ] Black, freeze and silence detection reviewed.
- [ ] Remotion license reminder given when Remotion was used.
- [ ] Walkthrough artifact lists files, measurements and open risks.

## Related

- Workflows: `/verify`, `/marketing-launch`, `/checkpoint`.
- Knowledge: `video-production-pipeline`, `remotion-motion-graphics`, `ffmpeg-multimedia`, `image-processing-canvas`, `ai-image-generation`, `game-audio-sfx`.
- Agents: `multimedia-producer`, `performance-optimizer`.
