---
name: video-production-pipeline
description: >-
  Runs end-to-end video production from brief to delivered files: script,
  storyboard, asset list, TTS voice-over with Google Cloud Text-to-Speech or
  Gemini TTS, editing in Remotion or ffmpeg, captions, loudness mastering,
  platform exports for YouTube, Shorts, Reels and TikTok, and a QA checklist.
  Use when the user wants a complete explainer, demo, ad or social video
  produced, not just a single render or conversion step.
---

# Video Production Pipeline

Take a video from idea to platform-ready files with review gates where
changes are cheap (script, storyboard, voice sample) instead of where they
are expensive (after the final render). Each stage produces a file the next
stage consumes, so any stage can be redone without starting over.

## When to use

- "Make a launch video / product demo / explainer / tutorial / ad" with no existing edit.
- Producing a series of similar videos from a template and data.
- Adding synthetic voice-over, captions and music to screen recordings.
- Delivering one story to several platforms (16:9, 9:16, 1:1 or 4:5).

## When not to use

- Rendering or exporting an already-designed composition: use `/video-render`.
- Building the motion-graphics components themselves: use `remotion-motion-graphics`.
- One-off conversions, trims or compressions: use `ffmpeg-multimedia`.
- Launch strategy and messaging: use `/marketing-launch` and `copywriting`; this skill produces the asset.

## Workflow

1. **Brief.** Audience, single goal, call to action, platforms, target length, tone, brand assets (colors, fonts, logo), deadline, and which paid services may be used (TTS, image generation, cloud rendering). Save as `video/brief.md`.

   **Check:** The brief names one goal, one CTA, every target platform and a length per platform.

2. **Script with timing.** Write the VO script line by line with on-screen text alongside. Narration runs about 130-160 words per minute; 60 s is roughly 150 words. Open with the hook in the first 2-3 s. Present it as an artifact for the user to approve.

   **Check:** Word count fits the target length and the user approved the script.

3. **Storyboard.** A table per shot: start, duration, visual, on-screen text, VO line, music/SFX cue, asset IDs. For vertical versions, mark what moves into the safe zone. Template in [specs and QA](references/specs-and-qa.md).

   **Check:** Every VO line maps to a shot, and every shot lists its assets.

4. **Assets.** Build `video/assets/manifest.csv` (file, source, license, attribution). Screen recordings at the master resolution (for example Playwright `recordVideo` at 1920 x 1080), generated images via `ai-image-generation`, icons and cards via `image-processing-canvas`, licensed music only.

   **Check:** Every asset referenced in the storyboard exists and has a license row.

5. **Voice-over.** Pick the engine: Google Cloud Text-to-Speech (many voices and languages, SSML on supported voices) or Gemini TTS (style controlled by natural-language instructions, multi-speaker). Voice and model names change: list them before choosing (see [TTS and voice](references/tts-voice.md)). Generate 2-3 sample voices for the user, then render one WAV per script line at 48 kHz. Fix pronunciations by respelling or SSML. Never clone a real person's voice without written consent; disclose synthetic voices where required.

   **Check:** The user picked the voice; every line exists as its own file; total VO length fits the timing.

6. **Edit.** Remotion for animated typography, UI callouts and templated series; ffmpeg for stitching recordings, trims and overlays. Lock the picture (timing final) before mixing. Delegate the build to the `multimedia-producer` subagent with the storyboard and asset manifest when the edit is large.

   **Check:** A low-resolution preview plays end to end with VO in sync.

7. **Captions.** Generate from the final VO (speech-to-text with word timings, or the script aligned to timings), proofread against the script, export SRT/VTT. Burn captions into vertical versions; upload sidecar captions where the platform supports them.

   **Check:** No caption exceeds 2 lines or about 42 characters per line, and captions are in sync within a few frames.

8. **Mix and master.** VO cleanup (high-pass, gentle compression), music ducked under VO, then two-pass loudnorm to the delivery target (often about -14 LUFS integrated, true peak at most -1 dBTP for social and YouTube; verify current platform guidance). Commands in `ffmpeg-multimedia`.

   **Check:** Measured integrated loudness within ±1 LU of target; true peak at or below -1 dBTP.

9. **Platform exports.** Render a high-quality master, then derive each platform version (re-laid-out compositions beat crops). Run `/video-render` for render, verification and variants.

10. **QA and delivery.** Run the QA checklist (references), fix, then hand over a walkthrough artifact: files, specs, loudness numbers, caption files, asset licenses and upload notes. Uploading or posting to any platform needs the user's explicit go-ahead.

    **Check:** Every item in the QA checklist passes, or the walkthrough lists the exception.

## Patterns

### Directory layout

```text
video/
  brief.md  script.md  storyboard.md
  assets/manifest.csv  assets/{rec,img,music,sfx,fonts}/
  vo/line-01.wav ...      captions/master.srt
  remotion/ (or ffmpeg/)  out/master.mp4  out/<platform>/...
  qa/report.json
```

### Engine choice for the edit

| Content | Use |
| :--- | :--- |
| Kinetic text, UI callouts, charts, branded templates, many variants | Remotion |
| Mostly screen recordings with cuts, overlays, captions | ffmpeg (or Remotion if callouts are heavy) |
| Talking head with B-roll | ffmpeg for assembly; Remotion for lower thirds |
| Data-driven series (one video per customer or release) | Remotion with props from JSON |

### Platform delivery summary (verify current specs before export)

| Platform | Aspect | Resolution | Notes |
| :--- | :--- | :--- | :--- |
| YouTube | 16:9 | 1920 x 1080 or 3840 x 2160 | H.264 + AAC 48 kHz; upload SRT captions; custom thumbnail 1280 x 720 |
| YouTube Shorts | 9:16 | 1080 x 1920 | Length limits have changed over time; check before cutting |
| Instagram Reels | 9:16 | 1080 x 1920 | Keep text out of the bottom and right UI areas |
| TikTok | 9:16 | 1080 x 1920 | Burn captions; strong first 2 s |
| Feeds (Instagram, LinkedIn) | 4:5 or 1:1 | 1080 x 1350 or 1080 x 1080 | Muted autoplay: captions mandatory |

Full table, safe zones and the QA list: [specs and QA](references/specs-and-qa.md).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Start editing before the script is approved | Script and storyboard gates first | Script changes after the edit cost a re-render |
| One TTS file for the whole script | One file per line | Retakes and re-timing touch one line, not everything |
| Crop the 16:9 master for vertical | Re-lay out per aspect ratio | Cropped text and UI fall off screen |
| Rely on platform auto-captions | Proofread SRT, burn for vertical | Auto-captions mangle product names; most feed viewing is muted |
| Master by ear only | Measure LUFS and true peak | Platforms turn loud mixes down and quiet ones sound weak |
| Unlicensed music "for a test" | Licensed or royalty-free with manifest | Content ID claims and takedowns follow the upload |
| Uploading automatically | Deliver files; post only with explicit approval | Publishing is irreversible and public |

## Verification checklist

- [ ] Brief, script and storyboard approved before the edit started.
- [ ] Asset manifest covers every file with license and attribution.
- [ ] VO voice chosen by the user; synthetic-voice disclosure handled.
- [ ] Captions proofread, within line limits, and in sync.
- [ ] Loudness and true peak measured on every deliverable.
- [ ] Each platform export verified with ffprobe (resolution, fps, duration, codecs).
- [ ] QA checklist passed; walkthrough artifact lists files and remaining risks.

## Related

- Workflows: `/video-render`, `/marketing-launch`, `/verify`.
- Knowledge: `remotion-motion-graphics`, `ffmpeg-multimedia`, `ai-image-generation`, `image-processing-canvas`, `game-audio-sfx`, `copywriting`, `gemini-api`, `accessibility-a11y`.
- Agents: `multimedia-producer`, `marketing-strategist`, `gemini-ai-engineer`.
