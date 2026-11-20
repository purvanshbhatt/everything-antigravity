---
name: godot-engine
description: >-
  Builds and reviews Godot 4.x projects: scene and node composition, signals
  and sparing autoloads, statically typed GDScript, custom Resources,
  CharacterBody2D/3D movement with move_and_slide, AnimationTree, shaders,
  headless export, GUT or gdUnit4 tests, and performance work with servers and
  MultiMesh. Use when the project has project.godot, .gd or .tscn files, or the
  user asks about Godot or GDScript versus C#.
---

# Godot Engine

Ship Godot 4 projects that are composed from small reusable scenes, statically
typed, testable headlessly and exportable from the command line. Most Godot
pain comes from global state in autoloads, untyped scripts and shared
Resources mutated at runtime; this skill prevents all three.

## When to use

- Any work inside a Godot 4.x project (`project.godot`, `*.gd`, `*.tscn`, `*.tres`, `*.gdshader`).
- Designing scene structure, signals, autoloads or data Resources.
- Character movement, AnimationTree state machines, shaders, export presets or CI for Godot.
- Choosing between GDScript and C#, or fixing frame drops in a Godot game.

## When not to use

- Engine-agnostic loop, state machine, save or determinism design: use `game-architecture`.
- Browser 3D with Three.js or R3F: use `threejs-webgl`.
- Level or terrain algorithms themselves: use `procedural-generation` (Godot ships `FastNoiseLite`).
- Godot 3.x projects: APIs differ (`KinematicBody2D`, `yield`); confirm the version before applying anything here.

## Workflow

1. **Detect the version and layout.** `view_file` on `project.godot` (`config/features` lists the 4.x minor version), `list_dir` on `addons/`, and look for `*.csproj` (C#/.NET build). Locate the editor binary: `godot --version`; on Windows use the `*_console.exe` build so output reaches the terminal.

   **Check:** You can state the Godot minor version, GDScript or C#, installed addons, and the binary path.

2. **Enforce static typing.** Type every variable, parameter and return (`var speed: float`, `-> void`, `Array[Enemy]`). In Project Settings > Debug > GDScript, raise `Untyped Declaration` and the `Unsafe *` warnings to Error or Warn (setting names vary by minor version; verify). Parse-check a script headlessly with `godot --headless --check-only --script res://path/to/file.gd`.

   **Check:** The project opens with no GDScript warnings in the Output panel.

3. **Compose scenes.** One scene per reusable thing; the root node type matches its role. Behaviour lives in child component nodes (`HealthComponent`, `Hitbox`, `StateMachine`) wired by `@export` references. Rule: call down, signal up. Use `%UniqueName` instead of long `$A/B/C` paths. Autoloads only for true services (save, settings, audio, scene transitions), never for mutable gameplay state.

   **Check:** Each scene runs on its own with Run Current Scene (F6) without errors.

4. **Put data in Resources.** `class_name WeaponData extends Resource` with `@export` fields, saved as `.tres`. Resources are shared by reference: call `duplicate()` (or enable `resource_local_to_scene`) before mutating per instance.

   **Check:** A test damages one enemy and asserts a second enemy using the same `.tres` is unchanged.

5. **Movement and physics.** Do movement in `_physics_process(delta)`: set `velocity`, then call `move_and_slide()`. Name collision layers in Project Settings > Layer Names. If the display rate exceeds the physics tick rate, enable physics interpolation (2D since 4.3, 3D since 4.4; verify for your version).

   **Check:** Movement is identical at 60 Hz and 144 Hz displays; nothing tunnels at maximum speed.

6. **Animation.** AnimationPlayer holds clips; AnimationTree with an `AnimationNodeStateMachine` drives characters. Gameplay code sets parameters or calls `travel()`; it does not call `play()` from many places.

7. **Shaders.** `shader_type canvas_item;` (2D) or `spatial;` (3D), uniforms with hints, parameters set via `material.set_shader_parameter()`. Use `instance uniform` for per-instance variation without duplicating materials.

8. **Tests in CI.** GUT or gdUnit4, run headlessly (commands in [export and CI](references/export-and-ci.md)). Delegate test design to the `test-engineer` subagent with the component list.

   **Check:** The headless test command exits non-zero on a deliberately failing test.

9. **Profile.** Debugger > Profiler and Visual Profiler, plus Monitors (draw calls, objects, physics). Fixes, in order: cache node lookups with `@onready`; pool instead of `instantiate()`/`queue_free()` per shot; `MultiMeshInstance2D/3D` for thousands of identical meshes; `VisibleOnScreenNotifier2D/3D` to sleep off-screen logic; direct `RenderingServer`/`PhysicsServer2D` calls for extreme counts.

   **Check:** The stress scene stays inside the frame budget with Monitors recorded in the walkthrough.

10. **Export.** Install export templates matching the editor version exactly, commit `export_presets.cfg`, keep signing secrets out of git, then `godot --headless --export-release "<Preset Name>" <output path>`. Confirm with the user before uploading builds anywhere.

    **Check:** The exported build launches on the target OS and its log shows no errors.

## Patterns

### Typed platformer body with coyote time and jump buffer

```gdscript
class_name Player
extends CharacterBody2D

signal died

@export var move_speed: float = 220.0
@export var accel: float = 2200.0
@export var jump_velocity: float = -420.0
@export var coyote_time: float = 0.10
@export var jump_buffer: float = 0.12

var _gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity")
var _since_floor: float = INF
var _since_jump: float = INF

func _physics_process(delta: float) -> void:
	_since_floor = 0.0 if is_on_floor() else _since_floor + delta
	_since_jump = 0.0 if Input.is_action_just_pressed("jump") else _since_jump + delta

	if not is_on_floor():
		velocity.y += _gravity * delta
	if _since_jump <= jump_buffer and _since_floor <= coyote_time:
		velocity.y = jump_velocity
		_since_floor = INF
		_since_jump = INF

	var dir: float = Input.get_axis("move_left", "move_right")
	velocity.x = move_toward(velocity.x, dir * move_speed, accel * delta)
	move_and_slide()
```

### Signals

```gdscript
signal health_changed(current: int, maximum: int)   # declare typed
health_changed.emit(_hp, max_hp)                     # emit
hurtbox.area_entered.connect(_on_hurtbox_area_entered)  # connect a Callable
```

Disconnect or let the node free itself; never connect in `_process`.

### GDScript or C#

| Factor | GDScript | C# (.NET build) |
| :--- | :--- | :--- |
| Iteration speed | Hot reload, no compile step | Compile step; IDE tooling is stronger |
| Raw CPU performance | Slower for heavy loops (typed code helps) | Faster for algorithmic hot paths |
| Platforms | All export targets | Check current docs: web export has not been supported for C# in Godot 4, mobile support has been flagged experimental |
| Ecosystem | Most addons, tutorials and examples | NuGet libraries; fewer Godot-specific addons |
| Recommendation | Default for gameplay | Use when the team knows C#, needs NuGet, or has CPU-heavy systems and no web target |

Mixing is allowed: keep gameplay in GDScript and move a measured hot spot to
C# or GDExtension.

More code (component nodes, AnimationTree, JSON saves, pooling, shaders):
[GDScript patterns](references/gdscript-patterns.md).

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Store player HP, score and inventory in an autoload | Keep state in scene nodes or Resources; autoloads emit or route events | Global state makes scenes untestable alone and order-dependent |
| `get_node("../../UI/HUD")` from gameplay | Emit a signal; let the parent wire it | Paths break silently when scenes move |
| Untyped `var x = ...` everywhere | Static types and `:=` inference | Errors surface at runtime instead of in the editor |
| Mutating a shared `.tres` at runtime | `duplicate()` first or `resource_local_to_scene` | Every instance using the resource changes together |
| Movement in `_process` | `_physics_process` + `move_and_slide()` | Frame-rate dependent motion and collision bugs |
| Saving games with `ResourceSaver` and loading player files with `load()` | `FileAccess` + JSON with a version field | Resource files can embed scripts; a shared save becomes code execution |
| Committing `.godot/` or signing secrets | Ignore `.godot/`; keep credentials outside git | Cache churn and leaked keystore passwords |

## Verification checklist

- [ ] Godot version confirmed; APIs used exist in that version.
- [ ] Scripts are statically typed and the project opens with no GDScript warnings.
- [ ] Each reusable scene runs standalone; autoloads hold no gameplay state.
- [ ] Per-instance Resource data is duplicated before mutation.
- [ ] Movement runs in `_physics_process` with `move_and_slide()`.
- [ ] Headless tests pass in CI and fail when they should.
- [ ] Export runs headlessly with templates matching the editor version.
- [ ] Profiler numbers for the stress scene are recorded.

## Related

- Workflows: `/game-build`, `/tdd`, `/verify`, `/build-fix`.
- Knowledge: `game-architecture`, `procedural-generation`, `game-audio-sfx`, `ci-cd-github-actions`, `tdd-testing`.
- Agents: `game-engine-specialist`, `test-engineer`, `performance-optimizer`, `build-error-resolver`.
