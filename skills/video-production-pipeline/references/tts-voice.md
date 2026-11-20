# TTS and voice-over

Voice names, model IDs, SSML support per voice tier and pricing change often.
List voices and check the Cloud Text-to-Speech and Gemini API docs before
choosing; confirm costs with the user before batch synthesis.

## Engine choice

| Need | Google Cloud Text-to-Speech | Gemini TTS (Gemini API or Vertex AI) |
| :--- | :--- | :--- |
| Many languages and voices, predictable output | Strong | Good |
| Control | SSML (breaks, emphasis, phonemes) on voice tiers that support it; speaking rate and pitch | Natural-language direction ("calm, slightly amused, slow"); multi-speaker dialogue |
| Output | WAV (LINEAR16), MP3, Opus | Raw PCM to wrap as WAV (check the current output format) |
| Timing marks | SSML `<mark>` time points on supported API versions | None built in: get timings by transcribing the output |

Gemini TTS model IDs seen in the docs during 2025 included
`gemini-2.5-flash-preview-tts` and `gemini-2.5-pro-preview-tts`; Gemini-based
voices have also been offered through Cloud Text-to-Speech. Treat these as
examples and list the current models before use.

## List voices

```python
from google.cloud import texttospeech

client = texttospeech.TextToSpeechClient()   # uses Application Default Credentials
for v in client.list_voices(language_code="en-US").voices:
    print(v.name, v.ssml_gender.name, v.natural_sample_rate_hertz)
```

Voice names encode the tier (for example Standard, WaveNet, Neural2, Studio,
Chirp HD families); check which tiers support SSML and their prices.

## Cloud TTS: one WAV per line

```python
from pathlib import Path
from google.cloud import texttospeech


def synthesize_lines(lines: list[str], voice_name: str, out_dir: Path, language: str = "en-US") -> list[Path]:
    """Render each script line to its own 48 kHz WAV file."""
    client = texttospeech.TextToSpeechClient()
    out_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for i, text in enumerate(lines, start=1):
        resp = client.synthesize_speech(
            input=texttospeech.SynthesisInput(text=text),
            voice=texttospeech.VoiceSelectionParams(language_code=language, name=voice_name),
            audio_config=texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16,
                sample_rate_hertz=48000,
                speaking_rate=1.0,
            ),
        )
        path = out_dir / f"line-{i:02d}.wav"
        path.write_bytes(resp.audio_content)   # LINEAR16 responses include a WAV header
        paths.append(path)
    return paths
```

SSML example (for voices that support it):

```xml
<speak>Deploy in <emphasis level="moderate">one</emphasis> command.<break time="400ms"/>
Then open <sub alias="Anti gravity">Antigravity</sub>.</speak>
```

Use `SynthesisInput(ssml=...)` instead of `text=`.

## Gemini TTS

```python
import wave
from google import genai
from google.genai import types

client = genai.Client()   # API key from the environment, or vertexai=True with project/location

resp = client.models.generate_content(
    model="<gemini-tts-model-id>",                       # confirm with the models list
    contents="Read warmly, at a relaxed pace: Welcome to the demo.",
    config=types.GenerateContentConfig(
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="<voice-name>"),
            ),
        ),
    ),
)
pcm = resp.candidates[0].content.parts[0].inline_data.data

with wave.open("vo/line-01.wav", "wb") as wf:   # docs have described 24 kHz, 16-bit, mono PCM: verify
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(24000)
    wf.writeframes(pcm)
```

Resample to the project rate afterwards (`ffmpeg -i line-01.wav -ar 48000 line-01-48k.wav`).
Keep the style instruction identical across lines so the delivery stays consistent.

## Pronunciation fixes

| Problem | Fix |
| :--- | :--- |
| Brand or product name misread | Respell phonetically in the text, or SSML `<sub alias="...">` / `<phoneme>` where supported |
| Acronym read as a word | Spell with spaces or periods ("A P I") |
| Numbers, dates, versions | Write them as they should be spoken ("version two point one") |
| Run-on delivery | Split into shorter lines; add SSML breaks or punctuation |

## Timing and captions

1. Measure each line: `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 vo/line-01.wav`.
2. Place lines on the timeline with a small gap (150-300 ms) and feed the
   durations into the edit (Remotion `calculateMetadata`, or an ffmpeg concat list).
3. For word-level captions, transcribe the final mixed VO (Cloud Speech-to-Text
   with word time offsets, or a local whisper.cpp build) and proofread against
   the script.

## Ethics and disclosure

- Never synthesize or clone a real person's voice without written consent.
- Label synthetic voices where platforms, advertising rules or local law
  require it; keep a record of the engine, voice and date per deliverable.
- Keep credentials in Application Default Credentials or environment variables,
  never in scripts or the repo.
