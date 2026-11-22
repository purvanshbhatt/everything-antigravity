---
name: blender-3d
description: >-
  Runs a Blender asset pipeline from modelling to engine: units and scale,
  applied transforms, topology and normals, UVs and texel density,
  Principled BSDF materials that survive glTF export, baking, rig and
  animation export, GLB export, validation and optimization with
  glTF-Transform, headless batch export and rendering with Python, and asset
  licensing. Use when preparing 3D assets for three.js, Godot, Unity or
  Unreal, or automating Blender.
---

# Blender 3D

Most broken 3D assets are pipeline problems, not art problems: wrong scale,
unapplied transforms, flipped normals, materials the exporter cannot read, and
textures too large for the target. Fix the pipeline once, script it, and
validate every export.

## When to use

- Preparing models, materials and animations for a game engine or the web.
- Imported assets are huge, tiny, rotated, black, inside-out or missing textures.
- Batch-exporting or rendering many files without opening the UI.
- Choosing what to bake and how to keep file sizes small.

## When not to use

- Rendering and interaction in the browser: use `threejs-webgl`.
- Engine-side setup: `godot-engine`, `unity` or `unreal-engine`.
- Shader authoring in the engine: use `shaders-glsl`.
- Generating geometry procedurally at runtime: use `procedural-generation`.

## Workflow

1. **Set units and orientation.** Scene Properties: Metric, Unit Scale 1.0, so 1 Blender unit is 1 m. Model facing -Y (Blender's front view). Blender is Z-up; glTF is Y-up and the exporter converts by default (the +Y Up option).

   **Check:** A 1.8 m reference character imported into the target engine stands upright at the right size.

2. **Model to a budget.** Agree triangle and texture budgets per asset class with the engine owner before modelling. Use quads on deforming meshes, merge by distance to remove duplicate vertices, and recalculate normals outward (Shift+N). Turn on the Face Orientation overlay: blue faces point out, red faces are flipped.

   **Check:** No red faces in Face Orientation and the triangle count (Statistics overlay) is within budget.

3. **Apply transforms and set origins.** Apply rotation and scale (Ctrl+A) before rigging and export. Put origins where the engine expects pivots (feet for characters, hinge for doors) and place assets at the world origin for per-asset export.

   **Check:** Object Properties show rotation 0 and scale 1 on every exported object.

4. **Unwrap UVs.** Mark seams in hidden places, unwrap, keep texel density consistent across assets (same pixels per metre), avoid overlaps for anything baked, and leave padding between islands. Add a second UV map only if the engine needs lightmap UVs.

   **Check:** A checker texture shows evenly sized squares without stretching across the model.

5. **Build export-friendly materials.** The glTF exporter reads Principled BSDF with image textures: Base Color, Metallic, Roughness, Normal Map (via a Normal Map node), Emission, Alpha. Complex procedural node trees are not exported; bake them to textures (Cycles bake: diffuse colour, roughness, normal). Pack occlusion, roughness and metallic into one ORM texture where the target supports it.

   **Check:** The exported model looks the same in a glTF viewer as in Blender's Material Preview.

6. **Prepare rigs and animations.** Apply transforms before parenting to the armature, keep bone influences per vertex to what the engine supports (four is the common safe limit), name actions clearly, and push them to NLA tracks so each exports as a separate glTF animation.

   **Check:** Each action plays correctly as its own clip in the target viewer or engine.

7. **Export GLB.** File > Export > glTF 2.0: format glTF Binary (`.glb`), Selected Objects, Apply Modifiers, +Y Up. Enable Draco mesh compression only if the target loader supports it (three.js needs a Draco decoder; some engines do not import Draco).

8. **Validate and optimize.**

   ```bash
   npx @gltf-transform/cli inspect model.glb                       # meshes, textures, sizes
   npx @gltf-transform/cli optimize model.glb model.opt.glb --texture-compress webp
   ```

   Also run the Khronos glTF Validator (web or CLI) and open the result in the target engine. Resize textures to the budget (often 1024 or 2048 px for web).

   **Check:** The validator reports no errors and the optimized file is within the size budget.

9. **Automate headless.** Scripts run with `blender -b <file> -P <script> -- <args>`; Blender processes arguments in order, so place output options before the frame flags.

   ```python
   # export_all.py: blender -b assets.blend -P export_all.py -- out
   import sys
   import pathlib
   import bpy

   out = pathlib.Path(sys.argv[sys.argv.index("--") + 1])
   out.mkdir(parents=True, exist_ok=True)
   roots = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.parent is None]
   for obj in roots:
       bpy.ops.object.select_all(action="DESELECT")
       obj.select_set(True)
       for child in obj.children_recursive:
           child.select_set(True)
       bpy.context.view_layer.objects.active = obj
       bpy.ops.export_scene.gltf(
           filepath=str(out / f"{obj.name}.glb"),
           export_format="GLB",
           use_selection=True,
           export_apply=True,
       )
   ```

   ```bash
   blender -b scene.blend -o //renders/frame_#### -F PNG -f 1   # render frame 1
   blender -b scene.blend -o //renders/frame_#### -F PNG -a     # render the animation
   ```

   On Windows, call the full path, for example `& "C:\Program Files\Blender Foundation\Blender <version>\blender.exe" -b ...`. Exporter parameters change between Blender versions; check the Python API docs for your version.

   **Check:** The script exports one GLB per root object with no Python errors in the console output.

10. **Track asset licenses.** Record the source, author and license of every model, texture and HDRI (CC0, CC-BY with attribution, marketplace licenses that may forbid redistribution in open-source repos) in a manifest next to the assets.

    **Check:** Every file under the assets directory has a manifest row and required credits.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Export with unapplied scale or rotation | Apply transforms first | Wrong size, rotation, physics and skinning |
| Procedural materials straight to glTF | Bake to image textures | Exporter drops unsupported nodes |
| 4K textures for small props | Size textures to screen coverage | Download size and GPU memory |
| Export the whole scene with cameras and lights | Selected objects only | Junk nodes in the engine |
| Draco everywhere | Only where the loader supports it | Some importers fail or need extra decoders |
| Assets from unknown sources | Licensed sources with a manifest | Takedowns and store rejection |

## Verification checklist

- [ ] Metric units, applied transforms, correct origins and orientation.
- [ ] Normals outward; triangle count and texture sizes within budget.
- [ ] Materials map to Principled BSDF textures; procedural looks baked.
- [ ] GLB passes the glTF Validator and looks correct in the target engine.
- [ ] Batch scripts run headless; asset licenses recorded.

## Related

- Workflows: `/game-build`.
- Knowledge: `threejs-webgl`, `godot-engine`, `unity`, `unreal-engine`, `game-architecture`, `shaders-glsl`, `procedural-generation`.
- Agents: `game-engine-specialist`, `multimedia-producer`.
