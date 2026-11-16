---
name: game-audio-sfx
description: "Design game sound effects, procedural audio synthesis, Web Audio API integration, and adaptive music layers."
---

# Game Audio, SFX & Adaptive Music

## Overview
Audio engineering for games and interactive experiences, covering sound design, spatial positional audio, procedural sound generation, and dynamic music transitions.

## Audio Engineering Techniques
1. **Positional / Spatial 3D Audio**:
   - Calculate distance attenuation, panning, and low-pass filter occlusion based on listener coordinates relative to sound emitter.
2. **Procedural Sound Synthesis (Web Audio API)**:
   - Generate retro bleeps, explosions, and laser blasts dynamically using oscillators (`sine`, `square`, `sawtooth`), white noise buffers, and ADSR (Attack, Decay, Sustain, Release) envelope gain nodes.
3. **Adaptive / Interactive Music Systems**:
   - Horizontal re-sequencing: Branching musical sections driven by game tension or boss phases.
   - Vertical layering (stems): Fade in percussion, bass, or brass stems as player health drops or combat intensity rises.
4. **Game Feel ("Juice")**:
   - Randomize pitch slightly (e.g. $\pm 5\%$) on repetitive sound effects (footsteps, gunshots) to eliminate player fatigue.
