# Platform specs, storyboard template and QA

Platform limits (maximum length, file size, safe areas, recommended bitrates)
change several times a year. Check each platform's current help pages before
final export, and record the date you checked in the walkthrough.

## Delivery specs (starting points; verify)

| Platform | Aspect | Resolution | Video | Audio | Captions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| YouTube (long form) | 16:9 | 1920x1080 (or 3840x2160) | H.264 High, progressive, `yuv420p`, constant frame rate, `+faststart` | AAC-LC 48 kHz stereo | Upload SRT/VTT sidecar |
| YouTube Shorts | 9:16 | 1080x1920 | As above | As above | Burn in |
| Instagram Reels | 9:16 | 1080x1920 | H.264, 30 fps typical | AAC 48 kHz | Burn in |
| TikTok | 9:16 | 1080x1920 | H.264 | AAC 48 kHz | Burn in (plus platform captions) |
| Instagram/LinkedIn feed | 4:5 or 1:1 | 1080x1350 or 1080x1080 | H.264 | AAC | Burn in; most views are muted |
| Website hero loop | 16:9 | 1280-1920 wide | H.264 MP4 + VP9/AV1 WebM, no audio track | none | n/a |

Loudness: most social and streaming platforms normalize playback; mastering
around -14 LUFS integrated with true peak at or below -1 dBTP is a common
target. Check platform guidance and the brief.

## Vertical safe zones (approximate)

Keep titles, captions and key UI inside the central area. As a rule of thumb
for 1080x1920: leave about 250 px at the top, about 400 px at the bottom and
about 150 px on the right free of essential content (platform buttons and
descriptions overlay those areas). Overlay the platform's official safe-zone
template on a still before export when one is available.

## Storyboard template

```markdown
| # | In | Dur | Visual | On-screen text | VO line | Music/SFX | Assets | 9:16 note |
|---|----|-----|--------|----------------|---------|-----------|--------|-----------|
| 1 | 0:00 | 2.5s | Logo builds on dark bg | "Ship 3x faster" | "What if deploys took one command?" | Riser | logo.svg | Center, larger |
| 2 | 0:02.5 | 6s | Screen rec: CLI deploy | "One command" | "..." | Click SFX | rec/deploy.mp4 | Crop to terminal |
```

## Caption rules of thumb

- At most 2 lines, about 42 characters per line (shorter on vertical video).
- Each caption on screen roughly 1-7 s; reading speed around 15-20 characters per second.
- Break lines at phrase boundaries, never between an article and its noun.
- Speaker labels or sound cues in brackets when relevant (`[music]`, `[laughs]`).
- Proofread product names, numbers and code against the script.

SRT example:

```text
1
00:00:00,000 --> 00:00:02,400
What if deploys
took one command?

2
00:00:02,500 --> 00:00:05,900
Meet the new CLI.
```

## Mix chain (ffmpeg)

```bash
# VO cleanup: remove rumble, gentle compression
ffmpeg -i vo.wav -af "highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=5:release=100" vo_clean.wav

# Duck music under VO, then mix
ffmpeg -i vo_clean.wav -i music.wav -filter_complex \
  "[0:a]asplit=2[vo][sc];[1:a]volume=0.5[m];[m][sc]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[duck];[vo][duck]amix=inputs=2:duration=first[mix]" \
  -map "[mix]" -ar 48000 mix.wav
```

`amix` lowers input levels when mixing; on recent builds add `normalize=0`
and set levels explicitly. Finish with two-pass `loudnorm` (see
`ffmpeg-multimedia` references) and measure with `ebur128`.

## QA checklist

Technical (run on every deliverable):

```bash
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,avg_frame_rate,pix_fmt -show_entries format=duration -of json out.mp4
ffmpeg -hide_banner -nostats -i out.mp4 -af ebur128=peak=true:framelog=quiet -f null -
ffmpeg -hide_banner -nostats -i out.mp4 -vf "blackdetect=d=0.5:pix_th=0.10,freezedetect=n=-60dB:d=2" -af "silencedetect=n=-50dB:d=1.5" -f null -
```

- [ ] Resolution, aspect, fps (constant), codec, `pix_fmt yuv420p`, duration as specified.
- [ ] Integrated loudness within ±1 LU of target; true peak at or below -1 dBTP.
- [ ] No unintended black frames, frozen frames or silent gaps (intentional ones listed).
- [ ] A/V sync checked at the start, middle and end (claps, clicks or lip movement).
- [ ] File plays in a browser, on a phone, and in the platform's upload preview.

Editorial:

- [ ] Hook lands in the first 2-3 s; CTA is visible and spoken.
- [ ] Spelling of every on-screen word and caption checked against the script.
- [ ] Text inside safe zones on every vertical version (check stills).
- [ ] Contrast of text over video is readable (outline or backing box).
- [ ] No flashing that exceeds three flashes per second.
- [ ] Brand colors, fonts and logo usage match the brief.

Rights and disclosure:

- [ ] Every asset, font and music track has a license row.
- [ ] Synthetic voice and AI-generated imagery disclosed where required.
- [ ] No third-party trademarks or people without permission.

Record the results in `video/qa/report.json` and summarize them in the walkthrough.
