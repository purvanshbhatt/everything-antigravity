---
name: podcast-production
description: >-
  Produces podcasts end to end: show format and run-of-show, recording setup
  and gain staging, remote double-ender recording, editing, a voice processing
  chain, two-pass loudness normalization with ffmpeg, MP3 export and ID3
  tags, transcripts, show notes with chapters, artwork specs, and RSS
  distribution to Apple Podcasts, Spotify and YouTube. Use when launching a
  show, fixing uneven or noisy audio, or preparing an episode for release.
---

# Podcast Production

Listeners forgive plain production but not bad audio: uneven levels, room echo,
clipping and long rambles. Capture clean, separate tracks, edit for content
before polish, hit a consistent loudness target, and publish with notes that
make the episode findable.

## When to use

- Launching a show: format, gear, workflow, hosting and directory submission.
- An episode sounds quiet, loud, echoey, noisy or inconsistent between speakers.
- Turning raw recordings into a finished MP3 with tags, chapters, transcript and show notes.
- Repurposing a video call or webinar as an episode.

## When not to use

- Video-first shows and channel growth: use `youtube-channel` and `video-production-pipeline`.
- Generated music beds or intros: use `generative-audio`.
- Speech-to-text and TTS system design: use `speech-ai`.
- General ffmpeg conversions: use `ffmpeg-multimedia`.

## Workflow

1. **Define the format.** Audience, promise, length, cadence, segments (cold open, intro, main, ad slot, outro, call to action). Write a run-of-show template every episode follows.

   **Check:** The run-of-show lists segments with target durations that sum to the planned length.

2. **Set up recording.** Dynamic cardioid microphones reject untreated rooms better than condensers. Everyone wears closed headphones. Record each speaker on a separate track as 48 kHz, 24-bit WAV. Set gain so speech peaks around -12 to -6 dBFS. Soften the room with soft furnishings; record 10 seconds of silence (room tone) at the start.

   **Check:** A 30-second test recording peaks below -6 dBFS with no audible echo, hum or fan noise.

3. **Record remote guests as a double-ender.** Each participant records locally (or use a service that records locally and uploads), plus a backup call recording. A clap or spoken count at the start helps sync. Collect a signed guest release before publishing.

   **Check:** Separate local tracks exist for every speaker and line up after syncing.

4. **Edit content first, polish second.** Pass 1: structure (cut tangents, reorder, tighten intro). Pass 2: cleanup (long pauses, false starts, distracting filler, but not every "um"). Use short crossfades at every cut. Text-based editors speed this up; DAWs (Reaper, Audacity, Hindenburg and similar) give finer control. Keep raw files untouched.

   **Check:** Episode length matches the format target; no cut produces a click or breath fragment.

5. **Process each voice.** Order: high-pass filter (70-100 Hz) → light noise reduction (use room tone as the profile) → corrective EQ → compression (about 2:1-4:1, 3-6 dB gain reduction) → de-esser → level match between speakers. Put a true-peak limiter on the master.

   **Check:** Speakers sound equally loud and no section needs the listener to touch the volume.

6. **Normalize loudness in two passes.** Common targets: -16 LUFS integrated for stereo (about -19 LUFS for mono) with true peak at or below -1 dBTP; check your host's and Apple's current recommendations.

   ```bash
   # Pass 1: measure (prints JSON with input_i, input_tp, input_lra, input_thresh, target_offset)
   ffmpeg -hide_banner -i mix.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json -f null -
   # Pass 2: apply, pasting the measured values
   ffmpeg -i mix.wav -af loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=-21.3:measured_TP=-3.2:measured_LRA=7.5:measured_thresh=-31.8:offset=0.4:linear=true -ar 48000 master.wav
   ```

   The commands are the same in PowerShell. Set `-ar` explicitly because loudnorm upsamples internally.

   **Check:** Re-measuring `master.wav` reports integrated loudness within ±1 LU of target and true peak at or below -1 dBTP.

7. **Export and tag.** MP3 at 44.1 kHz, about 128 kbps stereo (or 64-96 kbps mono for speech-only shows):

   ```bash
   ffmpeg -i master.wav -ar 44100 -c:a libmp3lame -b:a 128k -id3v2_version 3 \
     -metadata title="Ep 12: Shipping Faster" -metadata artist="The Show" -metadata album="The Show" ep12.mp3
   ```

   In PowerShell, replace the trailing `\` with a backtick or put the command on one line. Add chapter markers in your editor or host if supported.

   **Check:** The file plays from start to end, tags display in a player, and the size is roughly 1 MB per minute at 128 kbps.

8. **Write the transcript and show notes.** Transcribe with a speech-to-text model, then correct names and terms by hand. Show notes: a two-sentence summary with the episode's promise, timestamps (chapters), guest bio and links, resources mentioned, and one call to action. Delegate the first draft to a subagent with the transcript; never invent quotes or links.

   **Check:** Every timestamp lands on the right moment and every link resolves.

9. **Distribute (confirm first).** A podcast host stores audio and generates the RSS feed. Artwork: square JPEG or PNG in RGB, 3000 x 3000 px recommended (Apple's minimum is 1400 x 1400), readable at thumbnail size. Submit the feed once to Apple Podcasts Connect, Spotify and YouTube; later episodes flow automatically. Publishing and scheduling are public actions: get explicit user confirmation for the date, title and files.

   **Check:** The feed validates in the host's or directory's validator and the episode appears in at least one directory.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Record everyone on one call-mix track | Separate local tracks per speaker | Crosstalk and dropouts cannot be fixed later |
| Gain so high peaks hit 0 dBFS | Peaks around -12 to -6 dBFS | Clipping is permanent |
| Normalize peaks only | Two-pass LUFS normalization plus a true-peak limit | Peak-normal episodes still vary wildly in loudness |
| Heavy noise reduction | Treat the room; light reduction only | Artifacts sound worse than mild noise |
| Commercial songs as intro music | Licensed or royalty-free music with podcast rights | Takedowns and claims |
| Publish without guest consent | Signed release before release day | Legal and relationship risk |

## Verification checklist

- [ ] Separate tracks recorded at 48 kHz/24-bit with healthy peaks.
- [ ] Content edit done before cleanup; crossfades at every cut.
- [ ] Loudness within ±1 LU of target and true peak at or below -1 dBTP.
- [ ] MP3 tagged; transcript corrected; show notes with verified timestamps and links.
- [ ] Music licensed and guest release on file.
- [ ] Publishing was confirmed by the user.

## Related

- Workflows: `/video-render`.
- Knowledge: `ffmpeg-multimedia`, `speech-ai`, `generative-audio`, `youtube-channel`, `content-marketing`, `video-production-pipeline`, `copywriting`.
- Agents: `multimedia-producer`, `marketing-strategist`.
