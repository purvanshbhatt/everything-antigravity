---
name: procedural-generation
description: "Implement procedural algorithms for level design, terrain heightmaps, Perlin noise, dungeon generation, and tilemaps."
---

# Procedural Generation & World Synthesis

## Overview
Techniques and algorithms for generating deterministic, infinite, or replayable game worlds, dungeons, item stats, and procedural textures.

## Core Algorithms
1. **Perlin & Simplex Noise Terrain**:
   - Octave compounding: Combine multiple frequencies and amplitudes to generate realistic mountains, hills, and oceans.
   - Domain warping: Feed noise coordinates into secondary noise functions to create natural riverbeds and coastlines.
2. **Dungeon Generation (Binary Space Partitioning & Cellular Automata)**:
   - BSP Trees: Recursively slice bounding boxes into rooms, ensuring connected corridors via Minimum Spanning Trees (MST) or Delaunay Triangulation.
   - Cellular Automata: Cave generation using birth/death rules over grid cells.
3. **Wave Function Collapse (WFC)**:
   - Generate tilemaps and 3D architectural levels constrained by adjacent socket connectivity rules.
4. **Deterministic Random Seeds**:
   - Always initialize RNG with an explicit seed (`random.seed(seed)` or `Xoroshiro128+`) to allow players to replay and share specific world layouts.
