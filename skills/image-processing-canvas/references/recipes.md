# Image processing recipes

Check the Sharp and Pillow changelogs for the installed versions: metadata
options in Sharp and AVIF support in Pillow have changed across releases.

## Social card with Satori + resvg

```tsx
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile } from 'node:fs/promises';

export async function renderCard(title: string, subtitle: string, out: string): Promise<void> {
  const [bold, regular] = await Promise.all([
    readFile('fonts/Inter-Bold.ttf'),        // TTF/OTF/WOFF; Satori does not read WOFF2
    readFile('fonts/Inter-Regular.ttf'),
  ]);
  const fontSize = title.length > 80 ? 44 : title.length > 50 ? 54 : 64;   // shrink long titles
  const svg = await satori(
    <div style={{ width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  padding: 72, background: '#0b1020', color: '#ffffff', fontFamily: 'Inter' }}>
      <div style={{ display: 'flex', fontSize, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
      <div style={{ display: 'flex', fontSize: 30, color: '#a5b4fc' }}>{subtitle}</div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: bold, weight: 700, style: 'normal' },
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
      ],
    },
  );
  await writeFile(out, new Resvg(svg).render().asPng());
}
```

Satori supports a flexbox-based CSS subset: every element with more than one
child needs `display: flex`. Add fonts for every script you render (CJK,
Arabic, emoji) or glyphs disappear.

## Next.js route (`next/og`)

```tsx
// app/og/[slug]/route.tsx
import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/lib/posts';

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const post = await getPostBySlug((await params).slug);
  if (!post) return new Response('Not found', { status: 404 });
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', padding: 72, background: '#0b1020', color: '#fff', fontSize: 60 }}>
      {post.title}
    </div>,
    { width: 1200, height: 630 },
  );
}
```

Look titles up server-side by slug. Accepting arbitrary `?title=` text lets
anyone generate images with your branding. The `params` shape differs between
Next.js versions; match the project's version.

## Canvas text wrapping and shrink-to-fit

```ts
interface Measurer { font: string; measureText(text: string): { width: number } }

export function wrapLines(ctx: Measurer, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export function fitText(ctx: Measurer, text: string, maxWidth: number, maxLines = 3, start = 72, min = 36): { size: number; lines: string[] } {
  for (let size = start; size >= min; size -= 4) {
    ctx.font = `700 ${size}px Inter`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }
  ctx.font = `700 ${min}px Inter`;
  const lines = wrapLines(ctx, text, maxWidth).slice(0, maxLines);
  lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '…');   // ellipsize the last line
  return { size: min, lines };
}
```

Works with browser canvas and node canvas packages (`@napi-rs/canvas`,
`canvas`); register the font file with the package's font API first.

## Responsive markup

```html
<picture>
  <source type="image/avif" srcset="/img/hero-640.avif 640w, /img/hero-1280.avif 1280w, /img/hero-1920.avif 1920w"
          sizes="(max-width: 768px) 100vw, 1200px">
  <source type="image/webp" srcset="/img/hero-640.webp 640w, /img/hero-1280.webp 1280w, /img/hero-1920.webp 1920w"
          sizes="(max-width: 768px) 100vw, 1200px">
  <img src="/img/hero-1280.jpg" width="1920" height="1080" alt="Describe what the image shows"
       decoding="async" fetchpriority="high">
</picture>
```

Above-the-fold hero: no `loading="lazy"`, add `fetchpriority="high"`. Below
the fold: `loading="lazy"`. Always set `width`/`height` (or CSS
`aspect-ratio`) to prevent layout shift.

## Python batch with failures reported

```python
import os
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from PIL import Image


def run_batch(srcs: list[Path], out_dir: Path) -> list[tuple[Path, str]]:
    """Process images in parallel; return (path, reason) for each failure."""
    out_dir.mkdir(parents=True, exist_ok=True)
    failures: list[tuple[Path, str]] = []
    with ProcessPoolExecutor(max_workers=os.cpu_count()) as pool:
        futures = {pool.submit(make_card_image, s, out_dir / f"{s.stem}.webp"): s for s in srcs}
        for fut in as_completed(futures):
            try:
                fut.result()
            except (OSError, ValueError, Image.DecompressionBombError) as exc:
                failures.append((futures[fut], f"{type(exc).__name__}: {exc}"))
    return failures

# On Windows, call run_batch only under: if __name__ == "__main__":
```

`PIL.UnidentifiedImageError` is an `OSError`, so corrupt files land in
`failures` instead of stopping the batch.

## Metadata and color decisions

| Need | Sharp | Pillow |
| :--- | :--- | :--- |
| Strip all metadata | Default output behaviour | Do not pass `exif=`/`icc_profile=`; verify per format |
| Keep only the ICC profile | ICC-keeping option (name varies by version: check docs) | `save(..., icc_profile=icc)` |
| Keep EXIF deliberately | Metadata-keeping option (check docs) | `save(..., exif=im.getexif())` |
| Convert to sRGB | Default for output | `ImageCms.profileToProfile` (see SKILL.md) |
| Honour orientation | `.rotate()` with no arguments | `ImageOps.exif_transpose(im)` |

Stripping metadata also removes provenance manifests (for example content
credentials on AI-generated images). Decide per asset type and record it.

## Quality checks

```ts
import sharp from 'sharp';
import { stat } from 'node:fs/promises';

export async function checkOutput(file: string, expectWidth: number, maxBytes: number): Promise<string[]> {
  const problems: string[] = [];
  const meta = await sharp(file).metadata();
  if (meta.width !== expectWidth) problems.push(`width ${meta.width} != ${expectWidth}`);
  if ((await stat(file)).size > maxBytes) problems.push(`size over ${maxBytes} bytes`);
  if (meta.exif || meta.xmp || meta.iptc) problems.push('metadata present');
  return problems;
}
```

```bash
exiftool -a -G1 -s out.jpg                                   # should list no GPS/EXIF groups
ffmpeg -hide_banner -i source.png -i out.avif -lavfi "[1:v][0:v]scale2ref[o][r];[o][r]ssim" -f null -   # SSIM when sizes differ
```

Contact sheet for a visual review (Pillow):

```python
from pathlib import Path
from PIL import Image, ImageOps


def contact_sheet(paths: list[Path], dst: Path, thumb: int = 256, cols: int = 6) -> None:
    """Tile thumbnails of paths into one JPEG for quick visual review."""
    rows = -(-len(paths) // cols)
    sheet = Image.new("RGB", (cols * thumb, rows * thumb), "white")
    for i, p in enumerate(paths):
        with Image.open(p) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            im.thumbnail((thumb, thumb))
            sheet.paste(im, ((i % cols) * thumb, (i // cols) * thumb))
    sheet.save(dst, quality=85)
```

Opening AVIF in Pillow requires a build with AVIF support (recent Pillow
releases, or a plugin on older ones).

## Untrusted uploads

- Enforce byte and pixel limits (Sharp `limitInputPixels`, Pillow
  `Image.MAX_IMAGE_PIXELS`) to stop decompression bombs.
- Re-encode every upload; never serve the original bytes.
- Do not rasterize user-supplied SVG in the main process; it can reference
  external resources. Sanitize or reject it.
- Run processing in a worker with a timeout so one bad file cannot stall the queue.
