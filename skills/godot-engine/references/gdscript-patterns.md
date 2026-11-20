# GDScript patterns (Godot 4.x)

All snippets are statically typed and use tabs, as Godot's script editor does.
Confirm each API exists in the project's minor version before using it.

## Component node

```gdscript
class_name HealthComponent
extends Node

signal health_changed(current: int, maximum: int)
signal depleted

@export var max_health: int = 10
var current: int

func _ready() -> void:
	current = max_health

func take_damage(amount: int) -> void:
	if current <= 0:
		return
	current = maxi(current - amount, 0)
	health_changed.emit(current, max_health)
	if current == 0:
		depleted.emit()
```

The owner wires it: `@export var health: HealthComponent`, then in `_ready()`
`health.depleted.connect(_on_depleted)`. The HUD listens to `health_changed`;
the component never looks the HUD up.

## Data Resource

```gdscript
class_name WeaponData
extends Resource

@export var id: StringName = &"weapon.basic"
@export var damage: int = 1
@export_range(0.05, 2.0, 0.05) var cooldown: float = 0.25
@export var projectile: PackedScene
```

Create instances in the FileSystem dock (New Resource > WeaponData) and save
them as `.tres`. Treat them as read-only definitions; copy mutable values
(ammo, durability) into the owning node.

## AnimationTree state machine

```gdscript
@onready var _anim_tree: AnimationTree = %AnimationTree
@onready var _playback: AnimationNodeStateMachinePlayback = _anim_tree.get("parameters/playback")

func _update_animation() -> void:
	if not is_on_floor():
		_playback.travel("jump" if velocity.y < 0.0 else "fall")
	elif absf(velocity.x) > 5.0:
		_playback.travel("run")
	else:
		_playback.travel("idle")
```

Call `_update_animation()` at the end of `_physics_process`. Transitions and
blend times live in the AnimationTree editor, not in code.

## JSON save with version and atomic replace

```gdscript
const SAVE_PATH := "user://save.json"
const SAVE_VERSION := 2

func save_game(data: Dictionary) -> Error:
	var tmp_path := SAVE_PATH + ".tmp"
	var file := FileAccess.open(tmp_path, FileAccess.WRITE)
	if file == null:
		return FileAccess.get_open_error()
	file.store_string(JSON.stringify({"version": SAVE_VERSION, "data": data}))
	file.close()
	var bak_path := SAVE_PATH + ".bak"
	if FileAccess.file_exists(SAVE_PATH):
		if FileAccess.file_exists(bak_path):
			DirAccess.remove_absolute(bak_path)
		DirAccess.rename_absolute(SAVE_PATH, bak_path)
	return DirAccess.rename_absolute(tmp_path, SAVE_PATH)

func load_game() -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {}
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("Save file is corrupt: %s" % SAVE_PATH)
		return {}
	return _migrate(parsed)
```

Gotcha: `JSON.parse_string` returns every number as `float`. Convert with
`int(value)` when reading counts, IDs and versions. `_migrate` applies one
function per version step (see `game-architecture` references).

## Object pool for projectiles

```gdscript
class_name BulletPool
extends Node

@export var bullet_scene: PackedScene
@export var prewarm: int = 64
var _free: Array[Bullet] = []

func _ready() -> void:
	for i in prewarm:
		_free.append(_make())

func _make() -> Bullet:
	var b: Bullet = bullet_scene.instantiate()
	b.finished.connect(release.bind(b))
	add_child(b)
	b.deactivate()
	return b

func acquire() -> Bullet:
	var b: Bullet = _free.pop_back() if not _free.is_empty() else _make()
	b.activate()
	return b

func release(b: Bullet) -> void:
	b.deactivate()
	_free.append(b)
```

`Bullet.deactivate()` hides the node, calls `set_physics_process(false)` and
disables collision with `set_deferred("monitoring", false)` (Area2D) or by
clearing collision layers. `activate()` reverses it and resets every field.

## Hit-flash shader (canvas_item)

```glsl
shader_type canvas_item;

uniform vec4 flash_color : source_color = vec4(1.0);
uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	COLOR.rgb = mix(COLOR.rgb, flash_color.rgb, flash_amount);
}
```

Trigger from code with a tween:

```gdscript
var tween := create_tween()
tween.tween_property(sprite.material, "shader_parameter/flash_amount", 0.0, 0.12).from(1.0)
```

Each sprite that flashes independently needs its own material instance
(`resource_local_to_scene`) or an `instance uniform`.

## Scene transitions without a god autoload

A small `SceneRouter` autoload with one method, `go_to(path: String)`, that
uses `get_tree().change_scene_to_file(path)` (or a loading screen with
`ResourceLoader.load_threaded_request`) is acceptable. It owns no gameplay data.

## Performance quick wins

| Symptom | Fix |
| :--- | :--- |
| Many `get_node()` calls per frame | `@onready var x: Type = %X` once |
| Thousands of identical sprites/meshes | `MultiMeshInstance2D/3D`; update transforms in bulk |
| Spikes when shooting or spawning | Pools (above); preload scenes with `preload()` |
| Off-screen enemies still thinking | `VisibleOnScreenNotifier2D/3D` toggles processing |
| Physics cost grows with object count | Reduce collision pairs with layers/masks; simpler shapes |
| Very large counts (bullets, particles) | Draw via `RenderingServer` canvas items; use `GPUParticles2D/3D` |
