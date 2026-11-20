# Extended ffmpeg recipes

Options evolve between ffmpeg releases. Confirm with `ffmpeg -h full`,
`ffmpeg -h filter=<name>` or `ffmpeg -h encoder=<name>` on the installed build.

## Two-pass loudness normalization

Targets (verify per platform): streaming video and podcasts commonly sit
around -14 to -16 LUFS integrated; broadcast uses -23 LUFS (EBU R128) or
-24 LKFS (ATSC A/85). Keep true peak at or below -1 dBTP (-1.5 for safety
before lossy encoding).

PowerShell (`loudnorm.ps1 -In in.mp4 -Out out.mp4`):

```powershell
param([Parameter(Mandatory)][string]$In, [Parameter(Mandatory)][string]$Out,
      [double]$I = -16, [double]$TP = -1.5, [double]$LRA = 11)
$measure = "loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json"
$log = (& ffmpeg -hide_banner -nostats -i $In -af $measure -f null - 2>&1) | Out-String
$start = $log.LastIndexOf('{'); $end = $log.LastIndexOf('}')
if ($start -lt 0 -or $end -lt $start) { throw "loudnorm measurement not found for $In" }
$m = $log.Substring($start, $end - $start + 1) | ConvertFrom-Json
$apply = "loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=$($m.input_i):measured_TP=$($m.input_tp):" +
         "measured_LRA=$($m.input_lra):measured_thresh=$($m.input_thresh):offset=$($m.target_offset):" +
         "linear=true:print_format=summary"
& ffmpeg -hide_banner -n -i $In -af $apply -ar 48000 -c:v copy $Out
```

`${I}` needs braces because `$I:` would parse as a scope-qualified variable. In
Windows PowerShell 5.1 with `$ErrorActionPreference = 'Stop'`, redirected
native stderr can raise errors; run with the default preference or use
PowerShell 7.

Bash (`loudnorm.sh in.mp4 out.mp4 [I] [TP] [LRA]`):

```bash
#!/usr/bin/env bash
set -euo pipefail
in="$1"; out="$2"; I="${3:--16}"; TP="${4:--1.5}"; LRA="${5:-11}"
json="$(ffmpeg -hide_banner -nostats -i "$in" -af "loudnorm=I=$I:TP=$TP:LRA=$LRA:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')"
get() { printf '%s' "$json" | sed -n "s/.*\"$1\" : \"\([^\"]*\)\".*/\1/p"; }
ffmpeg -hide_banner -n -i "$in" \
  -af "loudnorm=I=$I:TP=$TP:LRA=$LRA:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true:print_format=summary" \
  -ar 48000 -c:v copy "$out"
```

If the summary reports `Normalization Type: Dynamic`, the target LRA or true
peak could not be met linearly; raise `LRA` or lower the target loudness.

## Measurement and QA filters

```bash
# integrated loudness, LRA, true peak
ffmpeg -hide_banner -nostats -i out.mp4 -af ebur128=peak=true:framelog=quiet -f null -
# black frames, frozen video, silent gaps (all log to stderr)
ffmpeg -hide_banner -nostats -i out.mp4 -vf "blackdetect=d=0.5:pix_th=0.10,freezedetect=n=-60dB:d=2" -af "silencedetect=n=-50dB:d=1" -f null -
# peak and mean volume
ffmpeg -hide_banner -nostats -i in.wav -af volumedetect -f null -
```

## ffprobe one-liners

```bash
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 in.mp4
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,avg_frame_rate,pix_fmt -of json in.mp4
ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 in.mp4
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of json in.mp4
```

## Adaptive HLS ladder

```bash
ffmpeg -i in.mp4 \
  -filter_complex "[0:v]split=3[v1][v2][v3];[v1]scale=-2:1080[v1o];[v2]scale=-2:720[v2o];[v3]scale=-2:480[v3o]" \
  -map "[v1o]" -c:v:0 libx264 -b:v:0 5000k -maxrate:v:0 5350k -bufsize:v:0 7500k \
  -map "[v2o]" -c:v:1 libx264 -b:v:1 2800k -maxrate:v:1 2996k -bufsize:v:1 4200k \
  -map "[v3o]" -c:v:2 libx264 -b:v:2 1400k -maxrate:v:2 1498k -bufsize:v:2 2100k \
  -map 0:a:0 -map 0:a:0 -map 0:a:0 -c:a aac -b:a 128k -ac 2 \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  -f hls -hls_time 6 -hls_playlist_type vod -master_pl_name master.m3u8 \
  -hls_segment_filename "v%v/seg_%03d.ts" -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" "v%v/index.m3u8"
```

Set `-g` to `hls_time` x fps divided by a whole number so segments cut on
keyframes. Serve with correct MIME types and CORS if the player is on another
origin.

## Size-targeted two-pass encode

Bitrate (kbit/s) = target size (MB) x 8192 / duration (s) - audio bitrate.

```bash
ffmpeg -y -i in.mp4 -c:v libx264 -b:v 2000k -preset slow -pass 1 -an -f null -
ffmpeg -i in.mp4 -c:v libx264 -b:v 2000k -preset slow -pass 2 -c:a aac -b:a 128k -movflags +faststart out.mp4
```

Pass logs (`ffmpeg2pass-0.log*`) are written to the current directory; run
parallel jobs in separate directories or set `-passlogfile`.

## Editing operations

| Task | Command fragment |
| :--- | :--- |
| Variable to constant frame rate | `-vf fps=30` (or `-fps_mode cfr -r 30` on recent builds) |
| 2x speed | `-filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2.0[a]" -map "[v]" -map "[a]"` |
| Logo overlay top-right | `-i logo.png -filter_complex "[1:v]scale=200:-1[l];[0:v][l]overlay=W-w-40:40"` |
| Fade in/out (video+audio) | `-vf "fade=t=in:st=0:d=0.5,fade=t=out:st=29.5:d=0.5" -af "afade=t=in:st=0:d=0.5,afade=t=out:st=29.5:d=0.5"` |
| Concat filter (mixed inputs) | `-filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]"` (scale/fps/sample-rate match first) |
| Frames to images | `-vf fps=1 frames/%04d.png` |
| Images to video | `ffmpeg -framerate 30 -i frames/%04d.png -c:v libx264 -crf 18 -pix_fmt yuv420p out.mp4` |
| Contact sheet | `-vf "fps=1/10,scale=320:-2,tile=4x3" -frames:v 1 sheet.jpg` |
| Downmix to stereo | `-ac 2` |
| Mute a section | `-af "volume=enable='between(t,10,12)':volume=0"` |
| Disable auto-rotation | `-noautorotate` before `-i` |

## Styled burned-in subtitles

```bash
ffmpeg -i in.mp4 -vf "subtitles=subs.srt:force_style='FontName=Inter,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,MarginV=60'" -c:a copy out.mp4
```

ASS colours are `&HAABBGGRR` (alpha, blue, green, red). The font must be
installed or provided via the `fontsdir` option. For vertical video, raise
`MarginV` to clear platform UI.

## Long filtergraphs

Keep complex graphs in a text file. Older builds read it with
`-filter_complex_script graph.txt`; recent builds introduced a generic syntax
for loading option values from files and deprecated the old option. Check
`ffmpeg -h full` on the installed version.

## Python wrapper pattern

```python
import json
import subprocess
from pathlib import Path


def probe(path: Path) -> dict:
    """Return ffprobe JSON for a media file; raises CalledProcessError on failure."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    return json.loads(out)
```

Pass arguments as a list (no `shell=True`) so paths with spaces or quotes are
safe on every OS.
