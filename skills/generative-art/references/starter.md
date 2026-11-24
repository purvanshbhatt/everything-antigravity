# Generative art: starter sketches

Two starting points that follow the rules in the skill: one seed drives everything, parameters live in one object, sizes scale from a reference width so a thumbnail and a print show the same composition, and exports carry the seed.

## Plain canvas (no build step)

Save as `index.html`, serve the folder (`npx serve .` or `python -m http.server 8000`) and open `index.html?seed=4817`. Press `s` to save a PNG and its sidecar JSON. Add `&w=7200&h=9600` for a 24 x 32 in print at 300 DPI.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Flow field</title>
  <style>
    html, body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #1a1a1a; }
    canvas { max-width: 100vw; max-height: 100vh; width: auto; height: auto; }
  </style>
</head>
<body>
<canvas id="art"></canvas>
<script type="module">
// Intent: calm currents of thin ink lines drifting left to right on warm paper.
// Three inks, generous margin, still image. Output: PNG, any size with a 4:5 ratio.
import { createNoise2D } from 'https://cdn.jsdelivr.net/npm/simplex-noise@4.0.1/+esm'; // pin it, or vendor the file

const query = new URLSearchParams(location.search);
const seed = query.get('seed') ?? String(Math.floor(Math.random() * 1e6)); // the only unseeded call: it picks a seed to show
if (!query.has('seed')) { query.set('seed', seed); history.replaceState(null, '', `?${query}`); }

const params = {
  width: Number(query.get('w') ?? 2400),
  height: Number(query.get('h') ?? 3000),
  particles: Number(query.get('n') ?? 2500),
  steps: 220,
  stepLength: 3,          // px at the 2400 px reference width
  noiseScale: 0.0016,     // per px at the reference width
  lineWidth: 1.2,
  margin: 0.08,
  palette: ['#1d3557', '#457b9d', '#e63946'],
  paper: '#f4efe6',
};
const k = params.width / 2400; // scale factor: same composition at any size

function hashSeed(text) {      // FNV-1a, 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry32(a) {       // small, fast, seedable PRNG returning [0, 1)
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(hashSeed(seed));
const noise2D = createNoise2D(rand);

const canvas = document.getElementById('art');
canvas.width = params.width;
canvas.height = params.height;
const ctx = canvas.getContext('2d');
ctx.fillStyle = params.paper;
ctx.fillRect(0, 0, params.width, params.height);
ctx.lineWidth = params.lineWidth * k;
ctx.lineCap = 'round';
ctx.globalAlpha = 0.55;

const mx = params.width * params.margin;
const my = params.height * params.margin;
const inside = (x, y) => x > mx && x < params.width - mx && y > my && y < params.height - my;

let drawn = 0;
function drawBatch() {                       // progressive rendering keeps the page responsive
  const end = Math.min(drawn + 100, params.particles);
  for (; drawn < end; drawn++) {
    let x = mx + rand() * (params.width - 2 * mx);
    let y = my + rand() * (params.height - 2 * my);
    ctx.strokeStyle = params.palette[Math.floor(rand() * params.palette.length)];
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < params.steps && inside(x, y); s++) {
      const angle = noise2D((x / k) * params.noiseScale, (y / k) * params.noiseScale) * Math.PI * 0.5; // rightward drift
      x += Math.cos(angle) * params.stepLength * k;
      y += Math.sin(angle) * params.stepLength * k;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  if (drawn < params.particles) requestAnimationFrame(drawBatch);
  else document.title = `Flow field, seed ${seed}`;   // signals "done" to headless renders
}
drawBatch();

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
addEventListener('keydown', (e) => {
  if (e.key !== 's') return;
  const base = `flowfield_s${seed}_${params.width}x${params.height}`;
  canvas.toBlob((png) => download(png, `${base}.png`), 'image/png');
  const sidecar = { seed, params, libraries: { 'simplex-noise': '4.0.1' }, saved: new Date().toISOString() };
  download(new Blob([JSON.stringify(sidecar, null, 2)], { type: 'application/json' }), `${base}.json`);
});
</script>
</body>
</html>
```

## p5.js version

The same piece in p5.js global mode. `random()`, `random(array)` and `noise()` all follow the seeds set in `setup()`. p5.js 1.x and 2.x differ in how assets load, so check the version you include.

```js
const params = { w: 2400, h: 3000, particles: 2500, steps: 220, stepLength: 3, noiseScale: 0.0016, palette: ['#1d3557', '#457b9d', '#e63946'] };
let seed;

function setup() {
  const q = new URLSearchParams(location.search);
  seed = Number(q.get('seed') ?? Math.floor(Math.random() * 1e6));
  randomSeed(seed);
  noiseSeed(seed);
  pixelDensity(1);                       // the canvas size is the export size
  createCanvas(params.w, params.h);
  noLoop();                              // a still image: draw once
}

function draw() {
  background('#f4efe6');
  noFill();
  strokeWeight(1.2);
  for (let i = 0; i < params.particles; i++) {
    let x = random(width);
    let y = random(height);
    stroke(random(params.palette));
    beginShape();
    for (let s = 0; s < params.steps; s++) {
      vertex(x, y);
      const a = (noise(x * params.noiseScale, y * params.noiseScale) - 0.5) * PI;
      x += cos(a) * params.stepLength;
      y += sin(a) * params.stepLength;
    }
    endShape();
  }
}

function keyPressed() {
  if (key === 's') saveCanvas(`flowfield_s${seed}_${width}x${height}`, 'png');
}
```

For a larger export than the screen canvas, draw into `createGraphics(w * scale, h * scale)` with `pg.scale(scale)` and save that buffer with `saveCanvas(pg, name, 'png')`.

## Contact sheet

`sheet.html` next to `index.html` shows twelve seeds as thumbnails. Because the sketch scales from a reference width, each thumbnail is the same composition as its full-size render.

```html
<!doctype html>
<meta charset="utf-8">
<title>Seed sheet</title>
<style>
  body { margin: 8px; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; background: #1a1a1a; color: #ddd; font: 12px system-ui; }
  iframe { width: 100%; aspect-ratio: 4 / 5; border: 0; }
</style>
<script>
  for (let s = 1; s <= 12; s++) {
    const fig = document.createElement('figure');
    fig.innerHTML = `<iframe src="index.html?seed=${s}&w=480&h=600" title="seed ${s}"></iframe><figcaption>seed ${s}</figcaption>`;
    document.body.append(fig);
  }
</script>
```

## Headless render for the reproducibility check

Requires Playwright (`npm i -D playwright` and `npx playwright install chromium`) and the folder served on port 8000.

```js
// render.mjs: node render.mjs 4817 out/s4817_a.png
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const [seed, out] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:8000/index.html?seed=${seed}`);
await page.waitForFunction(() => document.title.startsWith('Flow field, seed'), null, { timeout: 120_000 });
const dataUrl = await page.$eval('#art', (c) => c.toDataURL('image/png'));  // full resolution, not the CSS-scaled view
await writeFile(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
```

Run it twice with the same seed and compare the two files' SHA-256 hashes.
