---
name: image-processing-canvas
disable-model-invocation: true
description: >-
  Builds image pipelines with Sharp (Node) and Pillow (Python): resizing and
  cropping, AVIF/WebP/JPEG conversion, responsive srcset sets, Open Graph and
  social cards via Satori, @vercel/og or canvas, ICC color profiles, EXIF
  stripping for privacy, bounded-concurrency batch jobs and output quality
  checks. Use when processing, optimizing or generating images, thumbnails or
  social cards in code.
---

# Image Processing and Canvas

Turn arbitrary input images into exactly specified, small, correctly colored
and privacy-safe outputs, and generate text-bearing graphics (social cards,
thumbnails) deterministically from templates. Every pipeline here is
orient → color-convert → resize → encode → strip → verify.

## When to use

- Converting or compressing images (AVIF, WebP, JPEG, PNG) or producing responsive `srcset` sets.
- Generating Open Graph, social, thumbnail or certificate images from templates and data.
- Batch processing folders of uploads or assets.
- Removing EXIF/GPS metadata, fixing rotated photos or color shifts between devices.

## When not to use

- Creating new imagery from prompts: use `ai-image-generation`, then post-process here.
- Video frames, GIFs from video and audio work: use `ffmpeg-multimedia`.
- Page-level image loading strategy (lazy loading, LCP, CDN): use `web-performance`.
- Motion graphics: use `remotion-motion-graphics`.

## Workflow

1. **Inventory the inputs.** For a sample (or all) files, read format, dimensions, EXIF orientation, alpha, color space and embedded ICC profile (`sharp(f).metadata()` or Pillow `Image.open(f)` plus `img.info.get("icc_profile")`). Flag CMYK, wide-gamut (Display P3, Adobe RGB), 16-bit, animated and very large inputs.

   **Check:** You can state the formats, size range and whether any input is non-sRGB, rotated or animated.

2. **Write the output spec.** Formats, widths (for example 320, 640, 960, 1280, 1920), quality settings, a byte budget per image, metadata policy (strip everything, keep ICC only when not converting to sRGB, or keep provenance metadata deliberately) and naming scheme.

   **Check:** The spec is in the implementation plan, including the metadata decision.

3. **Build the pipeline** in that order: auto-orient from EXIF, convert to sRGB, resize without enlargement, encode, strip metadata, write to a temp name and rename. Sharp strips metadata and converts to sRGB by default; Pillow keeps only what you pass to `save()`, but verify. Code below and in [recipes](references/recipes.md).

4. **Batch with a concurrency limit.** Sharp already uses a libvips thread pool per image; run about as many images in parallel as CPU cores (not hundreds of promises). In Python use a `ProcessPoolExecutor`. Log and continue on corrupt files, then report them.

   **Check:** A 500-image run finishes with stable memory, and a list of failed files with reasons is produced.

5. **Generate social cards from templates.** Satori (JSX/HTML subset to SVG) plus `@resvg/resvg-js` (SVG to PNG), `next/og` `ImageResponse` inside Next.js, or node canvas for pixel-level drawing. Embed fonts explicitly; wrap and clamp text; 1200 x 630 for Open Graph.

   **Check:** Cards for the shortest and the longest real titles both render without overflow.

6. **Verify outputs.** Assert dimensions and byte budgets, confirm metadata is gone (`exiftool -a -G1 out.jpg` or re-open and check), and compare against the source with SSIM for a sample (`ffmpeg -i ref.png -i out.avif -lavfi ssim -f null -`). Make a contact sheet for a visual spot check.

   **Check:** Every output meets size and dimension specs, has no GPS/EXIF, and sampled SSIM stays above the agreed threshold (often 0.95+ for photos).

7. **Wire into HTML.** `<picture>` with AVIF, then WebP, then JPEG fallback, `srcset` + `sizes`, explicit `width`/`height` to prevent layout shift.

## Patterns

### Responsive set with Sharp (TypeScript)

```ts
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const WIDTHS = [320, 640, 960, 1280, 1920];

export async function buildSet(src: string, outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const base = path.parse(src).name;
  const oriented = sharp(src, { failOn: 'error' }).rotate();      // apply EXIF orientation
  const { width = 0, height = 0, orientation } = await oriented.metadata();
  const srcWidth = orientation && orientation >= 5 ? height : width; // metadata is pre-rotation
  const outputs: string[] = [];
  for (const w of WIDTHS.filter((w) => w <= srcWidth)) {
    const resized = oriented.clone().resize({ width: w, withoutEnlargement: true });
    const avif = path.join(outDir, `${base}-${w}.avif`);
    const webp = path.join(outDir, `${base}-${w}.webp`);
    await resized.clone().avif({ quality: 50 }).toFile(avif);       // metadata stripped by default
    await resized.clone().webp({ quality: 78 }).toFile(webp);
    outputs.push(avif, webp);
  }
  return outputs;
}
```

### Bounded concurrency without a dependency

```ts
import os from 'node:os';

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { status: 'fulfilled', value: await fn(items[i]) }; }
      catch (reason) { results[i] = { status: 'rejected', reason }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
// await mapLimit(files, os.availableParallelism?.() ?? os.cpus().length, (f) => buildSet(f, 'out'));
```

### Pillow thumbnail with orientation and sRGB

```python
import logging
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

log = logging.getLogger(__name__)


def make_card_image(src: Path, dst: Path, size: tuple[int, int] = (1200, 630)) -> None:
    """Center-crop to size, honour EXIF orientation, convert to sRGB and save WebP without metadata."""
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        icc = im.info.get("icc_profile")
        if im.mode not in ("RGB", "CMYK"):
            im = im.convert("RGB")
        try:
            if icc:  # RGB (e.g. Display P3) or CMYK profile -> sRGB
                src_profile = ImageCms.ImageCmsProfile(BytesIO(icc))
                im = ImageCms.profileToProfile(im, src_profile, ImageCms.createProfile("sRGB"), outputMode="RGB")
        except ImageCms.PyCMSError as exc:
            log.warning("Unusable ICC profile in %s: %s", src, exc)  # continue without color management
        im = im.convert("RGB")
        im = ImageOps.fit(im, size, Image.Resampling.LANCZOS, centering=(0.5, 0.5))
        im.save(dst, "WEBP", quality=80, method=6)   # no exif= or icc_profile= passed
```

Converting CMYK through its embedded profile (as above) avoids the color shift
of a naive `convert("RGB")`.

### Format guidance

| Format | Use | Starting quality |
| :--- | :--- | :--- |
| AVIF | Photos and illustrations, smallest files | Sharp `quality` 45-60; slower to encode |
| WebP | Broad fallback, transparency | 75-82 |
| JPEG (mozjpeg) | Universal fallback, email | 75-82 with `mozjpeg: true` in Sharp |
| PNG | Pixel art, screenshots with sharp text, lossless alpha | Use `palette: true` for flat graphics |
| SVG | Logos, icons, diagrams | Optimize with an SVG optimizer; never rasterize unless required |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Resize before applying EXIF orientation | `.rotate()` (Sharp) or `exif_transpose` (Pillow) first | Phone photos come out sideways |
| Drop ICC profiles from P3/Adobe RGB images | Convert to sRGB, then strip | Colors shift (dull or oversaturated) on most displays |
| Keep EXIF on user uploads | Strip by default; keep only what the product needs | GPS coordinates and device serials leak |
| Upscale small sources to fill the set | `withoutEnlargement`; skip larger widths | Bigger files, blurrier images |
| `Promise.all(files.map(process))` on thousands | Bounded concurrency | Memory spikes and crashes |
| Render card text with fixed font size and no wrap | Measure, wrap, clamp lines, shrink to fit | Long titles overflow or clip |
| Trust "quality 80" across formats | Compare SSIM and bytes per format | Quality scales are not comparable between encoders |

## Verification checklist

- [ ] Inputs inventoried; non-sRGB, CMYK, rotated and animated files handled explicitly.
- [ ] Output spec (formats, widths, quality, byte budget, metadata policy) written down.
- [ ] Outputs meet dimensions and byte budgets; nothing was upscaled.
- [ ] EXIF/GPS absent from outputs (verified with exiftool or by re-reading).
- [ ] Sampled SSIM or visual contact sheet reviewed.
- [ ] Social cards tested with shortest and longest real titles and non-Latin text if supported.
- [ ] Batch failures are reported, not silently skipped.

## Related

- Workflows: `/marketing-launch`, `/video-render`, `/verify`.
- Knowledge: `ai-image-generation`, `web-performance`, `frontend-react-nextjs`, `seo-audit`, `ffmpeg-multimedia`.
- Agents: `multimedia-producer`, `performance-optimizer`.
