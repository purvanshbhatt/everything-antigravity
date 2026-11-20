---
name: ai-image-generation
description: >-
  Writes prompts and runs image generation for app assets, marketing visuals
  and concept art with Gemini image models, Imagen (Gemini API or Vertex AI),
  open models and Antigravity's generate_image tool, covering prompt
  structure, set consistency, platform aspect ratios, editing and inpainting,
  icons and logos, and safety, licensing and SynthID provenance. Use when the
  user asks to generate, edit or restyle images.
---

# AI Image Generation

Turn a visual brief into usable, consistent and legally safe images with the
fewest paid generations. Good results come from a structured prompt, a reused
style block, small iterative batches, and post-processing to exact sizes;
not from piling adjectives into one long prompt.

## When to use

- Generating app icons, logos, illustrations, hero images, thumbnails, game concept art or placeholder sprites.
- Editing or restyling an existing image (background swap, object removal, variations).
- Producing a set of images that must look like one family.
- Choosing a model or API for image generation in an app or pipeline.

## When not to use

- Resizing, converting, compressing or compositing existing images: use `image-processing-canvas`.
- Social cards with exact text and layout: render them with `image-processing-canvas` (Satori/canvas); generated text is unreliable.
- Brand strategy, naming and positioning: use `brand-discovery`.
- Calling the Gemini API in general (auth, quotas, SDK setup): use `gemini-api`.

## Workflow

1. **Write the brief.** Purpose, where it will appear, exact output sizes, count, brand colors (hex), style references, any text that must appear (prefer adding text later in code), deadline and license constraints. Save it in an implementation plan artifact for the user to confirm when the set is large or paid.

   **Check:** Every image in the set has a target size and destination.

2. **Choose the tool and model.** Antigravity's built-in `generate_image` tool for quick in-workspace assets; the Gemini API (Gemini image models or Imagen) for scripted or app-integrated generation; Vertex AI for enterprise controls; open models (SDXL, FLUX, SD 3.x) for local or fine-tuned work. Model IDs change often: list them before coding (see [models and safety](references/models-and-safety.md)).

   **Check:** The model ID used was confirmed against the current models list or docs today.

3. **Write a structured prompt.** Use the template below (more templates in the [prompt library](references/prompt-library.md)). For a set, write the style block once and paste it verbatim into every prompt. Put exclusions in plain words ("no text, no watermark"); use a separate negative prompt only on models that support one.

4. **Generate small, then iterate.** Generate 2-4 candidates, pick one, change one variable at a time (lighting, angle, palette). Keep a log of prompt, model, seed (where supported) and the chosen output. Confirm cost with the user before batches beyond a handful of images.

   **Check:** The prompt log lets someone regenerate or extend the set.

5. **Keep a set consistent.** Reuse the style block, pass the approved image as a reference image (Gemini image models accept image inputs), keep aspect ratio and camera language fixed, and fix the seed on models that honour one. Generate a character or style sheet first, then derive individual assets from it.

6. **Edit instead of regenerating.** Send the image plus a narrow instruction ("replace only the background with a plain #0B1020 backdrop; keep the subject unchanged"). For masked inpainting use a model or API that supports masks (Vertex AI editing models or open-model inpainting pipelines; verify current support).

7. **Post-process to spec.** Crop or resize to exact pixel sizes, remove backgrounds, compress, and generate icon sizes with `image-processing-canvas`. Generate at the nearest supported aspect ratio, then crop.

   **Check:** Every delivered file has the exact required dimensions and format.

8. **Review safety, rights and provenance.** No real people without consent, no other companies' trademarks, no copyrighted characters, no "in the style of" a living artist. Record provenance in an asset manifest. Images from Google models carry an invisible SynthID watermark: never try to remove it, and disclose AI generation where the platform or law requires it.

   **Check:** The manifest lists model, prompt, date and license notes for each asset, and the user has seen the review.

## Patterns

### Prompt template

```text
Subject: <who/what, action, key details, materials>
Setting: <environment, time of day, props>
Composition: <framing, camera angle, subject placement, empty space for text>
Lighting: <quality, direction, color temperature>
Medium/lens: <35mm photo with shallow depth of field | flat vector illustration | isometric 3D render>
Style block: <palette as hex, mood, texture, era>   # identical across the set
Constraints: <no text, no watermark, no border, plain background>
```

Example: "Subject: a small brass robot watering a potted fern. Setting: sunny
windowsill, morning. Composition: medium shot, subject left third, empty space
on the right for a headline. Lighting: soft warm side light. Medium: 3D render,
soft materials. Style block: palette #0B1020, #4F46E5, #F5B700; calm, friendly.
Constraints: no text, no watermark."

### Platform sizes (verify current platform specs)

| Use | Ratio | Deliver at |
| :--- | :--- | :--- |
| App icon master | 1:1 | 1024 x 1024 PNG |
| PWA / favicons | 1:1 | 512, 192, 180 (Apple touch), 32, 16 |
| Open Graph link preview | 1.91:1 | 1200 x 630 |
| YouTube thumbnail | 16:9 | 1280 x 720 |
| Instagram portrait post | 4:5 | 1080 x 1350 |
| Stories, Reels, Shorts, TikTok | 9:16 | 1080 x 1920 |
| Website hero | 16:9 or wider | 1920 x 1080 and up, plus responsive sizes |

### Icons and logos with `generate_image`

Prompt for: one centered symbol, flat shapes, 2-3 brand colors (hex), bold
silhouette readable at 32 px, generous margin (the mark fills about 70-80 % of
the square), transparent background (or a plain solid color if transparency is
not produced), no text, no mockup scene, no drop shadow. Check the tool's
parameters in the current session rather than assuming size options.

Then: confirm the PNG has an alpha channel (`sharp(file).metadata()` →
`hasAlpha`, or Pillow `img.mode == "RGBA"`); if not, remove the flat
background in post; view it at 16 and 32 px; export the icon sizes. For a real
brand mark, vectorize (a tracing tool such as potrace or vtracer, then manual
cleanup) and have a designer refine it: generated logos may be hard to protect
as trademarks. This is not legal advice.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Hardcode a model ID from memory | List models or check docs first | Image model IDs and previews change frequently |
| "8k, ultra-detailed, masterpiece" filler | Concrete subject, composition, lighting and medium | Filler adds noise, not control |
| Rely on generated text for headlines | Generate a text-free image, add text in code | Spelling and kerning fail unpredictably |
| Regenerate from scratch for a small fix | Edit with a narrow instruction or mask | Keeps what already works; cheaper |
| Different wording for each image in a set | One verbatim style block plus reference images | Inconsistent sets look unprofessional |
| Prompt for real people, logos or famous characters | Original subjects and generic objects | Legal, policy and reputational risk |
| Strip provenance or try to remove watermarks | Keep SynthID; record provenance | Required for transparency; removal attempts can breach terms |
| Commit API keys in scripts | Read keys from environment variables | Secrets leak through git history |

## Verification checklist

- [ ] Brief lists destination, exact size and count for every image.
- [ ] Model ID verified against the current models list or docs.
- [ ] Prompt log (prompt, model, seed, date) saved alongside the assets.
- [ ] Set consistency checked side by side (palette, lighting, camera).
- [ ] Final files have exact dimensions, correct format and alpha where required.
- [ ] Safety and rights review done; no real people, trademarks or copyrighted characters.
- [ ] Provenance recorded; AI disclosure applied where required.

## Related

- Workflows: `/marketing-launch`, `/video-render`, `/game-build`.
- Knowledge: `image-processing-canvas`, `gemini-api`, `prompt-engineering`, `brand-discovery`, `video-production-pipeline`, `credential-sanitizer`.
- Agents: `multimedia-producer`, `gemini-ai-engineer`, `marketing-strategist`.
