---
name: phaser
description: >-
  Builds 2D browser games with Phaser 3: game config and scaling, scene
  lifecycle and handoff, asset preloading and texture atlases, Arcade versus
  Matter physics, Tiled tilemaps and collisions, pooled groups,
  frame-rate-independent movement, touch and gamepad input, audio unlock, and
  shipping web builds. Use when making or debugging a Phaser game or getting
  one to play well on mobile browsers.
---

# Phaser

Phaser handles rendering, input, audio and physics for 2D web games; your job
is to keep scenes small and cleanly torn down, load assets efficiently, move
things in time units rather than frames, and test on real phones early.

## When to use

- Starting a 2D web game or game-jam prototype in JavaScript or TypeScript.
- Building levels from Tiled maps with collisions and spawn points.
- Fixing slow loading, leaks across scene restarts, or frame-rate-dependent movement.
- Making a Phaser game playable with touch, gamepad and mobile browser constraints.

## When not to use

- 3D or WebGL-heavy scenes: use `threejs-webgl`. Godot exports: use `godot-engine`.
- Engine-agnostic loop and state design: use `game-architecture`.
- Level layout and pacing: use `level-design`. Menus and HUD design: use `game-ui`.
- A full prototype from a one-line idea: use `/game-build`.

## Workflow

1. **Scaffold with a bundler.** Use the official template generator (`npm create @phaserjs/game@latest`; verify) or Vite plus `npm install phaser`. This skill targets the Phaser 3 API; if the project uses Phaser 4, check the migration notes first.

   **Check:** `npm run dev` shows the first scene, and `npm run build` produces a static bundle.

2. **Configure the game** (pattern below): `Phaser.AUTO` renderer, a fixed logical resolution, `Scale.FIT` with centering, `pixelArt: true` for pixel art, Arcade physics by default, enough `activePointers` for multi-touch.

   **Check:** The canvas letterboxes correctly from phone portrait to desktop widescreen.

3. **Split scenes by job.** `Boot` loads only the loading-bar assets; `Preloader` loads everything else and reports progress; gameplay scenes run the level; a `Hud` scene runs in parallel with `this.scene.launch('Hud')`. Pass data with `this.scene.start('Level', { level: 2 })` and read it in `init(data)`. Share state through `this.registry` or events, not direct scene references. Remove listeners and timers on `Phaser.Scenes.Events.SHUTDOWN`.

   **Check:** Restarting a level 10 times leaves frame rate and object counts unchanged.

4. **Load assets efficiently.** Pack sprites into texture atlases (`this.load.atlas`), provide audio in two formats (`this.load.audio('jump', ['sfx/jump.ogg', 'sfx/jump.mp3'])`), and load maps with `this.load.tilemapTiledJSON`. Extrude tilesets (with margin and spacing) to prevent seams.

   **Check:** The network panel shows a handful of atlas requests, not hundreds of PNGs, and no tile seams appear while the camera scrolls.

5. **Build levels from Tiled** (pattern below): embed tilesets in the export, mark solid tiles with a `collides` property, and place spawns and triggers on an object layer.

   **Check:** The player collides with every solid tile and spawns at the object-layer marker.

6. **Move in time, not frames.** Arcade bodies use pixels per second and step on their own fixed rate, so set velocities rather than positions. For anything moved by hand, scale by `delta` (milliseconds): `cloud.x += 20 * (delta / 1000)`. Use `this.time.addEvent` and tweens instead of `setTimeout`, so timers pause with the scene. Choose Matter physics only for rotating bodies or complex shapes.

   **Check:** Gameplay speed is identical with the browser at 60 Hz and 120 Hz or under CPU throttling.

7. **Pool frequent objects** with physics groups (`maxSize`, `get`, `disableBody(true, true)`) instead of creating and destroying sprites.

   **Check:** A one-minute stress test shows a flat heap in DevTools Memory.

8. **Make it work on phones.** Big on-screen controls (at least 44 to 48 CSS pixels), `touch-action: none` on the game container to stop scrolling and zooming, fullscreen only from a user gesture (`this.scale.startFullscreen()`), audio started after the unlock event, and pause when the tab is hidden. Enable gamepads with `input: { gamepad: true }`.

   **Check:** The game is playable on iOS Safari and Android Chrome with sound, and resumes cleanly after switching apps.

9. **Ship the build.** Serve `dist/` locally to test, keep the initial download small, use hashed asset names for caching, and for itch.io zip the build with `index.html` at the root. Wrap with Capacitor only if an app store is a requirement.

   **Check:** The production bundle loads from a static server with no console errors and an acceptable first-load size.

## Patterns

### Game config

```ts
import Phaser from 'phaser';
import { Boot, Preloader, Level, Hud } from './scenes';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 480,
  height: 270,
  pixelArt: true,
  backgroundColor: '#1d1d2b',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 900 }, debug: false } },
  input: { activePointers: 3, gamepad: true },
  scene: [Boot, Preloader, Level, Hud],
});
```

### Tilemap, collisions and pooled bullets

```ts
create(): void {
  const map = this.make.tilemap({ key: 'level1' });
  // tileset name in Tiled, texture key, tile size, margin, spacing (extruded tileset)
  const tiles = map.addTilesetImage('terrain', 'terrain-tiles', 16, 16, 1, 2)!;
  const ground = map.createLayer('Ground', tiles, 0, 0)!;
  ground.setCollisionByProperty({ collides: true });

  const spawn = map.findObject('Objects', (o) => o.name === 'PlayerSpawn')!;
  this.player = this.physics.add.sprite(spawn.x!, spawn.y!, 'hero', 'idle-0');
  this.physics.add.collider(this.player, ground);

  this.bullets = this.physics.add.group({ maxSize: 40 });
  this.physics.add.collider(this.bullets, ground, (b) =>
    (b as Phaser.Physics.Arcade.Sprite).disableBody(true, true));

  this.cameras.main.startFollow(this.player, true).setBounds(0, 0, map.widthInPixels, map.heightInPixels);
}

fire(dir: 1 | -1): void {
  const b = this.bullets.get(this.player.x, this.player.y, 'bullet') as Phaser.Physics.Arcade.Sprite | null;
  if (!b) return;                                   // pool exhausted: skip, don't allocate
  b.enableBody(true, this.player.x, this.player.y, true, true);
  b.setVelocityX(400 * dir);
}
```

### Physics choice

| Engine | Use for | Avoid when |
| :--- | :--- | :--- |
| Arcade | Platformers, shooters, top-down; axis-aligned boxes and circles; many bodies | You need rotation-aware collisions or joints |
| Matter | Physics puzzles, ragdolls, polygons, constraints | Hundreds of bodies on mobile |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `x += 5` per update | Velocities, or scale by `delta / 1000` | Speed changes with refresh rate |
| `setTimeout` and `setInterval` | `this.time.addEvent` and tweens | Native timers ignore scene pause and restart |
| Hundreds of single PNGs | Texture atlases | Load time and draw-call overhead |
| Create sprites in `update` | Pooled groups | GC hitches, especially on mobile |
| Leave listeners attached on restart | Remove them on `SHUTDOWN` | Duplicated handlers and leaks |
| Play audio on page load | Wait for the unlock after the first gesture | Browsers block autoplay |
| Test only on desktop Chrome | iOS Safari and Android Chrome on real devices | Touch, audio and performance differ widely |

## Verification checklist

- [ ] Scenes have single jobs, pass data explicitly and clean up on shutdown.
- [ ] Assets load from atlases with a visible progress bar.
- [ ] Movement and timers are time-based and identical at different refresh rates.
- [ ] Frequently spawned objects are pooled; the heap stays flat under stress.
- [ ] Touch controls, audio unlock and pause-on-hide work on real phones.
- [ ] The production bundle runs from a static server without console errors.

## Related

- Workflows: `/game-build`, `/verify`, `/e2e`.
- Knowledge: `game-architecture`, `level-design`, `game-ui`, `game-audio-sfx`, `procedural-generation`, `typescript-patterns`, `game-publishing`.
- Agents: `game-engine-specialist`, `typescript-reviewer`, `performance-optimizer`.
