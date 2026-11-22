---
name: game-ai
description: >-
  Builds game AI that is fun, readable and cheap: finite and hierarchical
  state machines, behaviour trees with blackboards, utility scoring, A* on
  grids and navmeshes with path smoothing, flow fields, steering and local
  avoidance, sight and hearing perception, time-sliced updates and debug
  visualization, using the navigation systems in Unity, Unreal and Godot. Use
  when designing enemy or NPC behaviour or fixing pathfinding and crowd bugs.
---

# Game AI

Game AI exists to create a good experience, not to win. Behaviour should be
readable (players can predict and counter it), fair (no visible cheating) and
cheap enough to run for every agent within the frame budget. Choose the
simplest decision model that expresses the design, and make every decision
visible in debug views.

## When to use

- Designing enemies, companions, NPC routines or RTS units.
- Choosing between FSMs, behaviour trees, utility AI or planning.
- Agents get stuck, take silly paths, jitter, crowd into each other or cost too much CPU.
- Adding perception (sight, hearing, memory) and difficulty knobs.

## When not to use

- The core loop, fixed timestep and generic state-machine plumbing: use `game-architecture`.
- Engine API specifics: use `unity`, `unreal-engine` or `godot-engine` alongside this skill.
- LLM-driven agents and tool use outside gameplay: use `agent-design-patterns`.
- Generating maps or dungeons: use `procedural-generation`.

## Workflow

1. **Specify behaviour from the player's side.** For each agent type, list what the player should notice and how to counter it: telegraph windows before attacks, reaction delays, preferred ranges, retreat rules. Name difficulty knobs (reaction time, accuracy, aggression, perception range).

   **Check:** Each behaviour has a tell the player can learn, and each knob has a default and a range.

2. **Pick the decision model** with the table below. Start with an FSM or HFSM; move to a behaviour tree when priorities and fallbacks multiply, and to utility scoring when many options compete on context.

   **Check:** The choice and its reason are in the implementation plan artifact.

3. **Add perception.** Sight as a cone (angle, range) plus a line-of-sight raycast; hearing as events with position and loudness; memory of last known position with a timestamp that decays. Update perception at 5 to 10 Hz, staggered across agents.

   **Check:** A debug view draws the cones and last-known positions, and agents react to a thrown noise event.

4. **Choose the navigation representation.** Grids for tile games, waypoint graphs for simple fixed routes, navmeshes for 3D or free-form 2D spaces. Use the engine's navmesh (Unity AI Navigation `NavMeshSurface` and `NavMeshAgent`, Unreal Navigation System, Godot `NavigationRegion3D` and `NavigationAgent3D` nodes (or the 2D variants), or Recast and Detour directly), with agent radius and height matching the collider.

   **Check:** The baked navmesh covers every walkable area, with no gaps at doorways and stairs.

5. **Path with A* and smooth the result.** Use an admissible heuristic for the movement model, break ties toward the goal, smooth grid paths with string pulling or the funnel algorithm, and handle unreachable goals explicitly. Queue path requests with a per-frame budget and cache shared routes; use flow fields when many units share one goal.

   **Check:** Unit tests cover shortest path, blocked diagonals and unreachable goals, and path requests never exceed the per-frame budget.

6. **Steer locally.** Combine seek, arrive, flee, wander and separation with weights or priorities, clamped by maximum force and speed, integrated at the fixed tick. Use the engine's avoidance (RVO-style) for crowds.

   **Check:** Ten agents through one doorway neither deadlock nor overlap for long.

7. **Budget and level-of-detail.** Lower decision and perception rates for distant or off-screen agents, round-robin expensive updates across frames, and cap agents thinking per tick.

   **Check:** The AI cost in the profiler stays under its budget with the peak agent count from the plan.

8. **Make it debuggable and deterministic.** Draw state names or the active behaviour-tree branch above agents, render paths and blackboard values, log decisions with reasons, and seed randomness so bugs replay.

   **Check:** A reported bug can be reproduced from its seed and input log.

9. **Playtest and tune** the knobs per difficulty level; watch for behaviour that looks like cheating (shooting through walls, perfect tracking) and add misses or delays.

   **Check:** Testers describe enemy behaviour in their own words, and it matches the spec from step 1.

## Patterns

### Decision models

| Model | Best for | Weakness |
| :--- | :--- | :--- |
| FSM | Few clear states (patrol, chase, attack) | Transition explosion beyond about 10 states |
| Hierarchical FSM | Shared sub-states and global interrupts (stunned, dead) | Still hand-wired transitions |
| Behaviour tree | Priorities, fallbacks, long-running actions | Tuning priorities across many branches |
| Utility AI | Many competing options weighed by context | Needs curves and care to avoid dithering |
| Goal-oriented planning | Emergent multi-step plans | Costly to run and hard to make predictable |

Behaviour-tree nodes return Success, Failure or Running: a Selector tries children until one succeeds, a Sequence runs children until one fails, Decorators wrap one child (invert, repeat, cooldown, condition). Keep shared facts on a blackboard and abort lower-priority branches when conditions change.

Utility scoring: each option's score is the product of considerations normalized to 0 to 1 through response curves; add a small bonus to the current action so agents commit instead of flickering between near-equal options.

### A* on a grid (TypeScript, 8-way, no corner cutting)

```ts
type P = { x: number; y: number };
const octile = (a: P, b: P): number => {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
};

export function aStar(walkable: boolean[][], start: P, goal: P): P[] | null {
  const W = walkable[0].length, H = walkable.length, key = (p: P) => p.y * W + p.x;
  const g = new Map<number, number>([[key(start), 0]]);
  const cameFrom = new Map<number, number>();
  const open = new MinHeap<P>();                    // any binary heap keyed by f = g + h
  open.push(start, octile(start, goal));
  const closed = new Set<number>();
  while (open.size > 0) {
    const cur = open.pop()!;
    const ck = key(cur);
    if (ck === key(goal)) return rebuildPath(cameFrom, ck, W);
    if (closed.has(ck)) continue;
    closed.add(ck);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const n = { x: cur.x + dx, y: cur.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= W || n.y >= H || !walkable[n.y][n.x]) continue;
      if (dx && dy && (!walkable[cur.y][n.x] || !walkable[n.y][cur.x])) continue;
      const ng = g.get(ck)! + (dx && dy ? Math.SQRT2 : 1);
      const nk = key(n);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        cameFrom.set(nk, ck);
        open.push(n, ng + octile(n, goal));
      }
    }
  }
  return null;                                      // unreachable: caller must handle it
}
```

| Movement | Heuristic |
| :--- | :--- |
| 4-way grid | Manhattan |
| 8-way grid | Octile (above) |
| Any-angle or navmesh | Euclidean |
| Faster but suboptimal | Weighted A* (heuristic times a weight above 1) |

### Arrive steering

```ts
function arrive(pos: Vec2, vel: Vec2, target: Vec2, maxSpeed: number, maxForce: number, slowRadius: number): Vec2 {
  const toTarget = sub(target, pos);
  const dist = length(toTarget);
  if (dist < 1e-4) return clampLength(scale(vel, -1), maxForce);   // brake
  const speed = dist < slowRadius ? maxSpeed * (dist / slowRadius) : maxSpeed;
  return clampLength(sub(scale(toTarget, speed / dist), vel), maxForce);  // apply at the fixed tick
}
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Boolean flag soup for behaviour | Explicit states or tree nodes | Impossible combinations appear |
| Perfect aim and instant reactions | Reaction delays, spread, telegraphs | Feels like cheating, not challenge |
| Every agent pathfinds every frame | Request queue, caching, flow fields | CPU spikes with agent count |
| Raw grid paths with zig-zags | String pulling or funnel smoothing | Agents look robotic |
| Perception by distance check only | Cone plus line-of-sight plus memory | Agents see through walls |
| Unseeded randomness | Seeded streams and decision logs | Bugs cannot be reproduced |

## Verification checklist

- [ ] Each agent type has a written spec with tells and difficulty knobs.
- [ ] The decision model choice is recorded with its reason.
- [ ] Perception uses line of sight and memory, at a throttled rate.
- [ ] Pathfinding handles unreachable goals and stays within its per-frame budget.
- [ ] Crowds pass chokepoints without deadlock.
- [ ] Debug views show state, paths and perception, and bugs replay from seeds.

## Related

- Workflows: `/game-build`, `/tdd`.
- Knowledge: `game-architecture`, `procedural-generation`, `level-design`, `unity`, `unreal-engine`, `godot-engine`, `agent-design-patterns`.
- Agents: `game-engine-specialist`, `performance-optimizer`, `test-engineer`.
