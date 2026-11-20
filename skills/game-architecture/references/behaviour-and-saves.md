# Behaviour models and save systems

Detail for steps 4 and 8 of the `game-architecture` workflow.

## FSM with a transition table (TypeScript)

```ts
type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'hurt' | 'dead';

const ALLOWED: Record<PlayerState, readonly PlayerState[]> = {
  idle: ['run', 'jump', 'fall', 'hurt', 'dead'],
  run:  ['idle', 'jump', 'fall', 'hurt', 'dead'],
  jump: ['fall', 'hurt', 'dead'],
  fall: ['idle', 'run', 'hurt', 'dead'],
  hurt: ['idle', 'fall', 'dead'],
  dead: [],
};

interface StateHandlers { enter?(): void; exit?(): void; step(dt: number): PlayerState | null }

export class Fsm {
  constructor(private handlers: Record<PlayerState, StateHandlers>, public state: PlayerState) {
    handlers[state].enter?.();
  }
  step(dt: number): void {
    const next = this.handlers[this.state].step(dt);
    if (next && next !== this.state) this.transition(next);
  }
  transition(next: PlayerState): void {
    if (!ALLOWED[this.state].includes(next)) {
      throw new Error(`Illegal transition ${this.state} -> ${next}`);
    }
    this.handlers[this.state].exit?.();
    this.state = next;
    this.handlers[next].enter?.();
  }
}
```

Test the table directly: every state except terminal ones has at least one
outgoing edge, and `dead` has none.

## HFSM

Group states under parents (`Grounded { idle, run }`, `Airborne { jump, fall }`).
Global interrupts (`hurt`, `dead`) are checked on the root before delegating to
the active child. Enter/exit run from the outermost changed parent inward on
entry, and innermost outward on exit.

## Behaviour tree essentials

| Node | Returns |
| :--- | :--- |
| Sequence | Ticks children in order; fails on the first Failure, returns Running if a child runs, Success when all succeed |
| Selector (Fallback) | Ticks children in order; succeeds on the first Success, Running if a child runs, Failure when all fail |
| Decorator | Wraps one child: Inverter, Repeat(n), Cooldown(s), TimeLimit(s) |
| Condition leaf | Success/Failure only, no side effects |
| Action leaf | May return Running across ticks; must be cancellable (abort hook) |

Rules: keep per-agent data on a blackboard, not in nodes, so one tree asset is
shared by many agents; tick AI at a lower rate (for example 10 Hz, staggered by
entity ID) when the frame budget is tight; log the active path in debug builds.

## Save format

```json
{
  "version": 3,
  "game": "my-game",
  "savedAt": "2026-01-01T12:00:00Z",
  "rngSeed": 123456789,
  "data": {
    "player": { "pos": [12.5, 4.0], "hp": 80, "inventory": ["item.sword_basic"] },
    "world": { "openedDoors": ["door.a1"], "tick": 48211 }
  }
}
```

- Reference content by stable string IDs (`item.sword_basic`), never by array
  index or engine resource path that may move.
- Store the PRNG seed and stream positions if procedural content depends on them.

## Forward migrations

```ts
interface SaveFile { version: number; rngSeed?: number; data: Record<string, unknown> }
type Migration = (save: SaveFile) => SaveFile;

export const CURRENT_VERSION = 3;
const MIGRATIONS: Record<number, Migration> = {
  1: (s) => {                                   // v1 -> v2: player.health renamed to player.hp
    const player = { ...(s.data.player as Record<string, unknown>) };
    player.hp = player.health;
    delete player.health;
    return { ...s, version: 2, data: { ...s.data, player } };
  },
  2: (s) => ({ ...s, version: 3, rngSeed: s.rngSeed ?? 0 }),   // v2 -> v3: seed added
};

export function migrate(raw: unknown): SaveFile {
  const save = raw as Partial<SaveFile> | null;
  if (typeof save?.version !== 'number' || save.version > CURRENT_VERSION
      || typeof save.data !== 'object' || save.data === null) {
    throw new Error(`Unsupported or corrupt save (version ${String(save?.version)})`);
  }
  let s = save as SaveFile;
  while (s.version < CURRENT_VERSION) {
    const next = MIGRATIONS[s.version];
    if (!next) throw new Error(`No migration from save version ${s.version}`);
    s = next(s);
  }
  return s;
}
```

Keep a fixture save from every released version in `tests/fixtures/saves/` and
load each one in CI.

## Atomic write

1. Serialize to bytes; optionally append a checksum (CRC32 or SHA-256).
2. Write to `save.json.tmp`, flush and close.
3. Rename the existing `save.json` to `save.json.bak` (keep one backup).
4. Rename `save.json.tmp` to `save.json` (atomic on the same volume).
5. On load: verify checksum; on failure fall back to `.bak` and tell the player.

Browser: `localStorage` is synchronous and small (about 5 MB); use IndexedDB
for larger saves. Godot: write to `user://` with `FileAccess` and JSON (see
`godot-engine`). Never load executable formats (pickled objects, Godot resources
containing scripts) from files a player can share.
