---
name: generative-audio
disable-model-invocation: true
description: >-
  Creates music and sound with generative models: writing a sonic brief,
  prompting music models (Google Lyria, open models such as MusicGen and
  Stable Audio Open, commercial services), variations with a provenance
  manifest, looping on bar boundaries, stem separation, mixing and loudness, and checking licenses, watermarks and disclosure. Use
  when generating background music, stingers, loops or sound effects for
  apps, games, videos or podcasts.
---

# Generative Audio

Generated audio is fast to make and easy to misuse. Write a precise brief,
generate several variations, pick and edit like a producer, and record the
model, prompt and license for every file so it can be shipped legally.

## When to use

- Background music, intros, stingers or loops for videos, podcasts, apps or games.
- Prototype sound effects or ambience before commissioning final audio.
- Splitting a generated or licensed track into stems for mixing.
- Checking whether generated audio can be used commercially.

## When not to use

- Wiring sounds into a game engine or Web Audio graph: use `game-audio-sfx`.
- Speech synthesis, voice cloning or transcription: use `speech-ai`.
- Mastering and format conversion only: use `ffmpeg-multimedia`.
- Podcast recording and editing: use `podcast-production`.

## Workflow

1. **Write the sonic brief.** Purpose and placement (under narration, menu loop, trailer climax), duration, loopable or not, mood (2-3 adjectives), tempo in BPM, key or tonality, instrumentation, structure, production style, things to exclude (vocals, sudden drops), deliverables (stereo master, stems, loop points, sample rate) and license needs (commercial, broadcast, client work).

   **Check:** The brief fits on one screen and names tempo, length, instrumentation and license need.

2. **Choose a model by license first, quality second.** Terms change; read the current terms before generating anything for release.

   | Option | Access | Typical output | License notes (verify) |
   | :--- | :--- | :--- | :--- |
   | Google Lyria | Vertex AI; Lyria RealTime via the Gemini API | Instrumental clips; real-time streaming | Google Cloud or Gemini API terms; SynthID watermark; check current model IDs and limits |
   | MusicGen (AudioCraft) | Open weights, local GPU | Short clips from text and optional melody | Model weights are non-commercial (CC-BY-NC 4.0) |
   | Stable Audio Open | Open weights, local GPU | Short stereo clips, good for SFX and loops | Stability AI community license with revenue conditions |
   | Commercial music and SFX services | Web or API | Full songs, SFX | Commercial rights depend on plan; read ownership clauses |

   **Check:** The chosen model's license allows the brief's intended use, recorded with a link and date.

3. **Prompt with structure, not artist names.** Describe genre, mood, tempo, key, instruments, arrangement, mix and use. Use negative prompts where supported. Do not name living artists or request soundalikes of specific songs.

   ```text
   Warm lo-fi hip hop instrumental, relaxed and focused, 84 BPM, D minor.
   Rhodes piano chords, brushed drums with soft swing, round upright bass,
   light vinyl crackle. Steady groove, no build or drop, no vocals.
   Intended as a seamless background loop under spoken narration.
   ```

   **Check:** The prompt covers mood, tempo, key, instruments, structure and use, and contains no artist names.

4. **Generate variations and log provenance.** Generate 4-8 candidates per brief with fixed seeds where supported. Log each file in `assets/audio/GENERATED.csv`: file, model and version, prompt, negative prompt, seed, date, account, license link. Delegate batch generation to a subagent if the API is scripted, and have it return only the manifest rows.

   **Check:** Every generated file in the repo has a manifest row.

5. **Select and edit.** Shortlist against the brief, then trim. For loops, cut on bar boundaries: one 4/4 bar lasts `240 / BPM` seconds (84 BPM → 2.857 s), so a loop is a whole number of bars. Cut at zero crossings, or apply a few milliseconds of crossfade, and test the loop point by repeating it several times.

   **Check:** The loop plays 10 times in a row with no click, gap or tempo jump.

6. **Separate stems when needed.** If the model outputs only a mix, a source-separation model such as Demucs splits vocals, drums, bass and other (`demucs --two-stems=vocals track.wav` writes into `separated/`). Expect artifacts; separated stems suit ducking and remixing, not solo exposure.

   **Check:** Stems summed back together sound like the original mix.

7. **Mix basics.** Gain-stage so nothing clips; high-pass non-bass parts; under voice, cut music around 2-4 kHz by a few dB or sidechain-duck it 6-10 dB; keep reverb consistent across cues; match sample rates (48 kHz for video and games). Normalize to the destination: about -14 LUFS for streaming platforms, about -16 LUFS for podcasts, game targets per platform; true peak at or below -1 dBTP (see `ffmpeg-multimedia` for loudnorm commands).

   **Check:** Measured loudness meets the destination target and dialogue stays intelligible over the music.

8. **Clear rights and disclose.** Confirm commercial use is allowed for this account and plan, attribution requirements are met, and output ownership is understood (copyright protection for purely machine-generated works is limited in some jurisdictions; not legal advice). Keep watermarks intact. Follow platform rules on AI-generated or synthetic content disclosure.

   **Check:** The manifest has license, attribution and disclosure columns filled for every file that will ship.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| "In the style of <famous artist>" | Describe instruments, tempo, mood and production | Soundalike and rights risk; often blocked |
| Ship non-commercial model output in a product | Check license before generating | License violation and takedowns |
| Keep only the final file | Manifest with model, prompt, seed and terms | Provenance is needed for audits and claims |
| Loop at arbitrary points | Whole bars at zero crossings or with tiny crossfades | Clicks and tempo jumps every repeat |
| Music at full level under narration | Duck or EQ-carve the music | Voice intelligibility drops |
| Strip or bypass watermarks | Keep provenance signals intact | Breaches terms and erodes trust |

## Verification checklist

- [ ] Brief names purpose, tempo, length, instrumentation and license need.
- [ ] Model license allows the intended use; terms link recorded.
- [ ] Every generated file has a manifest row with prompt, seed and model version.
- [ ] Loops repeat cleanly; stems re-sum to the mix.
- [ ] Loudness and true peak meet the destination target.
- [ ] Attribution and disclosure requirements are satisfied.

## Related

- Knowledge: `game-audio-sfx`, `ffmpeg-multimedia`, `podcast-production`, `speech-ai`, `ai-image-generation`, `video-production-pipeline`, `responsible-ai`.
- Workflows: `/video-render`, `/game-build`.
- Agents: `multimedia-producer`.
