---
name: remotion-motion-graphics
description: "Create programmatic, high-definition motion graphics and videos using Remotion (React for video), spring animations, and audio syncing."
---

# Remotion Programmatic Video & Motion Graphics

## Overview
Author, preview, and render production-grade motion design videos using Remotion, TypeScript, React components, and CSS animations.

## Core Concepts
1. **Compositions & Sequences**:
   - `Composition`: Root video container defining dimensions (`width`, `height`), frame rate (`fps`), and duration (`durationInFrames`).
   - `Sequence`: Shifts time offset for child elements without complex math: `<Sequence from={30} durationInFrames={60}>`.
2. **Animation Physics (Interpolation & Springs)**:
   - `interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" })`.
   - `spring({ frame, fps, config: { damping: 12, mass: 0.5, stiffness: 100 } })` for realistic kinetic UI animations.
3. **Audio Integration**:
   - `<Audio src={soundTrack} volume={0.8} />` with automatic audio ducking during voiceovers.
4. **Programmatic Data Ingestion**:
   - Parameterize compositions via `defaultProps` so new videos can be rendered via CLI from external JSON data.

## Rendering Command
```bash
npx remotion render src/index.ts Main out/video.mp4 --props='{"title":"Launch Day"}'
```
