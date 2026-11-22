---
name: speech-ai
description: >-
  Builds speech features: transcription with Cloud Speech-to-Text or Gemini
  audio understanding, speaker diarization, streaming recognition,
  text-to-speech with Cloud Text-to-Speech or Gemini speech generation,
  realtime voice agents and latency budgets, audio formats, WER and
  diarization evaluation, and consent for recording and synthetic voices. Use
  when adding transcription, captions, voice input, spoken output, call
  analytics or a voice assistant.
---

# Speech AI

Choose the engine by what you need from the audio: exact words with timings,
meaning, or a natural voice. Then design around audio quality and the latency
budget, and measure with the right error rate.

## When to use

- Transcripts, captions, meeting or call analytics, voice search or dictation.
- Spoken responses, IVR prompts, accessibility narration.
- Realtime voice assistants that must feel conversational.

## When not to use

- Video with visual questions: `multimodal-understanding`. Encoding and editing audio: `ffmpeg-multimedia`.
- Music and sound effects: `generative-audio`. Podcast workflow: `podcast-production`.
- WebSocket transport and scaling: `realtime-websockets`.

## Workflow

1. **Choose the engine.**

   | Need | Engine |
   | :--- | :--- |
   | Accurate transcript, word timestamps, diarization, batch at scale | Cloud Speech-to-Text V2 (Chirp model family; check model names per region and language) |
   | Summary, action items or sentiment straight from audio | Gemini audio understanding (one call; timestamps are approximate) |
   | Auditable pipeline | Speech-to-Text first, then Gemini on the transcript |
   | Natural voices, many languages, SSML | Cloud Text-to-Speech (list voices per language) |
   | Expressive or multi-speaker generated speech | Gemini speech-generation models (often preview; check the models list) |
   | Realtime spoken conversation | Gemini Live API (bidirectional audio streaming, interruptions) |
   | Offline or on-premises | Open models such as Whisper variants; pyannote for diarization |

   **Check:** the decision records the required features: timestamps, diarization, languages, latency and data location.

2. **Normalize the audio.** Mono, 16 kHz, lossless for recognition; telephony audio is 8 kHz, so use telephony-tuned models rather than upsampling.

   ```bash
   ffmpeg -i input.m4a -ac 1 -ar 16000 -c:a flac out.flac
   ffprobe -v error -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 out.flac
   ```

   **Check:** `ffprobe` prints `flac,16000,1`.

3. **Transcribe in batch with diarization (Speech-to-Text V2).**

   ```python
   from google.cloud.speech_v2 import SpeechClient
   from google.cloud.speech_v2.types import cloud_speech as cs

   client = SpeechClient()  # regional: client_options={"api_endpoint": f"{REGION}-speech.googleapis.com"}
   config = cs.RecognitionConfig(
       auto_decoding_config=cs.AutoDetectDecodingConfig(),
       language_codes=["en-US"],
       model=STT_MODEL,                       # check availability for region and language
       features=cs.RecognitionFeatures(
           enable_word_time_offsets=True,
           enable_automatic_punctuation=True,
           diarization_config=cs.SpeakerDiarizationConfig(min_speaker_count=2, max_speaker_count=4),
       ),
   )
   op = client.batch_recognize(request=cs.BatchRecognizeRequest(
       recognizer=f"projects/{PROJECT}/locations/{REGION}/recognizers/_",
       config=config,
       files=[cs.BatchRecognizeFileMetadata(uri="gs://<BUCKET>/call.flac")],
       recognition_output_config=cs.RecognitionOutputConfig(
           gcs_output_config=cs.GcsOutputConfig(uri="gs://<BUCKET>/transcripts/")),
   ))
   op.result(timeout=3600)
   ```

   Diarization and word offsets vary by model and language; confirm in the support table.

   **Check:** output JSON contains words with offsets and speaker tags; three speaker turns were spot-checked by ear.

4. **Use Gemini for meaning.** Upload with the Files API and request schema output: segments with `MM:SS` timestamps, speaker descriptions, summary, decisions and action items. At about 32 tokens per second, one hour of audio is roughly 115k input tokens. Treat its timestamps as approximate and join with Speech-to-Text word offsets when timing matters.

   **Check:** output validates against the schema; spot-checked timestamps are within a few seconds.

5. **Design for realtime latency.** The voice turn budget is endpointing (voice activity detection) + final recognition + model time to first token + time to first audio. Stream partial transcripts, stream TTS sentence by sentence, support barge-in (stop playback when the user speaks), and use echo cancellation on the client. The Live API handles much of this in one session; check current model IDs and session limits. Browsers and mobile apps get short-lived ephemeral tokens or go through your backend, never a raw API key.

   **Check:** p95 from end of user speech to first audio byte is measured on a real network and meets the target you set.

6. **Synthesize speech.**

   ```python
   from google.cloud import texttospeech as tts

   client = tts.TextToSpeechClient()
   resp = client.synthesize_speech(
       input=tts.SynthesisInput(text="Your order has shipped."),
       voice=tts.VoiceSelectionParams(language_code="en-US", name=VOICE_NAME),  # client.list_voices(language_code="en-US")
       audio_config=tts.AudioConfig(audio_encoding=tts.AudioEncoding.MP3),
   )
   with open("out.mp3", "wb") as f:
       f.write(resp.audio_content)
   ```

   Normalize text before synthesis (numbers, dates, currencies, phone numbers, acronyms); SSML support differs by voice family. Cache audio for repeated phrases.

   **Check:** a listening test on a script full of numbers, names and acronyms passes.

7. **Evaluate.** Word error rate with `jiwer.wer(reference, hypothesis)` after identical normalization of both sides (case, punctuation, numerals); report it per slice (accent, noise, channel, device). Diarization error rate with `pyannote.metrics`. For TTS: a pronunciation checklist, a small listening panel and latency.

   **Check:** a report shows WER per slice, and the worst slice was reviewed by listening.

8. **Handle consent and privacy.** Recording-consent rules differ by jurisdiction; announce recording, redact personal data from transcripts before storage or LLM use (Sensitive Data Protection or equivalent), and set retention. Clone or imitate a voice only with the speaker's documented consent, and disclose synthetic voices to listeners. This is engineering guidance, not legal advice.

   **Check:** consent, redaction and retention decisions are documented and implemented.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Build subtitles from Gemini timestamps | Use word offsets from Speech-to-Text | Model timestamps are approximate |
| Send 44.1 kHz stereo MP3 | 16 kHz mono lossless | Better accuracy, smaller payloads |
| Wait for the full reply before speaking | Stream TTS per sentence | Seconds of dead air |
| Ship API keys in voice clients | Ephemeral tokens or a backend proxy | Keys are extracted from apps |
| Compute WER on raw text | Normalize both sides identically | Punctuation and casing distort WER |
| Clone voices from public clips | Written consent from the speaker | Legal and ethical exposure |

## Verification checklist

- [ ] The engine choice matches required features and data location.
- [ ] Audio is normalized; telephony audio uses telephony models.
- [ ] Diarization and timestamps were spot-checked by ear.
- [ ] Realtime latency is measured at p95 end to end.
- [ ] WER and DER are reported per slice with normalization.
- [ ] Consent, redaction, retention and synthetic-voice disclosure are in place.

## Related

- Knowledge: `multimodal-understanding`, `gemini-api`, `ffmpeg-multimedia`, `realtime-websockets`, `agent-design-patterns`, `responsible-ai`, `gdpr-privacy`, `ml-evaluation`.
- Agents: `gemini-ai-engineer`, `multimedia-producer`.
