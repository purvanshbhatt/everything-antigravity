# Image models, API calls, safety and provenance

Everything about model names, parameters and limits in this file moves fast.
Verify against the current Gemini API, Vertex AI and model-card docs before
writing code.

## Discover current models

```bash
curl -s -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models
```

```powershell
Invoke-RestMethod -Headers @{ 'x-goog-api-key' = $env:GEMINI_API_KEY } `
  -Uri 'https://generativelanguage.googleapis.com/v1beta/models' | Select-Object -ExpandProperty models | Select-Object name
```

```python
from google import genai
client = genai.Client()  # reads the API key from the environment
for m in client.models.list():
    print(m.name)
```

Send the key in a header, never in a URL query string (URLs end up in logs).

## Model families (verify names and availability)

| Family | Access | Strengths | Notes |
| :--- | :--- | :--- | :--- |
| Gemini image models (Flash and Pro image variants) | Gemini API, Vertex AI, Antigravity `generate_image` | Conversational editing, multiple reference images, character consistency, improving text rendering | Called through `generate_content`; returns image parts |
| Imagen | Gemini API, Vertex AI | High-fidelity text-to-image, several images per call, aspect-ratio control | Called through `generate_images`; Vertex adds editing and enterprise controls |
| Open models (SDXL, SD 3.x, FLUX variants) | Local GPU, hosted endpoints | Fine-tuning (LoRA), ControlNet, inpainting, seeds, negative prompts | Licenses differ per model and version; some forbid commercial use |

IDs that appeared in Google's docs as of late 2025 include
`gemini-2.5-flash-image`, `gemini-3-pro-image-preview` and
`imagen-4.0-generate-001`. Treat them as examples only: previews are renamed
or retired, so list the models before using any ID.

## Gemini API calls

Python (`google-genai`):

```python
from pathlib import Path
from google import genai
from google.genai import types

client = genai.Client()  # API key from env; Vertex: genai.Client(vertexai=True, project=..., location=...)

# Gemini image model: prompt (+ optional reference images) -> image parts
resp = client.models.generate_content(
    model="<gemini-image-model-id>",          # confirm with the models list
    contents=[PROMPT],
)
for i, part in enumerate(resp.candidates[0].content.parts):
    if part.inline_data is not None:
        ext = part.inline_data.mime_type.split("/")[-1]
        Path(f"out_{i}.{ext}").write_bytes(part.inline_data.data)

# Imagen: dedicated text-to-image call with count and aspect ratio
result = client.models.generate_images(
    model="<imagen-model-id>",                # confirm with the models list
    prompt=PROMPT,
    config=types.GenerateImagesConfig(number_of_images=4, aspect_ratio="16:9"),
)
for i, generated in enumerate(result.generated_images):
    generated.image.save(f"imagen_{i}.png")
```

Editing with a Gemini image model: put the source image and the instruction in
`contents` (for example a PIL image or an image `Part` plus a text string).
Aspect-ratio and image-size options for Gemini image models live in the
generation config; check the current docs for field names.

Node (`@google/genai`):

```ts
import { writeFileSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const res = await ai.models.generateContent({ model: '<gemini-image-model-id>', contents: PROMPT });
for (const [i, part] of (res.candidates?.[0]?.content?.parts ?? []).entries()) {
  if (part.inlineData?.data) {
    const ext = (part.inlineData.mimeType ?? 'image/png').split('/')[1];
    writeFileSync(`out_${i}.${ext}`, Buffer.from(part.inlineData.data, 'base64'));
  }
}
```

Handle blocked responses: a candidate may contain no image part when a safety
filter triggers. Log the finish reason and rephrase; do not retry the same
prompt in a loop.

## Seeds and reproducibility

- Open models: same model weights, scheduler, steps, resolution, seed and
  software versions reproduce an image closely (bit-exact only on identical
  hardware and libraries).
- Imagen on Vertex AI has offered a seed parameter with restrictions (for
  example tied to watermark settings); verify before relying on it.
- Gemini image models: treat outputs as non-deterministic; use reference
  images and the chosen output itself for continuity.

## Inpainting and masks

| Option | How |
| :--- | :--- |
| Gemini image models | Instruction-based edits ("remove the cup on the table"); no explicit mask |
| Vertex AI image editing | Mask-based insert/remove, background swap, outpainting; check current model IDs and modes |
| Open models | Inpainting pipelines with a mask image (white = regenerate); ControlNet for pose and edges |

## Safety and rights review

- People: no real, identifiable people without written consent; no public
  figures in endorsements or compromising scenes.
- Brands and IP: no other companies' logos or trademarks, no copyrighted
  characters, no requests to imitate a living artist's style.
- Sensitive content: follow the provider's usage policy; never try to bypass
  safety filters.
- Ownership: read the provider's terms for output rights; copyright
  protection for purely AI-generated images varies by jurisdiction, and
  generated logos may be hard to register. Recommend legal review for brand
  marks. This is not legal advice.
- Disclosure: label AI-generated or AI-edited imagery where ad platforms, app
  stores, publications or local law require it.

## Provenance

- Google image models embed SynthID, an invisible watermark designed to
  survive common edits such as resizing and compression. Do not attempt to
  remove or defeat it.
- Some services also attach content-credential metadata. Metadata stripping
  in `image-processing-canvas` removes it; when provenance matters more than
  file-size or privacy, keep it and document the choice.
- Keep an asset manifest:

```csv
file,model,prompt_id,seed,date,editor_notes,license_notes
assets/hero.png,<model-id>,hero-v3,,2026-01-15,cropped to 1920x1080,generated; no third-party IP
```
