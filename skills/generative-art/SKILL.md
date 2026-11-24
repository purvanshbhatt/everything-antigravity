---
name: generative-art
disable-model-invocation: true
description: >-
  Creates seeded, reproducible algorithmic art with p5.js or the HTML canvas:
  flow fields, particles, noise landscapes, circle packing, subdivision and
  tilings. Starts from a short aesthetic intent, routes all randomness through
  one seed, exposes parameters, explores seeds on a contact sheet, and exports
  print-size PNG, SVG for plotters, video frames and a viewer page. Use for
  generative or creative-coding art.
---

# Generative Art

Generative art is a system that makes images, and a seed that picks one of them. If the seed fully determines the output, every piece can be reproduced, shared, printed at a larger size and tuned without losing it. This skill covers the intent, the seeded structure, exploration and export for p5.js and the plain canvas API.

## When to use

- "Make a generative piece", "flow field", "creative coding", "algorithmic art", "p5.js sketch", "plotter art".
- A background, poster, cover or social image built from an algorithm rather than a photo or a model.
- An existing sketch gives a different picture on every reload and the user wants to keep one.
- Exporting a sketch at print resolution, as SVG for a pen plotter, or as video.

## When not to use

- Levels, maps and loot for games: `procedural-generation`.
- GPU fragment shaders and real-time effects: `shaders-glsl`; 3D scenes: `threejs-webgl`.
- Images from a text prompt with an image model: `ai-image-generation`.
- UI motion and transitions: `web-animation`. Charts: `data-visualization`.

## Workflow

1. **Write the aesthetic intent and the output spec.** Before any code, write three to five lines: the mood, the palette (three to six colours), the structure (what organizes the space), density and empty space, and whether it is still or moving. Add the output: pixel size or print size and DPI, format (PNG, SVG, video) and medium (screen, print, plotter). Describe visual qualities; do not ask for the signature style of a named living artist.

   **Check:** The intent is in a comment at the top of the sketch, and another person could tell whether a render matches it.

2. **Scaffold a seeded sketch.** Use one seeded generator for every random choice. Read the seed from the URL (`?seed=4817`), or pick one at random and show it. In p5.js call `randomSeed(seed)` and `noiseSeed(seed)` in `setup()` and use only `random()` and `noise()`. On a plain canvas, use a small seeded PRNG and pass it to the noise library (for example `createNoise2D(prng)` in `simplex-noise`). A starter for both is in [starter sketches](references/starter.md).

   **Check:** `grep_search` for `Math.random`, `Date.now` and `crypto.getRandomValues` in the sketch finds nothing outside the seed fallback, and reloading the same URL draws the same image.

3. **Build in layers and expose parameters.** Structure first (grid, field, packing, subdivision), then detail (strokes, particles, texture), then colour. Put every number you might tune in one `params` object; add a small panel such as lil-gui (`gui.add(params, 'count', 100, 5000, 1)`) or read values from the URL so variants can be shared as links.

   **Check:** Changing a parameter and the seed are independent: the same seed with the same params always matches, and the panel can reproduce any shared link.

4. **Explore seeds on a contact sheet.** Render a grid of 9 to 16 seeds at thumbnail size and pick favourites. For a review loop, serve the folder (`npx serve .` or `python -m http.server 8000`) and ask the browser subagent to open several `?seed=` URLs and capture screenshots for a walkthrough artifact.

   **Check:** The chosen seeds and their parameters are written down, not just remembered.

5. **Stay inside the frame budget.** At 60 fps a frame has about 16 ms. For still images, draw once (`noLoop()` in p5.js) or render progressively in chunks across animation frames so the page stays responsive. Batch strokes into one path, avoid allocating objects per particle per frame, and use pixel arrays (`loadPixels()`/`updatePixels()`) instead of per-pixel drawing calls. Move very heavy renders to an `OffscreenCanvas` in a worker or to Node.

   **Check:** Animated pieces hold their target frame rate in the performance panel; still pieces finish without a "page unresponsive" warning.

6. **Prove reproducibility.** Render the same seed twice headlessly (Playwright screenshot of the canvas, or `node-canvas` running the same drawing code) and compare hashes.

   ```bash
   sha256sum out/s4817_a.png out/s4817_b.png
   ```

   ```powershell
   Get-FileHash out\s4817_a.png, out\s4817_b.png -Algorithm SHA256
   ```

   Pixel-identical output is only expected on the same browser and machine: antialiasing and some `Math` functions can differ across engines and GPUs. The composition should still match everywhere.

   **Check:** Both hashes match on the same machine, and a render on a second browser shows the same composition.

7. **Export for the medium.** Write a sidecar JSON with the seed, params, library versions and date next to every export, and put the seed in the file name (`flowfield_s4817_7200x9600.png`).

   | Output | How |
   | :--- | :--- |
   | Print PNG | Render at full size: inches times DPI (24 x 32 in at 300 DPI is 7200 x 9600 px). Draw into an offscreen buffer scaled up, not by enlarging a screen capture |
   | SVG | Build path data directly, or p5.js with the p5.js-svg renderer. For plotters, optimize with vpype (`vpype read in.svg linemerge linesort write out.svg`) |
   | Video | Save numbered frames, then `ffmpeg -framerate 60 -i frame_%05d.png -c:v libx264 -pix_fmt yuv420p -crf 18 out.mp4` |
   | Viewer | One self-contained HTML file that reads `seed` and params from the URL and has a save button |

   **Check:** The export opens at the expected size, and the sidecar alone is enough to regenerate it.

8. **Credit and license.** Note the libraries used and their licenses, and credit any technique or code adapted from another sketch whose license allows it. Ask the user which license the piece and its code should carry.

   **Check:** The README or sidecar lists sources, licenses and the chosen license for the work.

## Patterns

### Techniques and their main parameters

| Technique | Core idea | Parameters worth exposing |
| :--- | :--- | :--- |
| Flow field | Noise sets an angle at each point; particles follow it and leave trails | Noise scale, particle count, step length, trail length, turbulence octaves |
| Circle packing | Place circles at random points; keep those that do not overlap | Min and max radius, attempts, padding, size distribution |
| Recursive subdivision | Split rectangles or triangles until a size or depth limit | Split probability, depth, ratio range, gap |
| Truchet and tilings | A small set of tiles, rotated by the seed, forms larger patterns | Tile set, grid size, rotation weights |
| Noise landscape | Stacked lines or a height map offset by layered noise | Octaves, falloff, amplitude, line spacing |
| Domain warping | Feed noise coordinates through another noise field | Warp strength, number of warps, scale |
| Voronoi and Delaunay | Cells from seeded points (`d3-delaunay`) | Point count, relaxation passes, cell styling |

### Colour

- Pick the palette first and keep it small; let value (light versus dark) carry the structure.
- Interpolate in a perceptual space such as OKLCH (CSS `oklch()` strings work in modern canvas implementations, or use culori or chroma-js) so blends do not turn muddy.
- Use the seeded generator to choose and weight palette entries, so colour is reproducible too.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Call `Math.random()` anywhere | One seeded generator for everything | Unseeded calls make the favourite piece impossible to recover |
| Drive the picture from the clock | Use the frame count and the seed | Wall-clock time changes the output on every run |
| Upscale a screenshot for print | Render at the target size from the seed | Upscaled captures are blurry and lose fine lines |
| Hard-code magic numbers through the code | Collect them in one `params` object | Tuning and sharing variants become guesswork |
| Imitate a living artist's signature style | Describe the qualities you want and build your own | Copies harm artists and carry legal and ethical risk |
| Allocate new objects per particle per frame | Reuse arrays and batch drawing | Garbage collection pauses cause visible stutter |

## Verification checklist

- [ ] The aesthetic intent and output spec are written at the top of the sketch.
- [ ] All randomness and noise come from one seed; no unseeded randomness or clock input remains.
- [ ] The same seed and params produce identical hashes on the same machine.
- [ ] Parameters live in one object and can be set from the URL or a panel.
- [ ] Animated work holds its frame rate; still work renders without freezing the page.
- [ ] Exports are at the target size and format, with seed in the file name and a sidecar JSON.
- [ ] Library licenses and any adapted sources are credited, and the work's license is chosen.

## Related

- Knowledge: `procedural-generation`, `shaders-glsl`, `svg-graphics`, `image-processing-canvas`, `threejs-webgl`, `web-animation`, `ffmpeg-multimedia`, `visual-identity`.
- Workflows: `/video-render`.
- Agents: `multimedia-producer`, `frontend-engineer`.
