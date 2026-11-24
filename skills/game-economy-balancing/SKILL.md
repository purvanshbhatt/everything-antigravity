---
name: game-economy-balancing
disable-model-invocation: true
description: >-
  Balances game progression and economies: XP and power curves,
  time-to-reward targets, currency faucets and sinks, inflation checks, drop
  rates and pity systems, combat math such as DPS and time-to-kill,
  spreadsheet and Monte Carlo models, telemetry and remote-config tuning, and
  ethical monetization limits. Use when tuning difficulty or rewards,
  designing currencies or loot, or analysing economy telemetry after launch.
---

# Game Economy and Balancing

Balance is a model you can inspect, not a feeling. Write down the target
experience in time units, express every reward and cost as a formula with
named parameters, simulate players before shipping, and tune live numbers
with telemetry one lever at a time. Monetized randomness carries legal and
ethical obligations; treat them as requirements.

## When to use

- Designing XP, levels, gear power, crafting costs or a currency system.
- Players say progression is grindy, too fast, or that rewards feel meaningless.
- Designing loot tables, drop rates, gacha-style pulls or pity timers.
- Reading economy telemetry, or planning a live rebalance.

## When not to use

- Monetization pricing strategy for software products: use `pricing-strategy`.
- Statistical design of A/B tests in depth: use `ab-testing`.
- Spreadsheet mechanics in general: use `spreadsheet-modeling`.
- Level layout and pacing in space: use `level-design`.

## Workflow

1. **State targets in time.** Session length, time to first meaningful reward, time to max level or story completion, and player archetypes (for example casual 20 minutes a day, engaged 2 hours a day). Record the monetization model (premium, cosmetics, ads, randomized items).

   **Check:** Each key milestone has a target time for each archetype.

2. **Map faucets and sinks** for every currency and resource: where it enters (quests, drops, daily rewards, selling) and leaves (upgrades, repairs, consumables, fees, rerolls, cosmetics). Draw the flow and look for conversion loops.

   **Check:** Each currency has at least one sink players want to use repeatedly, and no conversion loop yields a net gain.

3. **Choose curves** from the table below and parameterize them. Pair the XP curve with income growth: exponential costs need exponential income, or progress stalls.

   **Check:** A chart of time per level for each archetype matches the targets within about 10 percent.

4. **Build the model.** One row per level or per hour of play, with columns for required XP, cumulative XP, income, spending, net balance, player power and enemy power. Keep every constant in a named parameter cell; formulas reference names, never literals.

   **Check:** Changing one parameter updates every dependent chart, and no formula contains a hard-coded number.

5. **Simulate randomness.** Run Monte Carlo simulations of drops and progression (script below) and read percentiles, not averages. Add pity (guaranteed by attempt N) or soft pity (rising odds) where bad luck would ruin the experience.

   **Check:** p90 and p99 time to obtain each key item are acceptable, and the worst case is bounded.

6. **Check combat math.** DPS = damage × attacks per second × hit chance × (1 + crit chance × (crit multiplier − 1)); effective HP = HP ÷ (1 − damage reduction); time to kill = effective HP ÷ DPS. Set TTK targets per enemy tier and verify that player and enemy power grow together.

   **Check:** TTK for each tier stays within its target band across the level range.

7. **Instrument telemetry.** Log every currency change with source or sink, amount, balance after and context. Build dashboards for daily net flow, median and p90 balance by cohort, time to level, observed versus designed drop rates, and churn by level (for example from the analytics export in BigQuery).

   **Check:** Observed drop rates match designed rates within statistical noise for a week of data.

8. **Tune live, carefully.** Keep tunables in remote config (for example Firebase Remote Config), change one lever at a time, A/B test large changes with guardrail metrics (retention, sentiment, revenue), and announce balance changes. Never silently reduce the value of purchased items. Get the user's sign-off before shipping changes to live players.

   **Check:** Each change has a hypothesis, a metric, a rollback value and a review date.

9. **Apply monetization limits** (not legal advice; consult qualified counsel for your markets). Disclose odds for paid random items as store policies and several jurisdictions require, follow regional loot-box rules, protect minors, show real-money prices, and avoid dark patterns such as fake scarcity or obscured currency conversion.

   **Check:** A compliance checklist for each target market is signed off before launch.

## Patterns

### Curve shapes

| Curve | Formula | Typical use |
| :--- | :--- | :--- |
| Linear | `xp(n) = a·n` | Short games, steady pacing |
| Polynomial | `xp(n) = a·n^k`, k about 1.5 to 2.5 | Common RPG levelling; gentle slowdown |
| Exponential | `xp(n) = a·r^n`, r about 1.05 to 1.2 | Idle and incremental games with exponential income |
| Logistic (soft cap) | `cap / (1 + e^(−k(n − n0)))` | Power that plateaus, keeping late game compressible |

### Probability facts worth remembering

| Question | Formula | Example (p = 1 percent) |
| :--- | :--- | :--- |
| Chance of at least one success in n tries | `1 − (1 − p)^n` | 100 tries gives about 63 percent |
| Expected tries to first success | `1 / p` | 100 |
| Tries for a 90 percent chance | `ln(0.1) / ln(1 − p)` | about 230 |

### Monte Carlo drop simulation (Python)

```python
"""Simulate tries needed to obtain a rare drop with a hard pity cap."""
import random
import statistics


def tries_until_drop(p: float, pity: int, rng: random.Random) -> int:
    """Return the attempt number on which the drop is obtained."""
    for attempt in range(1, pity + 1):
        if rng.random() < p:
            return attempt
    return pity


def percentile(sorted_values: list[int], q: float) -> int:
    """Nearest-rank percentile of an already sorted list."""
    return sorted_values[int(q * (len(sorted_values) - 1))]


def simulate(p: float = 0.01, pity: int = 150, players: int = 100_000, seed: int = 7) -> None:
    """Print summary statistics for a simulated player population."""
    rng = random.Random(seed)
    runs = sorted(tries_until_drop(p, pity, rng) for _ in range(players))
    print(f"mean={statistics.mean(runs):.1f} p50={percentile(runs, 0.5)} "
          f"p90={percentile(runs, 0.9)} p99={percentile(runs, 0.99)}")


if __name__ == "__main__":
    simulate()
```

### Currency telemetry event

```json
{ "event": "currency_change", "currency": "gold", "delta": -250, "balance_after": 1180,
  "kind": "sink", "reason": "upgrade_weapon", "level": 14, "session": "<uuid>", "build": "1.3.0" }
```

### Inflation check

If the median balance of active players grows faster than the price of the most useful repeatable sink, currency is losing meaning: add sinks, scale costs, or reduce faucets.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Tune by feel in the editor | Model, simulate, then playtest | Feel does not scale to 50 levels and 5 archetypes |
| Read averages of random outcomes | Percentiles and worst cases | Averages hide the unlucky players who quit |
| Faucets without matching sinks | Repeatable, desirable sinks | Inflation makes rewards meaningless |
| Change several levers at once live | One lever per change, with a metric | You cannot tell what worked |
| Hide odds or real prices | Disclose odds and show real-money cost | Store rejections, legal risk and lost trust |
| Nerf purchased items silently | Announce, compensate, or grandfather | Players treat it as a broken promise |

## Verification checklist

- [ ] Targets are written in time units per archetype.
- [ ] Every currency's faucets and sinks are mapped, with no profitable loops.
- [ ] The model uses named parameters, and charts match targets.
- [ ] Random rewards were simulated; p90 and p99 are acceptable and bounded by pity.
- [ ] Telemetry logs every currency change, and dashboards exist.
- [ ] Monetization was checked against store policies and counsel's market checklist.

## Related

- Workflows: `/game-build`.
- Knowledge: `level-design`, `game-architecture`, `spreadsheet-modeling`, `product-analytics`, `ab-testing`, `bigquery`, `pricing-strategy`.
- Agents: `data-analyst`, `product-manager`, `game-engine-specialist`.
