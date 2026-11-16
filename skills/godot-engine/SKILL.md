---
name: godot-engine
description: "Develop 2D and 3D games using the Godot Engine (Godot 4), GDScript, custom nodes, signals, shaders, and physics."
---

# Godot Engine & GDScript Development

## Overview
Comprehensive guide and workflows for building robust, scalable 2D and 3D video games in Godot 4 using typed GDScript and scene-tree architectures.

## Best Practices in Godot 4
1. **Scene Organization & Composition**:
   - Favor composition over inheritance: attach behaviors via child nodes and components.
   - Encapsulate internal nodes; expose clean APIs using custom `@export` variables.
2. **Signals & Event Propagation**:
   - Rule: *"Call down, signal up"*. Parents invoke methods on child nodes; child nodes emit signals to notify parents or event buses.
   - Use typed signals: `signal health_changed(new_health: int, max_health: int)`.
3. **Character Controller & Physics**:
   - Use `CharacterBody2D` or `CharacterBody3D` with `move_and_slide()`.
   - Apply acceleration, friction, and coyote time/jump buffering for satisfying game feel.
4. **Custom Resources**:
   - Store item definitions, stats, and configurations in `.tres` custom `Resource` scripts rather than raw dictionaries or static classes.
5. **Optimization**:
   - Use `MultiMeshInstance` for rendering thousands of repetitive items (grass, bullets, particles) with minimal draw calls.
