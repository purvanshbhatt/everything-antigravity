---
trigger: glob
globs: "**/*.gd"
description: GDScript and Godot 4 conventions
---

# GDScript (Godot 4)

## Version

- Write Godot 4 syntax. Godot 3 forms are errors here: `export` -> `@export`, `onready` -> `@onready`, `yield` -> `await`, `KinematicBody2D` -> `CharacterBody2D`, `connect("sig", self, "_m")` -> `sig.connect(_m)`.
- Check `project.godot` (`config/features`) for the exact 4.x version before using newer APIs.

## Static typing

- Type every variable, parameter and return: `var speed: float = 200.0`, `func hit(amount: int) -> void:`. Use `:=` only when the type is obvious.
- Use typed arrays and dictionaries where supported (`Array[Enemy]`), and `class_name` for reusable scripts.
- Enable the typing warnings (such as `untyped_declaration`) in Project Settings > Debug > GDScript when the project allows.

## Naming and order

- `snake_case` for functions, variables and files; `PascalCase` for `class_name` and nodes; `CONSTANT_CASE` for constants; prefix private members with `_`.
- Signals are past-tense verbs: `health_changed`, `died`.
- Script order: `class_name`, `extends`, signals, enums, constants, `@export` vars, public vars, private vars, `@onready` vars, `_init`, `_ready`, other built-in callbacks, public methods, private methods.

## Architecture

- "Call down, signal up": parents call methods on children; children emit signals. Avoid `get_parent()` chains and absolute paths such as `/root/Main/Player`.
- Get node references once with `@onready var` or `@export var target: Node2D`; use `%UniqueName` for scene-unique nodes. Never call `get_node` in `_process`.
- Keep autoloads (singletons) few and focused: event bus, save system, settings.
- Put tunable data in custom `Resource` files, not magic numbers in scripts.

## Game loop

- Movement and physics go in `_physics_process(delta)`; visuals and non-physics timers in `_process(delta)`.
- Scale per-frame changes by `delta`. `CharacterBody2D/3D.velocity` is in units per second and `move_and_slide()` applies the timestep itself, so do not multiply `velocity` by `delta` before calling it.
- Read input through Input Map actions (`Input.is_action_pressed("move_left")`, `Input.get_vector(...)`), never raw keycodes. Handle gameplay input in `_unhandled_input` so UI can consume events first.

## Performance and memory

- `preload` scenes and resources known at parse time; `load` or `ResourceLoader.load_threaded_request` for dynamic content.
- Pool frequently spawned nodes (bullets, particles, pickups) instead of instancing and freeing every frame.
- Free nodes with `queue_free()`, not `free()`, and check `is_instance_valid(node)` before using references that may have been freed.
- Disconnect signals you connected manually to long-lived objects when the listener leaves the tree.

## Errors and debugging

- Use `push_error()` / `push_warning()` for recoverable problems and `assert()` for invariants (asserts are stripped in release builds).
- Check return values of `FileAccess.open`, `ResourceLoader.load` and `connect` (`FileAccess.get_open_error()`).

## Tests

- Use the project's framework (GUT or gdUnit4). Keep game rules (damage, scoring, inventory) in plain scripts or resources that can be tested without a running scene.
