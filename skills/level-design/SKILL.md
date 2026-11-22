---
name: level-design
description: >-
  Plans and iterates game levels: level briefs, player metrics gyms, beat
  charts and intensity curves, bubble diagrams, greybox blockouts, spatial
  guidance with landmarks, sightlines and lighting, teaching mechanics before
  testing them, difficulty curves and checkpoint spacing, and playtesting with
  observation and telemetry heatmaps. Use when designing, blocking out or
  fixing a level that confuses players or feels flat, unfair or too long.
---

# Level Design

A level is a sequence of decisions and feelings delivered through space.
Decide what the level is for, build it from the character's real metrics in
untextured greybox, guide players with the environment instead of arrows, and
let observed playtests, not opinions, drive every iteration. Art comes last.

## When to use

- Designing a new level, area, arena or puzzle room, from brief to blockout.
- Players get lost, miss the critical path, or quit at a particular spot.
- Pacing feels flat, difficulty spikes, or checkpoints feel punishing.
- Setting up a playtest and telemetry to evaluate levels.

## When not to use

- Generating levels algorithmically: use `procedural-generation` (then use this skill to judge the output).
- Tile and map implementation in a specific engine: use `phaser`, `godot-engine`, `unity` or `unreal-engine`.
- Enemy behaviour inside the level: use `game-ai`. Reward and progression numbers: use `game-economy-balancing`.

## Workflow

1. **Write a one-page level brief.** Purpose in the game (introduce a mechanic, test mastery, climax, breather), abilities the player has, target play time, narrative beat, 3 to 5 key moments, and constraints (art budget, streaming, platform). Store it next to the level files.

   **Check:** Someone else can read the brief and say what the player should learn or feel.

2. **Build a metrics gym.** A test map with the character's real numbers: jump heights and gaps (comfortable, maximum, impossible), cover heights, door and corridor widths, step and slope limits, interaction ranges and camera clearances. Record them in a table.

   **Check:** Every traversal gap and cover piece in the level uses a value from the gym table.

3. **Chart the beats.** List beats in order (explore, combat, puzzle, rest, set piece, reward) and give each an intensity from 1 to 10. Aim for rising peaks with release after each, a breather before major fights, and no long flat stretches.

   **Check:** The intensity chart has a clear climax and no run of more than a few minutes at the same intensity, unless intended.

4. **Draw the bubble diagram.** Spaces as nodes and connections as edges; mark the critical path, optional branches, gates (lock and key), loops and shortcuts back to hubs or checkpoints, and where the goal is visible.

   **Check:** The critical path is unambiguous, and every dead end gives a reward or a shortcut back.

5. **Block out in greybox.** Engine primitives or tools (ProBuilder, Unreal modeling tools, Godot CSG or GridMap, TrenchBroom, Tiled or LDtk for 2D). One or two colours with a consistent language (for example, one colour always means climbable). Place enemies, pickups and triggers early: layout without gameplay tells you nothing.

   **Check:** A tester completes the level start to finish without verbal help, within about 25 percent of the target time.

6. **Guide with space.** Landmarks visible from several points, leading lines (paths, cables, ledges), light and colour pointing to the way forward, framing doorways, breadcrumbs (pickups along the route), audio cues, and diegetic boundaries instead of invisible walls.

   **Check:** In at least four of five first-time playtests, players take the intended route without backtracking confusion.

7. **Teach, then test.** Introduce each mechanic where failure is cheap, develop it with mild risk, twist it by combining with another mechanic or constraint, then ask for mastery. Never debut a mechanic in a high-stakes moment.

   **Check:** Each new mechanic has a safe introduction before its first lethal use.

8. **Tune difficulty and checkpoints.** Use a sawtooth across levels (spike, then easier new content), place checkpoints so a failure costs a short replay, avoid unskippable sequences before hard fights, offer optional harder routes for skilled players, and provide assist options.

   **Check:** The death heatmap has no unintended spike, and median retries per section fit the brief.

9. **Playtest and iterate.** Observe silently, ask for think-aloud, record video and input, and ask afterwards where players felt lost, bored or cheated. Use fresh testers each round. Log telemetry (schema below) to build heatmaps of deaths, routes and quits. Fix by frequency times severity, then begin the art pass only once the layout is locked.

   **Check:** Each round's top three issues are fixed and re-tested before new content is added.

## Patterns

### Guidance tools

| Tool | Use it to | Watch out for |
| :--- | :--- | :--- |
| Landmark | Orient players across a large space | Must be visible from the places players get lost |
| Light and colour | Pull the eye toward the path | Keep the colour language consistent all game |
| Leading lines | Point along routes and to goals | Lines that lead into walls teach distrust |
| Framing and composition | Present a vista or a threat deliberately | Over-framing feels like a corridor |
| Gating | Pace exploration (lock and key, ability gates) | Show the locked door before the key |
| Sound | Draw attention off-screen | Needs subtitles or visual equivalents for accessibility |

### Playtest questions

- Where did you feel lost, and what did you expect to find there?
- What was the hardest moment? Did it feel fair?
- When did you feel bored or rushed?
- What did you think the goal was when you entered this area?

### Telemetry event

```json
{ "event": "player_death", "level": "L03", "section": "B2", "pos": [12.5, 0.0, -4.1],
  "cause": "fall", "t_level_s": 431.2, "attempt": 3, "build": "0.4.1", "session": "<uuid>" }
```

Also log section enter and exit, checkpoint reached, item collected and quit-to-menu events with the same keys, then aggregate positions into grid-cell heatmaps.

### Originality

Design original layouts. Study genres and principles, not specific commercial maps, and never rebuild a recognizable level from an existing game.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Detail and light a level before it plays well | Greybox until the layout is locked | Art makes layout changes expensive, so problems ship |
| Build from guesses about jump distance | Metrics gym with real controller values | Gaps end up impossible or trivial |
| Guide with arrows and text only | Landmarks, light, lines and sound | Players read space faster than instructions |
| Explain in playtests | Observe silently, ask afterwards | Help hides the problems real players will hit |
| Test with the team only | Fresh testers each round | The team already knows the route |
| Invisible walls | Diegetic boundaries | They break trust and immersion |

## Verification checklist

- [ ] A level brief states purpose, abilities, target time and key moments.
- [ ] Geometry uses gym metrics; the beat chart and bubble diagram exist.
- [ ] Each mechanic is introduced safely before it is tested.
- [ ] First-time testers follow the critical path without help in most sessions.
- [ ] Death and route heatmaps show no unintended spikes or dead zones.
- [ ] The art pass started only after the layout was locked.

## Related

- Workflows: `/game-build`, `/verify`.
- Knowledge: `game-architecture`, `procedural-generation`, `game-ai`, `game-economy-balancing`, `game-ui`, `product-analytics`, `ux-research`.
- Agents: `game-engine-specialist`, `data-analyst`, `ux-designer`.
