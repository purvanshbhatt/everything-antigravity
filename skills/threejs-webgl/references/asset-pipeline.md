# glTF asset pipeline for Three.js

Confirm every CLI option with `npx @gltf-transform/cli <command> --help`; the
CLI evolves between major versions.

## Inspect first

```bash
npx @gltf-transform/cli inspect model.glb
```

Read the scenes, meshes (vertex counts, attributes), textures (format,
resolution, size in bytes) and animations sections. Typical findings: 4096 px
PNGs, duplicate materials, unused UV sets, uncompressed geometry.

## Optimize

```bash
# one-shot pipeline: dedup, prune, weld, compress geometry and textures
npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress ktx2

# step by step when you need control
npx @gltf-transform/cli resize in.glb step1.glb --width 2048 --height 2048
npx @gltf-transform/cli simplify step1.glb step2.glb --ratio 0.5 --error 0.001
npx @gltf-transform/cli etc1s step2.glb step3.glb          # small, lower quality: base color
npx @gltf-transform/cli uastc step3.glb step4.glb          # larger, higher quality: normal maps
npx @gltf-transform/cli meshopt step4.glb out.glb
```

KTX2 (`etc1s`, `uastc`, `--texture-compress ktx2`) shells out to KTX-Software;
install it and make sure its binary is on `PATH` first. WebP/AVIF texture
compression needs no external binary but does not reduce GPU memory.

## Choosing compression

| Concern | Draco | Meshopt |
| :--- | :--- | :--- |
| Geometry size | Usually smallest for static meshes | Slightly larger alone; small after gzip/brotli |
| Decode speed | Slower, WASM decoder | Very fast |
| Animation / morph targets | Not compressed | Compressed too |
| Use when | Large static scans and CAD meshes | Default for games and animated models |

| Texture format | Download size | GPU memory | Use for |
| :--- | :--- | :--- | :--- |
| PNG/JPEG | Medium | Full RGBA8 after decode | Prototypes only |
| WebP/AVIF | Small | Full RGBA8 after decode | Small scenes where VRAM is not the limit |
| KTX2 ETC1S | Small | Compressed on GPU (transcoded) | Base color, emissive, AO |
| KTX2 UASTC | Larger | Compressed on GPU, higher quality | Normal maps, hero assets |

GPU cost of an uncompressed 2048 x 2048 RGBA8 texture with mipmaps is about
2048 * 2048 * 4 * 1.33, roughly 22 MB. Compressed GPU formats cut that by
4-8x.

## Loader setup (vanilla)

```ts
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const draco = new DRACOLoader().setDecoderPath('/decoders/draco/');
const ktx2 = new KTX2Loader().setTranscoderPath('/decoders/basis/').detectSupport(renderer);
const loader = new GLTFLoader()
  .setDRACOLoader(draco)
  .setKTX2Loader(ktx2)
  .setMeshoptDecoder(MeshoptDecoder);

const gltf = await loader.loadAsync('/models/out.glb');
scene.add(gltf.scene);
```

Self-host decoders: copy `node_modules/three/examples/jsm/libs/draco/` and
`.../libs/basis/` into `public/decoders/` at build time so the version matches
the installed `three` and nothing depends on a third-party CDN. Create one
loader set per app and reuse it; each `KTX2Loader` spins up workers.

## React Three Fiber

- `useGLTF(url)` from drei caches by URL and can enable Draco and Meshopt
  decoding; check the drei docs for the current signature and how to point it
  at self-hosted decoders.
- `npx gltfjsx model.glb --transform` generates a typed JSX component and a
  compressed copy of the model (check `npx gltfjsx --help` for flags such as
  TypeScript output).
- Preload hero assets with `useGLTF.preload(url)` so the first interaction does
  not stall.

## Budgets to agree up front

| Item | Starting point (adjust per project) |
| :--- | :--- |
| Initial 3D payload | A few MB for marketing pages; more only behind an explicit load action |
| Largest texture | 2048 px; 4096 px only for hero close-ups |
| Triangles in view | Hundreds of thousands on desktop; far fewer on low-end mobile |
| Materials per model | As few as possible; merge where textures can share an atlas |

Record the before/after `inspect` output in the walkthrough artifact.
