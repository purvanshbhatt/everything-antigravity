---
name: redis-caching
disable-model-invocation: true
description: >-
  Uses Redis, Valkey or Memorystore correctly: cache-aside with jittered TTLs,
  key design and versioning, eviction policies, stampede protection, rate
  limiting with Lua, distributed locks and their limits, Streams with consumer
  groups, persistence and HA, memory sizing and safe diagnostics. Use when
  adding a cache, choosing maxmemory-policy, building a rate limiter or lock,
  or debugging hot keys, memory spikes, evictions or latency.
---

# Redis Caching and Coordination

Redis is fast enough to hide design mistakes until they become outages: a
cache with no invalidation plan, a queue on an instance that evicts keys, a
lock that two workers both hold, or a `KEYS *` that freezes production. Decide
what each instance is for, then apply the matching pattern and safeguards.
Everything here applies equally to Valkey and Memorystore.

## When to use

- Adding a read cache, session store, rate limiter, lock, leaderboard or lightweight queue.
- Choosing an eviction policy, sizing memory, or picking Memorystore tiers.
- Stale reads after writes, cache stampedes on hot keys, memory growth, latency spikes, evicted keys you needed.

## When not to use

- Deciding whether to cache at all, or HTTP and CDN caching: use `backend-patterns` and `cdn-edge-cloudflare`.
- Durable job queues with retries and visibility: use `background-jobs`.
- Pub/Sub fan-out for sockets: use `realtime-websockets` (it uses Redis, with a different focus).
- System of record data: use a database (`database-design`).

## Workflow

1. **Decide each instance's job.** Caches tolerate eviction; queues, locks, sessions and rate-limit counters do not. Use separate instances (or at least separate eviction policies): caches get `allkeys-lfu` or `allkeys-lru`; everything else gets `noeviction` plus alerts on memory. Open-source Redis defaults to `noeviction`; check your managed service's default.

   **Check:** `CONFIG GET maxmemory-policy` (or the Memorystore setting) matches the instance's job.

2. **Design keys.** Namespaced and versioned: `app:v3:profile:{user42}`. Bump the version segment when the cached shape changes instead of flushing. Keep values small (kilobytes, not megabytes) and collections bounded. In Redis Cluster, keys used together in multi-key commands or Lua scripts need the same hash tag (`{user42}`) so they land in one slot.

   **Check:** `redis-cli --bigkeys` on a staging copy shows no unbounded or multi-megabyte keys.

3. **Implement cache-aside with invalidation after commit.** Read cache, on miss load from the database and set with a TTL plus 10-20% jitter. On write, commit to the database first, then delete the key (do not update it). Cache negative results briefly. Treat Redis errors as misses so a cache outage degrades to database reads.

   **Check:** A write followed by a read returns fresh data in a test, and stopping Redis in staging slows requests without failing them.

4. **Prevent stampedes on hot keys.** Coalesce concurrent misses (singleflight in-process, or a short `SET lock:key token NX PX 5000` so one caller rebuilds while others serve stale or wait), and refresh hot keys early (probabilistic early expiration).

   **Check:** Expiring a hot key under load causes one rebuild, not hundreds of database queries.

5. **Configure clients defensively.** Connection pooling, short connect and command timeouts, limited retries, pipelining for batches. Avoid blocking commands on production: `KEYS` (use `SCAN`), `DEL` on huge keys (use `UNLINK`), `SMEMBERS` or `HGETALL` on large collections (use `SSCAN` and `HSCAN`).

   **Check:** `grep_search` finds no `KEYS` calls in application code, and every client has explicit timeouts.

6. **Rate limit atomically.** Use a Lua script or `MULTI` so increment and expiry cannot be split (fixed window below; sorted-set sliding windows or token buckets for smoother limits). Key by the identity you are limiting (API key, user, IP) and return `429` with `Retry-After`.

   **Check:** A concurrent burst test never admits more than the limit per window.

7. **Use locks only for efficiency, not correctness.** `SET lock:job:42 <random-token> NX PX 30000`, release with a compare-and-delete script, and keep the critical section well under the TTL. A paused process can outlive its lock, so anything that must never run twice also needs a fencing token or a database constraint.

   **Check:** The protected write path is safe even if two holders overlap (unique constraint, version check or idempotency key).

8. **Use Streams for lightweight queues.** `XADD` with `MAXLEN ~` trimming, consumer groups (`XGROUP CREATE ... MKSTREAM`, `XREADGROUP`, `XACK`), and `XAUTOCLAIM` to recover messages from dead consumers. Monitor `XPENDING`. For retries, scheduling and DLQs, prefer a real job system.

   **Check:** A consumer killed mid-message has its entries reclaimed by another consumer.

9. **Choose persistence and HA to match the job.** Pure caches can run without persistence. Anything else: AOF with `appendfsync everysec` (or the managed equivalent), replicas with automatic failover (Sentinel, Cluster, Memorystore HA tiers), and tested restores. Note licensing: Redis changed licences in 2024 and added an AGPL option in 2025; Valkey is the BSD-licensed fork. Verify current terms before choosing.

   **Check:** A failover drill in staging completes within the client timeout and retry budget.

10. **Operate safely.** Diagnose with `INFO memory`, `INFO stats` (`evicted_keys`, `keyspace_misses`), `SLOWLOG GET 20`, `LATENCY DOCTOR`, `MEMORY USAGE <key>` and `redis-cli --hotkeys` (needs an LFU policy). `FLUSHALL`, `FLUSHDB`, mass deletes and config changes on shared instances require explicit user confirmation.

    **Check:** Dashboards show hit ratio, memory, evictions, connected clients and p99 command latency.

## Patterns

### Cache-aside (Python)

```python
import json, random
import redis

r = redis.Redis(host="localhost", port=6379, socket_timeout=0.2, socket_connect_timeout=0.2)

def get_profile(user_id: str) -> dict:
    key = f"app:v3:profile:{{{user_id}}}"
    try:
        if (hit := r.get(key)) is not None:
            return json.loads(hit)
    except redis.RedisError:
        pass                                     # cache down: fall through to the database
    profile = load_profile_from_db(user_id)
    try:
        r.set(key, json.dumps(profile), ex=int(300 * random.uniform(0.9, 1.1)))
    except redis.RedisError:
        pass
    return profile

def update_profile(user_id: str, changes: dict) -> None:
    save_profile_to_db(user_id, changes)        # commit first
    r.delete(f"app:v3:profile:{{{user_id}}}")    # then invalidate
```

### Atomic scripts (Lua)

```lua
-- Fixed-window rate limit: KEYS[1]=counter key, ARGV[1]=window seconds. Returns the count.
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n

-- Lock release: delete only if we still own it. KEYS[1]=lock key, ARGV[1]=owner token.
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end
```

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Queue or locks on an `allkeys-lru` instance | Separate `noeviction` instance | Jobs and locks vanish under memory pressure |
| Update the cache on write | Delete after the database commit | Racing writers leave stale values |
| Identical TTLs for a batch of keys | TTL plus jitter | Synchronized expiry stampedes the database |
| `KEYS pattern` in production | `SCAN` with `MATCH` and `COUNT` | `KEYS` blocks the single-threaded server |
| `DEL` a key with millions of members | `UNLINK` | Synchronous free blocks other clients |
| Lock without token and compare-and-delete | Random token, scripted release | One worker deletes another's lock |
| Lock as the only guard for money or inventory | Database constraint or fencing token | GC pauses and failovers break mutual exclusion |

## Verification checklist

- [ ] Each instance has a documented job and a matching eviction policy.
- [ ] Keys are namespaced and versioned; no big or unbounded keys.
- [ ] Invalidation happens after commit; Redis outage degrades to database reads.
- [ ] Hot keys have stampede protection; TTLs are jittered.
- [ ] Rate limits and lock releases are atomic scripts; correctness does not rely on locks alone.
- [ ] Persistence, HA and failover are tested where data is not disposable.

## Related

- Knowledge: `backend-patterns`, `database-design`, `background-jobs`, `realtime-websockets`, `api-security`, `observability-otel`, `cdn-edge-cloudflare`.
- Agents: `performance-optimizer`, `database-architect`, `backend-engineer`.
