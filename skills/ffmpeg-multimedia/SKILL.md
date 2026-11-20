---
name: ffmpeg-multimedia
description: >-
  Provides ffmpeg and ffprobe recipes: H.264, H.265 and AV1 encoding
  with CRF guidance, trimming without re-encode, concat, scale/pad/crop,
  burned-in versus soft subtitles, audio extraction, two-pass loudnorm, GIF
  palettes, thumbnails, HLS packaging, NVENC/QSV/VideoToolbox encoders and JSON
  inspection, with Windows quoting notes. Use for any audio or video
  conversion, compression, editing or inspection task.
---

# FFmpeg Multimedia

Inspect first, test on a short excerpt, never overwrite the source, and verify
the output with `ffprobe`. Most ffmpeg mistakes are silent: wrong pixel format
for players, cuts that snap to keyframes, audio resampled to 192 kHz, or a
filter that quietly changed the frame rate.

## When to use

- Converting, compressing, trimming, joining, resizing or cropping video or audio.
- Adding subtitles, extracting or replacing audio, normalizing loudness.
- Making GIFs, thumbnails, contact sheets or HLS streams.
- Inspecting media properties or diagnosing "won't play", "out of sync" or "too large".

## When not to use

- Designing animated graphics or templated videos: use `remotion-motion-graphics`.
- Planning a production from script to platform delivery: use `video-production-pipeline` or `/video-render`.
- Still images (resize, AVIF/WebP, social cards): use `image-processing-canvas`.
- Game audio graphs and adaptive music: use `game-audio-sfx`.

## Workflow

1. **Inspect the input.**

   ```bash
   ffprobe -v error -show_format -show_streams -of json input.mp4
   ```

   Note codec, `pix_fmt`, `width`/`height`, `r_frame_rate` versus `avg_frame_rate` (a mismatch means variable frame rate), rotation side data, HDR transfer (`smpte2084`, `arib-std-b67`), audio codec, channels and sample rate.

   **Check:** You can state codec, resolution, fps (constant or variable), duration and audio layout.

2. **Check the build.** `ffmpeg -hide_banner -encoders` (look for `libx264`, `libx265`, `libsvtav1`, `libopus`, hardware encoders), `-filters` (`subtitles` needs libass), `ffmpeg -hide_banner -h encoder=<name>` for an encoder's options. On Windows, install with `winget`, `choco` or `scoop` (verify the package ID).

   **Check:** Every encoder and filter in the planned command is listed.

3. **Choose the recipe** from the table. Prefer stream copy (`-c copy`) when nothing needs re-encoding. Put long filtergraphs in a script file instead of the command line.

4. **Test on an excerpt.** Add `-t 10` (or `-ss 60 -t 10` before `-i`) and write to a new file. Compare quality and size before the full run.

   **Check:** The excerpt plays in the target player, looks right, and the projected full size fits the budget.

5. **Run the full job safely.** Write to a new path; use `-n` to refuse overwrites of existing files. Never delete or replace the source unless the user confirmed it.

6. **Verify the output.** Re-run `ffprobe` and compare duration (within one frame), resolution, fps, codecs and `pix_fmt` to the spec. For audio, measure loudness with `-af ebur128=peak=true:framelog=quiet -f null -`.

   **Check:** All properties match the spec; record them in the walkthrough artifact.

## Recipes

| Task | Command | Notes |
| :--- | :--- | :--- |
| Web MP4 (H.264) | `ffmpeg -i in.mov -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 160k out.mp4` | `yuv420p` for universal playback; `faststart` for streaming |
| H.265/HEVC | `ffmpeg -i in.mov -c:v libx265 -crf 24 -preset slow -tag:v hvc1 -c:a aac -b:a 160k out.mp4` | `hvc1` tag lets Apple players open it |
| AV1 | `ffmpeg -i in.mov -c:v libsvtav1 -crf 32 -preset 6 -c:a libopus -b:a 128k out.webm` | Lower preset = slower and better |
| Fast trim (no re-encode) | `ffmpeg -ss 00:01:00 -i in.mp4 -t 30 -c copy -avoid_negative_ts make_zero clip.mp4` | Starts at the keyframe at or before 1:00 |
| Frame-accurate trim | `ffmpeg -ss 00:01:00 -i in.mp4 -t 30 -c:v libx264 -crf 18 -c:a aac clip.mp4` | Re-encodes; exact start |
| Concat (identical codecs) | `ffmpeg -f concat -safe 0 -i list.txt -c copy joined.mp4` | `list.txt` lines: `file 'part1.mp4'` |
| Fit into 1920x1080 | `-vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1"` | Letterbox without distortion |
| Center crop to 9:16 | `-vf "crop=trunc(ih*9/16/2)*2:ih,scale=1080:1920,setsar=1"` | Even widths avoid encoder errors |
| Burn in subtitles | `ffmpeg -i in.mp4 -vf "subtitles=subs.srt" -c:a copy out.mp4` | Needs libass; always re-encodes video |
| Soft subtitles (MP4) | `ffmpeg -i in.mp4 -i subs.srt -map 0 -map 1 -c copy -c:s mov_text -metadata:s:s:0 language=eng out.mp4` | Toggleable; use `-c:s srt` for MKV |
| Extract audio | `ffmpeg -i in.mp4 -vn -c:a copy audio.m4a` | Only if the stream is AAC; otherwise encode |
| Replace audio | `ffmpeg -i video.mp4 -i music.m4a -map 0:v -map 1:a -c:v copy -c:a aac -shortest out.mp4` | |
| GIF (palette) | `ffmpeg -i in.mp4 -vf "fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif` | Keep GIFs short; offer MP4/WebM instead |
| Thumbnail | `ffmpeg -ss 3 -i in.mp4 -frames:v 1 -q:v 2 thumb.jpg` | `-q:v` 2-5 for JPEG |
| HLS (VOD) | `ffmpeg -i in.mp4 -c:v libx264 -crf 21 -g 48 -keyint_min 48 -sc_threshold 0 -c:a aac -b:a 128k -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_filename "seg_%03d.ts" index.m3u8` | Fixed GOP = clean segment boundaries (`-g` = 2 s at 24 fps) |

More (two-pass loudnorm scripts, ABR ladders, speed changes, overlays,
subtitle styling, detection filters): [recipes](references/recipes.md).

### CRF guidance

| Encoder | Visually near-lossless | Typical web | Small | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `libx264` | 17-18 | 20-23 (default 23) | 26-28 | About +6 CRF halves the bitrate |
| `libx265` | 20-22 | 24-28 (default 28) | 30+ | Same quality as x264 at a lower bitrate, slower |
| `libsvtav1` | 22-26 | 30-35 | 38+ | Range 0-63; preset 4-8 is the usual trade-off |
| `libvpx-vp9` | 24-28 | 31-35 | 38+ | Needs `-b:v 0` for constant quality |

CRF values are not comparable across encoders. Pick by watching the excerpt.

### Hardware encoders (verify with `ffmpeg -h encoder=<name>`)

| Vendor | Encoders | Quality control |
| :--- | :--- | :--- |
| NVIDIA | `h264_nvenc`, `hevc_nvenc`, `av1_nvenc` (recent GPUs) | `-rc vbr -cq 23 -preset p5` |
| Intel Quick Sync | `h264_qsv`, `hevc_qsv`, `av1_qsv` (recent GPUs) | `-global_quality 23` |
| Apple | `h264_videotoolbox`, `hevc_videotoolbox` | `-q:v 60` on Apple Silicon, or `-b:v 8M` |
| AMD | `h264_amf`, `hevc_amf`, `av1_amf` (recent GPUs) | See the encoder help for rate-control options |

Hardware encoders are much faster but need a higher bitrate for the same
quality. Use them for previews, screen recordings and live work; use software
encoders for final masters.

### Windows notes

- PowerShell expands `$` inside double quotes; wrap filtergraphs containing `$` or `"` in single quotes. Windows PowerShell 5.1 mishandles embedded double quotes in native arguments; prefer PowerShell 7.3+.
- In `.bat`/`.cmd` files, write `%` as `%%` (for example `seg_%%03d.ts`); PowerShell and bash need no change.
- The `subtitles` filter parses `:` and `\`: run from the subtitle's folder with a relative name, or escape as `subtitles='C\:/media/subs.srt'`.
- Line continuation: bash `\`, PowerShell backtick, cmd `^`. `-f null -` works on every shell.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Encode without `-pix_fmt yuv420p` from ProRes/PNG sources | Set `yuv420p` for delivery files | 4:2:2/4:4:4 H.264 will not play in many browsers and phones |
| `-c copy` trims expecting frame accuracy | Re-encode, or accept keyframe-aligned cuts | Copy cuts start at the previous keyframe |
| Concat demuxer on mismatched inputs | Normalize codec, resolution, fps and audio first, or use the concat filter | Produces broken timestamps or garbled output |
| Single-pass `loudnorm` on final deliverables | Two-pass with measured values, `linear=true`, `-ar 48000` | One pass is dynamic and audibly pumps; output defaults to 192 kHz |
| GIF straight from video | `palettegen` + `paletteuse` (or ship MP4/WebM) | Default palette bands and bloats files |
| `-y` on commands that write near the source | New output paths and `-n` | One typo overwrites the original |
| Trusting the exit code alone | Verify with `ffprobe` against the spec | ffmpeg succeeds on many semantically wrong outputs |

## Verification checklist

- [ ] Input inspected with `ffprobe`; VFR, rotation and HDR noted.
- [ ] Required encoders and filters exist in this build.
- [ ] A 10 s excerpt was checked before the full job.
- [ ] Source files untouched; outputs written to new paths.
- [ ] Output duration, resolution, fps, codecs and `pix_fmt` match the spec.
- [ ] Loudness measured when audio was processed (target and true peak met).

## Related

- Workflows: `/video-render`, `/verify`.
- Knowledge: `video-production-pipeline`, `remotion-motion-graphics`, `image-processing-canvas`, `game-audio-sfx`.
- Agents: `multimedia-producer`, `performance-optimizer`.
