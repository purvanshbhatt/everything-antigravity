# Audio mastering, encoding, Godot buses and licensing

## Measure first

```bash
ffprobe -v error -show_entries stream=codec_name,sample_rate,channels,duration -of json in.wav
ffmpeg -hide_banner -nostats -i in.wav -af ebur128=peak=true:framelog=quiet -f null -
```

The `ebur128` summary prints integrated loudness (`I:` in LUFS), loudness
range and true peak. `-f null -` works in PowerShell and bash.

## Normalize

Music, ambience and voice (two-pass `loudnorm`; full scripts for PowerShell and
bash are in `ffmpeg-multimedia`):

```bash
# pass 1: measure
ffmpeg -hide_banner -nostats -i music.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null -
# pass 2: apply measured values from pass 1
ffmpeg -i music.wav -af loudnorm=I=-16:TP=-1:LRA=11:measured_I=<input_i>:measured_TP=<input_tp>:measured_LRA=<input_lra>:measured_thresh=<input_thresh>:offset=<target_offset>:linear=true -ar 48000 music_norm.wav
```

`loudnorm` resamples internally, so always set `-ar 48000` on output. Replace
`-16` with the target in your audio plan.

Short SFX (integrated loudness is unreliable under a few seconds): normalize to
a peak, then balance by ear and a per-sound gain table.

```bash
ffmpeg -i hit.wav -af "silenceremove=start_periods=1:start_threshold=-60dB" -ar 48000 hit_trim.wav
```

Read the max level with `-af volumedetect -f null -` and apply the difference
to your peak target (for example -1 dBFS) with `volume=<N>dB`.

## Encode

| Output | Command |
| :--- | :--- |
| Opus (web primary) | `ffmpeg -i in.wav -c:a libopus -b:a 96k out.webm` (music 96-128k, SFX 48-64k) |
| AAC (Apple fallback) | `ffmpeg -i in.wav -c:a aac -b:a 128k out.m4a` |
| MP3 (universal) | `ffmpeg -i in.wav -c:a libmp3lame -q:a 4 out.mp3` |
| Ogg Vorbis (Godot music) | `ffmpeg -i in.wav -c:a libvorbis -q:a 5 out.ogg` |
| WAV 16-bit (Godot SFX) | `ffmpeg -i in.wav -c:a pcm_s16le -ar 48000 out.wav` |

Batch in PowerShell:

```powershell
Get-ChildItem assets/audio/src -Filter *.wav | ForEach-Object {
  $base = Join-Path "assets/audio/web" $_.BaseName
  ffmpeg -hide_banner -loglevel error -n -i $_.FullName -c:a libopus -b:a 64k "$base.webm"
  ffmpeg -hide_banner -loglevel error -n -i $_.FullName -c:a aac -b:a 128k "$base.m4a"
}
```

Bash:

```bash
for f in assets/audio/src/*.wav; do
  b="assets/audio/web/$(basename "${f%.wav}")"
  ffmpeg -hide_banner -loglevel error -n -i "$f" -c:a libopus -b:a 64k "$b.webm"
  ffmpeg -hide_banner -loglevel error -n -i "$f" -c:a aac -b:a 128k "$b.m4a"
done
```

`-n` refuses to overwrite existing outputs; delete stale outputs deliberately.

## Loop points

Seamless loops need sample-accurate edits in the source (zero crossings, matching
tails). MP3 adds encoder padding that breaks gapless loops; use Opus/Vorbis or
WAV for loops. In Web Audio set `loop`, `loopStart`, `loopEnd` on the
`AudioBufferSourceNode`; in Godot set loop options in the Import dock.

## Godot buses (4.x)

- Audio bottom panel: add `Music`, `SFX`, `UI`, `Voice` buses sending to
  `Master`; the layout saves as `default_bus_layout.tres`.
- Players: `AudioStreamPlayer` (non-positional), `AudioStreamPlayer2D/3D`
  (positional). Set `bus` and `max_polyphony`.
- Variation: an `AudioStreamRandomizer` stream with pitch and volume ranges.
- Ducking: `AudioEffectCompressor` on `Music` with its sidechain set to `Voice`.
- Interactive music: recent 4.x versions add interactive, synchronized and
  playlist stream types; check the docs for your version before designing around them.

```gdscript
func set_bus_volume(bus_name: StringName, linear: float) -> void:
	var idx: int = AudioServer.get_bus_index(bus_name)
	AudioServer.set_bus_volume_db(idx, linear_to_db(clampf(linear, 0.0001, 1.0)))
```

Store user volumes as linear 0-1 in settings; convert to dB only at the bus.

## Licensing

| License | Commercial use | Obligations |
| :--- | :--- | :--- |
| CC0 / public domain | Yes | None (credit is courteous) |
| CC BY 4.0 | Yes | Attribution in credits with the license name and link |
| CC BY-SA | Yes | Attribution; share-alike may extend to derived audio; get advice before mixing into proprietary assets |
| CC BY-NC | No | Non-commercial only; avoid for anything that may be sold or monetized |
| Store "royalty-free" packs | Usually yes | Read the EULA: many forbid redistributing raw files, which rules out committing them to a public repo |
| AI-generated audio or voices | Depends on provider terms | Check output-ownership terms; cloned voices need the speaker's written consent |

Manifest (`assets/audio/LICENSES.csv`):

```csv
file,source_url,author,license,attribution,modified,date_added
sfx/hit_01.wav,https://example.org/sound/123,Author Name,CC-BY-4.0,"Hit by Author Name (CC BY 4.0)",trimmed+normalized,2026-01-15
```

Generate the credits screen from this file so attribution cannot drift.
