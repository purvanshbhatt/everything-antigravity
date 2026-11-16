---
name: threejs-webgl
description: "Build interactive 3D web applications and games using Three.js, React Three Fiber (R3F), GLSL shaders, and WebGL."
---

# Interactive 3D Web & Three.js Engineering

## Overview
Develop fluid, immersive 3D graphics, browser games, and interactive product configurators using Three.js and WebGL.

## Technical Fundamentals
1. **Scene Setup & Optimization**:
   - Camera management: `PerspectiveCamera` with tuned FOV and near/far planes to prevent Z-fighting.
   - PBR Lighting: Directional light with shadow maps (`PCFSoftShadowMap`), Ambient light, and HDR Environment maps for realistic reflections.
2. **Asset Pipeline**:
   - Load optimized 3D assets using `GLTFLoader` with Draco mesh compression and KTX2 texture compression.
   - Reuse geometries and materials across multiple meshes to minimize GPU draw calls.
3. **Custom GLSL Shaders**:
   - Write vertex and fragment shaders for custom effects (water ripples, forcefields, dissolving shields).
4. **Interactive Controls & Physics**:
   - Implement `OrbitControls`, `PointerLockControls`, or integrate lightweight physics engines like `@dimforge/rapier3d-compat` or Cannon-es.
