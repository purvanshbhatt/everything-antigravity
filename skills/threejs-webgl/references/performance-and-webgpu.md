# Three.js performance, shaders and WebGPU

## Instancing

```ts
const COUNT = 5000;
const mesh = new THREE.InstancedMesh(geometry, material, COUNT);
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // only if matrices change every frame

const m = new THREE.Matrix4();
const p = new THREE.Vector3();
const q = new THREE.Quaternion();
const s = new THREE.Vector3(1, 1, 1);
for (let i = 0; i < COUNT; i++) {
  p.set(rand() * 100 - 50, 0, rand() * 100 - 50);
  mesh.setMatrixAt(i, m.compose(p, q, s));
}
mesh.instanceMatrix.needsUpdate = true;
mesh.computeBoundingSphere(); // otherwise culling uses stale bounds
scene.add(mesh);
```

- Reuse the scratch `Matrix4`/`Vector3` objects; never allocate inside the loop.
- Draw fewer instances by lowering `mesh.count` instead of rebuilding.
- Per-instance color: `mesh.setColorAt(i, color)` then `mesh.instanceColor!.needsUpdate = true`.
- `BatchedMesh` draws different geometries that share one material in one
  call; check the docs for your release, as its API has grown over time.

## LOD

```ts
const lod = new THREE.LOD();
lod.addLevel(highDetail, 0);
lod.addLevel(midDetail, 25);
lod.addLevel(lowDetail, 60);
scene.add(lod); // levels switch automatically during render
```

Generate the lower levels offline with gltf-transform `simplify`, and consider
impostors (camera-facing quads) for the farthest level.

## Render on demand (vanilla)

For viewers and configurators, render only when something changes:

```ts
let pending = false;
function requestRender(): void {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; controls.update(); renderer.render(scene, camera); });
}
controls.addEventListener('change', requestRender);
```

## Teardown checklist

- `renderer.setAnimationLoop(null)` and cancel any `requestAnimationFrame`.
- Dispose geometries, materials, textures (see SKILL.md utility), plus
  `renderTarget.dispose()`, PMREM outputs, `pmremGenerator.dispose()`,
  `controls.dispose()`, composer passes.
- `resizeObserver.disconnect()` and remove window/pointer listeners.
- When removing the canvas for good: `renderer.dispose()`; browsers limit live
  WebGL contexts, so leaked renderers eventually break new ones.
- Leak test: log `renderer.info.memory` before mount and after the tenth
  unmount; DevTools Memory heap snapshots should show no retained `Mesh` trees.

## Post-processing

Three's built-in composer:

```ts
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(width / 2, height / 2), 0.8, 0.4, 0.85));
composer.addPass(new OutputPass()); // tone mapping + color space conversion, once, at the end
renderer.setAnimationLoop(() => composer.render());
```

Call `composer.setSize(w, h)` on resize. The pmndrs `postprocessing` library
merges effects into fewer passes and is usually faster; follow its docs on
where tone mapping is applied so it happens exactly once.

## Custom shaders (WebGLRenderer)

Patch a built-in material:

```ts
const uniforms = { uTime: { value: 0 } };
material.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = uniforms.uTime;
  shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\ntransformed.y += sin(position.x * 4.0 + uTime) * 0.1;',
  );
};
// each frame: uniforms.uTime.value += dt;
```

Full `ShaderMaterial`:

```ts
const mat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#44aaff') } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      float band = 0.5 + 0.5 * sin(vUv.y * 20.0 - uTime * 2.0);
      gl_FragColor = vec4(uColor * band, 1.0);
      #include <colorspace_fragment>
    }`,
});
```

Without the `colorspace_fragment` include, a custom shader skips the output
color-space conversion and looks darker than built-in materials.

## WebGPU renderer and TSL (verify against current docs)

Status changes release by release. Before recommending it, check the three.js
release notes, the WebGPU examples, and browser support (MDN or caniuse for
WebGPU).

```ts
import * as THREE from 'three/webgpu';

const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();               // picks WebGPU, or falls back to a WebGL 2 backend
renderer.setAnimationLoop(render);
```

- Materials: built-in materials work; GLSL `ShaderMaterial`/`RawShaderMaterial`
  are WebGL-only. Write custom effects as node materials with TSL (Three
  Shading Language), which compiles to WGSL or GLSL depending on the backend.
- TSL sketch (export names have changed between releases; check the TSL docs):

  ```ts
  import { color, mix, sin, time, uv } from 'three/tsl';
  const mat = new THREE.MeshStandardNodeMaterial();
  mat.colorNode = mix(color('#113355'), color('#44aaff'), sin(uv().y.mul(20).sub(time.mul(2))).mul(0.5).add(0.5));
  ```

- Post-processing on WebGPU uses the node-based pipeline, not `EffectComposer`.
- Test both backends: the renderer accepts an option to force WebGL; confirm
  its current name in the docs and run the scene with it in CI or manually.

## Profiling tools

| Tool | Answers |
| :--- | :--- |
| `renderer.info` | Draw calls, triangles, live geometries/textures |
| `r3f-perf` (`<Perf />`) | Live FPS, GPU time, calls, memory inside R3F |
| `stats-gl` | FPS and GPU timing for vanilla three |
| Spector.js (browser extension) | Every WebGL call in one frame, state changes, shader source |
| DevTools Performance | CPU time per frame, GC pauses, long tasks |
| `chrome://gpu` | Whether hardware acceleration and WebGPU are active |

Starting heuristics (validate on real devices): keep draw calls in the low
hundreds on desktop and lower on mobile, keep shadow-casting lights to one,
and cap device pixel ratio at 2 (or 1.5 on weak mobile GPUs).
