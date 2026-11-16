---
name: game-architecture
description: "Architect video game systems: fixed-timestep game loops, Entity Component System (ECS), state machines, and physics integration."
---

# Video Game Architecture & Systems Design

## Overview
Design, build, and optimize real-time video game architectures across 2D and 3D engines.

## Core Architectural Components
1. **The Deterministic Game Loop**:
   - Fixed timestep physics (`fixed_delta = 1.0 / 60.0`).
   - Variable timestep rendering with state interpolation to prevent visual stutter:
     ```python
     accumulator += delta_time
     while accumulator >= dt:
         physics_update(dt)
         accumulator -= dt
     render(accumulator / dt)
     ```
2. **Entity Component System (ECS)**:
   - **Entities**: Simple unique IDs.
   - **Components**: Plain data containers without logic (e.g. `Position`, `Velocity`, `Sprite`, `Health`).
   - **Systems**: Pure logic operating on entities possessing specific component masks (e.g. `MovementSystem`, `CombatSystem`).
3. **Hierarchical Finite State Machines (HFSM)**:
   - Character states (Idle, Walk, Run, Jump, Attack, Hurt, Dead) with explicit valid transition rules and enter/exit hooks.
4. **Spatial Partitioning**:
   - Grid-based partitioning or Quadtrees/Octrees for fast collision detection and visibility culling.
