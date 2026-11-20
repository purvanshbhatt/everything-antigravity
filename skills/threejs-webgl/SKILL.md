---
name: threejs-webgl
description: >-
  Builds and optimizes 3D web scenes with Three.js and React Three Fiber:
  renderer setup, color management and tone mapping, PBR materials and
  lighting, glTF optimization with gltf-transform (Draco, Meshopt, KTX2),
  instancing, culling and LOD, GPU memory disposal, post-processing, GLSL or
  TSL shaders and the WebGPU renderer. Use for WebGL or R3F work, slow or
  leaking 3D pages, washed-out colors, or heavy glTF models.
---

# Three.js and WebGL

Get correct color, predictable performance and zero GPU leaks in browser 3D.
Most broken Three.js scenes share three causes: wrong color spaces,
unoptimized glTF assets, and objects that are removed but never disposed.

## When to use

- Setting up or reviewing a Three.js or React Three Fiber (R3F) scene, viewer or web game.
- Colors look washed out or too dark, or lighting looks flat.
- A model loads slowly, the page drops frames, or GPU memory grows across route changes.
- Adding post-processing, custom shaders, instancing, LOD or the WebGPU renderer.

## When not to use

- Engine-agnostic game loop, state or save design: use `game-architecture`.
- Native or desktop 3D games: use `godot-engine`.
- General React or Next.js app work with no 3D: use `frontend-react-nextjs`.
- Page-level Core Web Vitals (LCP, CLS) rather than frame rate: use `web-performance`.

## Workflow

1. **Inventory.** `npm ls three @react-three/fiber @react-three/drei` (or the pnpm/yarn/bun equivalent). More than one `three` version means duplicate bundles and broken `instanceof` checks; dedupe it. Note the bundler and whether the target includes mobile.

   **Check:** You know the exact three.js release (`rNNN`), which matters for every API below.

2. **Renderer baseline.** Pixel ratio capped at 2, `outputColorSpace = SRGBColorSpace` (default since r152), an explicit tone mapping, resize through `ResizeObserver`, and `setAnimationLoop` (required for WebXR and WebGPU). Color textures (`map`, `emissiveMap`) use `SRGBColorSpace`; data textures (normal, roughness, metalness, AO) stay linear. GLTFLoader sets these correctly; manual `TextureLoader` code must set them.

   **Check:** A reference sRGB swatch texture on an unlit material matches its source pixel values.

3. **Lighting and materials.** `MeshStandardMaterial` or `MeshPhysicalMaterial` lit by an environment map (`scene.environment` from an HDR via `PMREMGenerator`, or `RoomEnvironment`). One shadow-casting directional light with a tight shadow camera; bake static shadows into textures when possible.

   **Check:** Turning the environment off visibly changes the materials (proof it is applied).

4. **Optimize assets before loading them.** Inspect and compress with gltf-transform, then configure the matching decoders (see [asset pipeline](references/asset-pipeline.md)):

   ```bash
   npx @gltf-transform/cli inspect model.glb
   npx @gltf-transform/cli optimize model.glb model.opt.glb --compress meshopt --texture-compress ktx2
   ```

   KTX2 encoding needs KTX-Software (`toktx`/`ktx`) on `PATH`; confirm options with `npx @gltf-transform/cli optimize --help`.

   **Check:** The optimized file meets the size budget, textures are no larger than needed (usually at most 2048 px), and the model still renders correctly.

5. **Cut draw calls.** Read `renderer.info.render.calls` and `.triangles`. Use `InstancedMesh` for many copies of one mesh, `BatchedMesh` for varied geometry sharing one material, merged static geometry, and texture atlases.

   **Check:** Draw calls in the busiest view are recorded and within the plan's budget (as a starting heuristic: low hundreds on desktop, fewer on mobile).

6. **Cull and LOD.** Frustum culling is on by default per object. After moving instances of an `InstancedMesh`, call `computeBoundingSphere()` or instances disappear at screen edges. Use `THREE.LOD` (or drei `<Detailed>`) with simplified meshes from gltf-transform `simplify`.

7. **Dispose everything you create.** Geometries, materials, textures, render targets, PMREM output and controls are not garbage collected on the GPU. Use the utility below on teardown, and stop the loop with `renderer.setAnimationLoop(null)`.

   **Check:** Mount and unmount the scene 10 times; `renderer.info.memory.geometries` and `.textures` return to their baseline.

8. **Post-processing last.** Use the pmndrs `postprocessing` library (or `@react-three/postprocessing`), or three's `EffectComposer` ending in `OutputPass` so tone mapping and color conversion happen once. Run bloom and blur at reduced resolution.

9. **Shaders.** Small tweaks to built-in materials via `onBeforeCompile`; full custom effects via `ShaderMaterial`. For code that must run on both WebGL and WebGPU, write TSL node materials. Details and the WebGPU status note: [performance and WebGPU](references/performance-and-webgpu.md).

10. **Profile.** `r3f-perf` (`<Perf />`) or `stats-gl` for live numbers, Spector.js to capture a WebGL frame, DevTools Performance for CPU and GC. Delegate deep frame analysis to the `performance-optimizer` subagent with a capture and the budget.

    **Check:** p95 frame time on the target device is under budget (16.67 ms at 60 fps), recorded in the walkthrough artifact.

## Patterns

### Renderer baseline (vanilla)

```ts
import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // or AgXToneMapping / NeutralToneMapping on recent releases
renderer.toneMappingExposure = 1.0;

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200); // keep near/far tight to avoid z-fighting
new ResizeObserver(([entry]) => {
  const { width, height } = entry.contentRect;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}).observe(canvas);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  update(dt);
  renderer.render(scene, camera);
});
```

### Disposal utility

```ts
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      for (const value of Object.values(m)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      m.dispose();
    }
  });
  root.removeFromParent();
}
```

Only dispose resources this object owns. Shared geometries, materials and
cached textures need a reference count or a single owner (an asset cache).

### R3F essentials

```tsx
<Canvas dpr={[1, 2]} camera={{ position: [0, 2, 6], fov: 50 }} frameloop="demand">
  <Scene />
</Canvas>

function Spinner() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => { ref.current.rotation.y += delta * 0.8; }); // mutate refs, never setState per frame
  return <mesh ref={ref}><boxGeometry /><meshStandardMaterial color="orange" /></mesh>;
}
```

`frameloop="demand"` renders only after `invalidate()` or prop changes, ideal
for configurators. R3F disposes objects it created on unmount; resources from
loader caches (`useGLTF`, `useTexture`) persist until cleared (check the drei
docs for the current cache-clearing API).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Leave color textures in linear space or set data maps to sRGB | sRGB for color maps only; linear for normal/roughness/AO | Washed-out or crushed colors and wrong lighting |
| `setPixelRatio(devicePixelRatio)` uncapped | `Math.min(devicePixelRatio, 2)` | 3x displays render 2.25x the pixels for little visible gain |
| Ship raw exporter `.glb` files with 4K PNGs | gltf-transform: Meshopt/Draco + KTX2/WebP + resize | Slow downloads and VRAM blowups on mobile |
| One `Mesh` per tree, coin or bullet | `InstancedMesh` or `BatchedMesh` | Draw calls, not triangles, usually bound the CPU |
| `scene.remove(obj)` and move on | Dispose geometry, materials, textures, render targets | GPU memory leaks across navigations |
| `setState` inside `useFrame` | Mutate refs; derive React state outside the loop | Re-renders the React tree 60 times a second |
| Many shadow-casting lights | One shadow light, baked or contact shadows elsewhere | Each shadow light re-renders the scene |

## Verification checklist

- [ ] Single `three` version in the dependency tree.
- [ ] Output color space, tone mapping and texture color spaces are set deliberately.
- [ ] glTF assets pass through gltf-transform and decoders are self-hosted for production.
- [ ] Draw calls and triangles in the busiest view are recorded and within budget.
- [ ] Mount/unmount 10 times leaves `renderer.info.memory` at baseline.
- [ ] p95 frame time on the target device meets the budget; no console WebGL warnings.
- [ ] WebGPU-only features have a WebGL fallback or a documented browser requirement.

## Related

- Workflows: `/game-build`, `/verify`, `/e2e`.
- Knowledge: `game-architecture`, `web-performance`, `frontend-react-nextjs`, `procedural-generation`, `game-audio-sfx`, `accessibility-a11y`.
- Agents: `game-engine-specialist`, `performance-optimizer`, `typescript-reviewer`, `e2e-runner`.
