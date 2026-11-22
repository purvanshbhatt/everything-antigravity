---
name: multiplayer-networking
description: >-
  Designs multiplayer game networking: choosing client, host, dedicated-server,
  lockstep or rollback authority, tick and snapshot rates, client-side
  prediction with reconciliation, entity interpolation, lag compensation,
  bandwidth and interest management, netcode libraries, matchmaking and
  ratings, server hosting, cheat resistance, and testing under latency and
  loss. Use when adding online play or fixing desync, rubber-banding or hit
  registration.
---

# Multiplayer Networking

Pick the authority model first, because it decides cheating, cost and feel.
Then hide latency: predict the local player, interpolate everyone else,
rewind time for hit checks, and send only what each client needs. Test with
bad networks from the first prototype, not the week before launch.

## When to use

- Adding online multiplayer to a game, or choosing a netcode library or backend.
- Players report rubber-banding, teleporting enemies, "I shot first" complaints or desyncs.
- Bandwidth or server costs are too high, or matchmaking produces lopsided games.

## When not to use

- Generic realtime web apps (chat, presence): use `realtime-websockets`.
- Engine-specific replication APIs: see `unreal-engine`, `unity` or `godot-engine`, then come back for the model.
- Deterministic simulation and fixed timestep basics: use `game-architecture`.
- Server infrastructure in general: use `kubernetes-gke` and `cloud-devops`.

## Workflow

1. **Write the requirements.** Genre, players per match, competitive or co-op, acceptable latency, platforms and cross-play, persistence, and the hosting budget. Put them in an implementation plan artifact.

   **Check:** The plan states players per match, target RTT range, and whether cheating matters.

2. **Choose the authority model** with the matrix below. Competitive action games need a server-authoritative design; deterministic lockstep or rollback needs a deterministic simulation (seeded RNG, fixed step, stable iteration order, care with floats across platforms).

   **Check:** The chosen model and its rejected alternatives are recorded with reasons.

3. **Pick transport and library.** UDP with a reliability layer for action games; WebSocket (TCP) or WebRTC data channels in browsers, or WebTransport where supported. Prefer the engine's maintained netcode before writing your own (table below; verify maintenance and licences).

   **Check:** A two-client prototype connects through the chosen stack over the internet, not only localhost.

4. **Define ticks and messages.** Server simulation tick (for example 30 to 60 Hz for shooters, 10 to 20 Hz for slower games), snapshot send rate, and input messages that carry a sequence number and repeat recent unacknowledged inputs to survive loss. Include a protocol version in the handshake.

   **Check:** Estimated bandwidth per client (snapshot bytes times rate, plus inputs) fits the plan's budget.

5. **Predict and reconcile the local player** (pattern below), running the same movement code on client and server.

   **Check:** At 150 ms RTT, local movement feels immediate, and corrections are small and smoothed.

6. **Interpolate remote entities.** Render them at server time minus an interpolation delay of about two snapshot intervals, blending between buffered snapshots; extrapolate only briefly when packets are late, and snap when the error is large.

   **Check:** Remote players move smoothly with 20 ms of jitter and 2 percent loss.

7. **Compensate lag for hits.** The server keeps a short history of hitboxes, rewinds to the shooter's view time (now minus half RTT minus interpolation delay), tests the hit, then restores. Cap the rewind window (for example 200 to 250 ms) to limit "shot behind cover" complaints.

   **Check:** A test with a scripted 120 ms client registers hits on what that client saw.

8. **Cut bandwidth.** Quantize positions and angles, delta-compress against the last acknowledged snapshot, send only relevant entities (interest management by distance, visibility or team), and prioritize important ones.

   **Check:** Per-client bandwidth under the worst scene in the plan stays under budget.

9. **Resist cheating.** Never trust the client for damage, position, currency or cooldowns; validate inputs for rate and range; issue session tokens from your backend; encrypt transport; rate-limit and protect servers from floods. Delegate a review of the protocol and handlers to the `security-guard` subagent.

   **Check:** A modified client sending impossible inputs is rejected or corrected by the server.

10. **Match and host.** Ratings: Elo for simple 1v1, Glicko-2 to model uncertainty, a team-capable system (for example OpenSkill) for team games. Widen skill and region windows over time in the queue, handle parties, and backfill. Host dedicated servers with Agones on GKE or a managed game-server service; Open Match or a backend such as Nakama can provide matchmaking (verify each project's status).

    **Check:** Simulated queues produce matches within the target wait time and rating spread.

11. **Test under bad networks** continuously: clumsy on Windows, `tc netem` on Linux, Network Link Conditioner on macOS, or the engine's packet-lag simulation. Use bots for load tests, and per-tick state checksums to detect desync in lockstep or rollback.

    **Check:** The game stays playable at 150 ms RTT, 20 ms jitter and 2 percent loss, and a load test reaches the target player count.

## Patterns

### Authority models

| Model | Best for | Cheat resistance | Main cost |
| :--- | :--- | :--- | :--- |
| Client-authoritative | Co-op prototypes among friends | None | Trust |
| Listen server (host) | Small co-op and party games | Host can cheat | Host migration, host's upload |
| Dedicated server-authoritative | Competitive action, shooters, persistent worlds | High | Server fleet cost and ops |
| Deterministic lockstep | RTS and large unit counts with small inputs | High for state; map hacks still possible | Strict determinism; input delay |
| Rollback (GGPO style) | Fighting games, small peer-to-peer matches | Medium | Determinism plus fast state save and restore |

### Prediction and reconciliation (TypeScript)

```ts
interface Input { seq: number; dx: number; dy: number; jump: boolean }
const pending: Input[] = [];
let seq = 0;

function clientFixedTick(raw: Omit<Input, 'seq'>): void {
  const input: Input = { ...raw, seq: ++seq };
  pending.push(input);
  net.sendInputs(pending.slice(-3));              // redundancy against packet loss
  applyInput(localPlayer, input, FIXED_DT);       // same function the server runs
}

function onSnapshot(s: { lastProcessedSeq: number; you: PlayerState }): void {
  const before = { ...localPlayer };
  Object.assign(localPlayer, s.you);              // accept authority
  while (pending.length && pending[0].seq <= s.lastProcessedSeq) pending.shift();
  for (const input of pending) applyInput(localPlayer, input, FIXED_DT);   // replay
  visualOffset.add(before, localPlayer);          // blend small errors out over ~100 ms
}
```

### Libraries by engine (verify maintenance and licence)

| Stack | Options |
| :--- | :--- |
| Unity | Netcode for GameObjects, Netcode for Entities, Mirror, FishNet, Photon Fusion |
| Unreal | Built-in actor replication and RPCs; Iris replication system |
| Godot | High-level multiplayer API (`MultiplayerSpawner`, `MultiplayerSynchronizer`), ENet, WebRTC |
| Web and Node | Colyseus, custom WebSocket or WebTransport, geckos.io (WebRTC) |
| Rollback | GGPO, GGRS (Rust) |
| Backend and hosting | Agones on GKE, Nakama, managed game-server providers |

### Linux network emulation (test machines only)

```bash
sudo tc qdisc add dev eth0 root netem delay 100ms 20ms loss 2%
sudo tc qdisc del dev eth0 root        # always remove afterwards
```

This affects all traffic on the interface; confirm with the user before running it on any shared machine.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Trust client-reported hits, positions or currency | Server validates and simulates | Trivial cheats otherwise |
| Different movement code on client and server | One shared, deterministic step function | Constant mispredictions and rubber-banding |
| Render remote players at the latest packet | Buffer and interpolate | Jitter turns into teleporting |
| Send full state to everyone every tick | Delta compression and interest management | Bandwidth and server cost explode |
| Test only on LAN | Emulate latency, jitter and loss from day one | Netcode problems appear late and are expensive |
| Float math across platforms in lockstep | Fixed-point or strictly controlled floats | Desync after minutes of play |

## Verification checklist

- [ ] Authority model, tick rate and bandwidth budget are recorded with reasons.
- [ ] Local player is predicted and reconciled with shared movement code.
- [ ] Remote entities are interpolated, and hits use capped lag compensation.
- [ ] The server rejects impossible inputs, and sessions are authenticated.
- [ ] Playable at 150 ms RTT, 20 ms jitter and 2 percent loss; load test passes.
- [ ] Matchmaking meets wait-time and fairness targets in simulation.

## Related

- Workflows: `/game-build`, `/security-scan`, `/verify`.
- Knowledge: `game-architecture`, `unity`, `unreal-engine`, `godot-engine`, `realtime-websockets`, `kubernetes-gke`, `load-testing`.
- Agents: `game-engine-specialist`, `security-guard`, `backend-engineer`, `sre-engineer`.
