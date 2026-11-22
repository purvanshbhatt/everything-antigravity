---
name: shaders-glsl
description: >-
  Writes and debugs GPU shaders in GLSL, HLSL and WGSL: pipeline stages and
  coordinate spaces, uniforms and varyings, linear-space lighting from Lambert
  and Blinn-Phong to PBR basics, full-screen post effects, porting between
  shading languages, frame-capture debugging with RenderDoc and similar tools,
  and GPU performance. Use when writing a custom shader, porting one between
  graphics APIs, or fixing visual artifacts or slow fragment work.
---

# Shaders (GLSL, HLSL, WGSL)

Shaders are small parallel programs with unforgiving inputs: wrong spaces,
wrong gamma or a misaligned uniform produce plausible-looking wrong images.
Start from a shader that compiles and outputs a constant, verify each input by
visualizing it, do lighting in linear space, and measure GPU time per pass
before optimizing.

## When to use

- Writing a vertex, fragment or full-screen post-processing shader.
- Porting a shader between GLSL, HLSL and WGSL, or between engines.
- Debugging black, washed-out, flickering, banded or NaN-speckled output.
- A pass is too slow on mobile or integrated GPUs.

## When not to use

- Three.js scene setup and materials without custom code: use `threejs-webgl`.
- Engine material graphs with no custom code: use `unity`, `unreal-engine` or `godot-engine`.
- CPU-side image processing: use `image-processing-canvas`. Compute-heavy numeric work: use `scientific-computing`.

## Workflow

1. **Identify the target language and wrapper.** WebGL2 uses GLSL ES 3.00; desktop OpenGL uses GLSL 3.30 or later; Vulkan takes SPIR-V (from GLSL or HLSL); Direct3D uses HLSL; WebGPU uses WGSL; Metal uses MSL. Engines wrap these: Unity URP HLSL and Shader Graph, Unreal material graphs with Custom nodes, the Godot shading language, Three.js `ShaderMaterial` or TSL.

   **Check:** The plan names the language, version, engine wrapper and lowest-end target GPU.

2. **Compile a minimal shader first.** Output a constant colour, then validate offline:

   ```bash
   glslangValidator shader.frag              # stage inferred from the extension
   dxc -T ps_6_0 -E main shader.hlsl         # HLSL pixel shader
   naga shader.wgsl                          # WGSL (naga-cli)
   ```

   **Check:** The validator reports no errors, and the screen shows the constant colour.

3. **Verify every input visually.** Output UVs as colour (`vec4(uv, 0.0, 1.0)`), normals as `n * 0.5 + 0.5`, and depth scaled into range. Check uniform buffer layout: std140 aligns `vec3` to 16 bytes, so pad or use `vec4`.

   **Check:** UVs show a red-green gradient in the expected orientation, and normals look smooth and correct.

4. **Light in linear space.** Decode sRGB textures to linear (sRGB texture formats do it in hardware), compute lighting, tonemap HDR values, and encode to sRGB exactly once at the end (or let an sRGB render target do it). Transform normals with the normal matrix (inverse transpose of model-view) and renormalize after interpolation.

   **Check:** Midtones are neither washed out (double encoding) nor crushed (no encoding), compared against a reference image.

5. **Build lighting up in steps.** Lambert diffuse `max(dot(N, L), 0)`, then Blinn-Phong specular `pow(max(dot(N, H), 0), shininess)`, then a metallic-roughness PBR model (GGX) only if the art style needs it.

   **Check:** A sphere under one light shows the expected falloff and highlight placement.

6. **Write post effects as passes.** Render the scene to a texture, draw a full-screen triangle per pass, run blur and bloom at half or quarter resolution, and use separable blurs (horizontal pass, then vertical).

   **Check:** Each pass can be toggled independently, and its output inspected in a frame capture.

7. **Debug with captures.** RenderDoc (Vulkan, D3D11, D3D12, OpenGL), PIX (D3D12), the Xcode Metal debugger, Spector.js (WebGL) and the browser console's WebGPU validation messages. Guard against NaN and Inf: clamp `pow` bases to non-negative values, avoid division by zero, normalize only non-zero vectors.

   **Check:** The capture shows correct inputs and outputs for the suspect draw, and `isnan` debugging shows no NaN pixels.

8. **Profile, then optimize.** Measure GPU time per pass (timestamp queries or the engine profiler) on the lowest-end target. Reduce overdraw, texture fetches and full-screen pass count; move per-vertex or constant math to the vertex shader or CPU; use `mediump` where precision allows on mobile; avoid `discard` on large opaque surfaces because it defeats early depth testing; always use mipmaps for minified textures.

   **Check:** Every pass is within its budget on the minimum-spec GPU, with before-and-after numbers recorded.

## Patterns

### Tonemap, vignette and sRGB encode (GLSL ES 3.00)

```glsl
#version 300 es
precision highp float;

uniform sampler2D uScene;   // linear HDR colour
uniform float uExposure;
uniform float uVignette;    // 0 = off, about 0.4 is subtle
in vec2 vUv;
out vec4 fragColor;

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 color = texture(uScene, vUv).rgb * uExposure;
  color *= 1.0 - uVignette * smoothstep(0.3, 0.75, distance(vUv, vec2(0.5)));
  color = color / (1.0 + color);                       // Reinhard tonemap
  fragColor = vec4(linearToSrgb(color), 1.0);
}
```

### The same pass in WGSL

```wgsl
struct Params { exposure: f32, vignette: f32, _pad: vec2f };   // pad to 16 bytes
@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> params: Params;

fn linear_to_srgb(c: vec3f) -> vec3f {
  return select(1.055 * pow(c, vec3f(1.0 / 2.4)) - 0.055, c * 12.92, c <= vec3f(0.0031308));
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var color = textureSample(scene, samp, uv).rgb * params.exposure;
  color *= 1.0 - params.vignette * smoothstep(0.3, 0.75, distance(uv, vec2f(0.5)));
  return vec4f(linear_to_srgb(color / (1.0 + color)), 1.0);
}
```

### Porting cheat sheet

| GLSL | HLSL | WGSL | Note |
| :--- | :--- | :--- | :--- |
| `vec4` | `float4` | `vec4f` | |
| `mix` | `lerp` | `mix` | |
| `fract` | `frac` | `fract` | |
| `clamp(x, 0.0, 1.0)` | `saturate(x)` | `saturate(x)` | |
| `mod(x, y)` | `fmod(x, y)` | `x % y` | GLSL floors; HLSL and WGSL truncate, so negatives differ |
| `texture(s, uv)` | `tex.Sample(samp, uv)` | `textureSample(t, s, uv)` | WGSL samples only in uniform control flow |
| `M * v` | `mul(M, v)` | `M * v` | Check row- versus column-major packing |
| `gl_FragCoord` | `SV_Position` | `@builtin(position)` | |

Clip-space depth is -1 to 1 in OpenGL but 0 to 1 in Direct3D, Vulkan, Metal and WebGPU, and the texture or framebuffer origin differs (bottom-left in OpenGL, top-left elsewhere). Port projection matrices and UV flips deliberately.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Light in sRGB space | Decode, light in linear, encode once | Wrong falloff and washed-out or muddy colours |
| Write the full effect before testing inputs | Visualize UVs, normals and depth first | Most bugs are wrong inputs, not wrong math |
| `pow` and `normalize` on unchecked values | Clamp and guard against zero | NaNs spread through blur and bloom passes |
| Full-resolution blur chains | Downsample, separable kernels | Bandwidth dominates post-processing cost |
| `discard` on large opaque meshes | Alpha-tested only where needed, or alpha-to-coverage | Disables early depth rejection |
| Optimize by guesswork | GPU timestamps per pass on target hardware | Fragment cost depends on the GPU and resolution |

## Verification checklist

- [ ] The shader validates offline for its target language and version.
- [ ] Inputs (UVs, normals, depth, uniforms) were visualized and are correct.
- [ ] Lighting is in linear space with a single sRGB encode at the end.
- [ ] No NaN or Inf pixels in a frame capture.
- [ ] Ported shaders account for depth range, origin and matrix layout differences.
- [ ] GPU time per pass meets the budget on the minimum-spec target.

## Related

- Workflows: `/game-build`, `/perf-audit`.
- Knowledge: `threejs-webgl`, `unity`, `unreal-engine`, `godot-engine`, `webassembly`, `image-processing-canvas`.
- Agents: `game-engine-specialist`, `performance-optimizer`.
