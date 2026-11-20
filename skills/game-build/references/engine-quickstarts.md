# Engine quickstarts, verification and playtesting

Engine APIs move between major versions. Check the installed version
(`npm ls phaser three`, `godot --version`) and its docs before copying code.

## Phaser skeleton (Phaser 3-style API; verify against your version)

```ts
import Phaser from 'phaser';

class Play extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  private orbs!: Phaser.Physics.Arcade.Group;
  private keys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private score = 0;

  constructor() { super('play'); }

  create(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillCircle(12, 12, 12).generateTexture('dot', 24, 24).destroy();  // no asset files needed
    this.player = this.physics.add.image(480, 270, 'dot').setTint(0x38bdf8).setCollideWorldBounds(true);
    this.orbs = this.physics.add.group();
    this.orbs.create(200, 200, 'dot').setTint(0xf5b700);
    this.keys = this.input.keyboard!.createCursorKeys();
    this.physics.add.overlap(this.player, this.orbs, (_p, orb) => this.collect(orb as Phaser.Physics.Arcade.Image));
  }

  private collect(orb: Phaser.Physics.Arcade.Image): void {
    orb.disableBody(true, true);
    this.score++;
    this.cameras.main.shake(100, 0.006);                       // screen shake
    this.physics.world.pause();                               // hit-stop
    this.time.delayedCall(60, () => this.physics.world.resume());
  }

  update(): void {
    const speed = 260;
    const vx = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
    const vy = (this.keys.down.isDown ? 1 : 0) - (this.keys.up.isDown ? 1 : 0);
    this.player.setVelocity(vx * speed, vy * speed);          // arcade physics integrates on its own step
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  backgroundColor: '#0b1020',
  physics: { default: 'arcade', arcade: { debug: false } },  // check fixed-step options in the arcade physics docs
  scene: [Play],
});
```

Phaser's arcade physics steps at a fixed rate internally, so set velocities in
`update()` rather than moving positions by hand. Particle and FX APIs changed
in 3.60; check the docs of the installed version before adding emitters.

## Three.js skeleton

Use the fixed-timestep loop from `game-architecture` with
`renderer.setAnimationLoop(frame)` instead of `requestAnimationFrame`, keep the
simulation in a pure module as in the Canvas starter, and copy each simulated
position into its `Object3D` with interpolation:

```ts
mesh.position.set(prev.x + (cur.x - prev.x) * alpha, 0, prev.z + (cur.z - prev.z) * alpha);
```

Renderer setup, color management and disposal: `threejs-webgl`.

## Godot 4.x skeleton

1. Create the project in the editor, or write a minimal `project.godot` and
   let the editor upgrade it on first open. Set the main scene in Project
   Settings > Application > Run.
2. Build the prototype from code in one script so it runs without hand-edited
   scene files, then move pieces into scenes once the loop is fun.

```gdscript
extends Node2D

const SPEED := 260.0

var _player_pos := Vector2(480, 270)

func _ready() -> void:
	_ensure_action(&"move_left", [KEY_A, KEY_LEFT])
	_ensure_action(&"move_right", [KEY_D, KEY_RIGHT])
	_ensure_action(&"move_up", [KEY_W, KEY_UP])
	_ensure_action(&"move_down", [KEY_S, KEY_DOWN])

func _physics_process(delta: float) -> void:
	var dir := Input.get_vector(&"move_left", &"move_right", &"move_up", &"move_down")
	_player_pos += dir * SPEED * delta
	queue_redraw()

func _draw() -> void:
	draw_circle(_player_pos, 12.0, Color("#38bdf8"))

func _ensure_action(action: StringName, keys: Array[int]) -> void:
	if InputMap.has_action(action):
		return
	InputMap.add_action(action)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k as Key
		InputMap.action_add_event(action, ev)
```

Smoke run (exits after N main-loop iterations; check `godot --help`):

```powershell
& $env:GODOT_BIN --path . --headless --quit-after 600 2>&1 | Tee-Object -Variable log | Out-Null
if ($log -match 'ERROR') { throw "Godot reported errors during the smoke run" }
```

```bash
if "$GODOT_BIN" --path . --headless --quit-after 600 2>&1 | grep -E 'ERROR'; then
  echo "Godot reported errors during the smoke run"; exit 1
fi
```

Tests and export: `godot-engine` references.

## Browser verification snippet

Run in the page (through the browser subagent's JavaScript evaluation or the
DevTools console) while the game is in its busiest state:

```js
await new Promise((resolve) => {
  const t = [];
  let last = performance.now();
  const tick = (now) => {
    t.push(now - last);
    last = now;
    if (t.length < 300) return requestAnimationFrame(tick);
    t.sort((a, b) => a - b);
    resolve({
      avgFps: +(1000 / (t.reduce((a, b) => a + b, 0) / t.length)).toFixed(1),
      p95Ms: +t[Math.floor(t.length * 0.95)].toFixed(2),
      maxMs: +t[t.length - 1].toFixed(2),
    });
  };
  requestAnimationFrame(tick);
});
```

`requestAnimationFrame` follows the display refresh rate (a 120 Hz screen
reports about 120 fps), so judge the result by p95 frame time against the
16.7 ms budget. Also read the console messages and fail verification on any
error or unhandled rejection.

Optional automated smoke test with Playwright (delegate to the `e2e-runner`
subagent): load the page, press Enter, hold an arrow key for two seconds,
assert `window.__game.world.tick > 0` and that no `pageerror` events fired.

## Playtest checklist

- [ ] A new player understands the goal within about 10 seconds without being told.
- [ ] Input to visible reaction feels immediate (no perceptible delay).
- [ ] Losing feels fair: the player can see what hit them and why.
- [ ] Restart takes under 2 seconds and needs one key.
- [ ] Difficulty rises over the session; the target session length is met.
- [ ] Every action has sound; there is a mute toggle.
- [ ] Reduced motion disables shake and flash; no flashing above 3 times per second.
- [ ] Information is not conveyed by color alone (add shape or icon cues).
- [ ] The game pauses or stays stable when the tab loses focus.
- [ ] No frame-time hitches during a 60-second stress moment.

## Five-question feedback form

1. What were you trying to do?
2. What was the most satisfying moment?
3. When did you feel confused or treated unfairly?
4. What would make you play one more round?
5. On a scale of 1 to 5, how did the controls feel?

Record answers in the walkthrough under `Playtest notes`, then fix the top
three issues before adding content.
