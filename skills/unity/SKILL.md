---
name: unity
description: >-
  Builds Unity games in C#: small composable MonoBehaviours, ScriptableObject
  data and event channels, prefabs and variants, the Input System package,
  object pooling, Profiler and Memory Profiler investigations, Unity Test
  Framework, version-control settings, and batch-mode command-line builds and
  tests for CI. Use when structuring a Unity project, chasing GC spikes or
  frame drops, or automating Unity builds and tests.
---

# Unity

Keep gameplay logic in small components and plain C# classes, keep tunable
data in assets, allocate nothing per frame in gameplay, and make every build
reproducible from the command line. Most Unity projects degrade through
hidden coupling (`Find`, singletons, scene references) and per-frame garbage.

## When to use

- Starting a Unity project or reorganizing one that has become hard to change.
- Designing data with ScriptableObjects, or prefabs with variants and Addressables.
- Adding gamepad and keyboard support with rebinding through the Input System.
- GC spikes, frame drops or memory growth; setting up CI builds and tests.

## When not to use

- Engine-agnostic loop, state machine and save design: use `game-architecture`.
- Godot or Unreal projects: use `godot-engine` or `unreal-engine`.
- Shader code: use `shaders-glsl`. Enemy behaviour and pathfinding: use `game-ai`. Menus and HUD: use `game-ui`.

## Workflow

1. **Set up project hygiene.** Visible meta files and Force Text serialization (check the defaults in your Editor version), a `.gitignore` excluding `Library/`, `Temp/`, `Obj/`, `Logs/`, `UserSettings/` and build output, Git LFS for large binaries, and UnityYAMLMerge configured as the merge tool for scenes and prefabs. Pin the Editor version (`ProjectSettings/ProjectVersion.txt`). Split code into assembly definitions per feature.

   **Check:** A fresh clone opens without missing references, and editing one feature recompiles only its assembly.

2. **Compose small components.** One responsibility per `MonoBehaviour`; `[SerializeField] private` fields instead of public ones; cache components in `Awake`; never call `GameObject.Find` or `FindObjectOfType`-style searches per frame; communicate through C# events, interfaces or ScriptableObject channels. Movement uses `Time.deltaTime` in `Update`, physics runs in `FixedUpdate`.

   **Check:** `grep_search` finds no `Find`, `SendMessage` or `GetComponent` calls inside `Update`, `FixedUpdate` or `LateUpdate`.

3. **Put data in ScriptableObjects.** Weapon stats, enemy archetypes, level configs, event channels and runtime sets. Changes made in Play Mode in the Editor are written to the asset; builds reset them. Clone with `Instantiate(asset)` when you need mutable runtime state.

   **Check:** Designers can tune values without touching code, and no runtime state leaks between Play Mode sessions.

4. **Keep prefabs self-contained.** Nested prefabs and variants for families of objects; no references from prefabs into scenes; Addressables for content loaded on demand, releasing every handle you load.

   **Check:** Each prefab works when dropped into an empty test scene.

5. **Use the Input System package.** An Input Actions asset with separate action maps (Gameplay, UI), `PlayerInput` or the generated C# class, rebinding with `PerformInteractiveRebinding`, and persistence with `SaveBindingOverridesAsJson` and `LoadBindingOverridesFromJson`.

   **Check:** Keyboard and gamepad both drive gameplay and UI, and a rebind survives a restart.

6. **Pool what spawns often** (bullets, effects, damage numbers) with `UnityEngine.Pool.ObjectPool<T>` (pattern below). Avoid LINQ, string concatenation, boxing and new collections in per-frame code.

   **Check:** The Profiler's GC Alloc column reads 0 B per frame during steady gameplay.

7. **Profile on the target device.** Development Build with Autoconnect Profiler; CPU module and Timeline for spikes; Deep Profile only for short, targeted captures; Memory Profiler snapshots compared before and after a level; Frame Debugger for draw calls. Wrap hot code in `ProfilerMarker` scopes.

   **Check:** p95 frame time meets the budget on minimum-spec hardware, with captures saved in the walkthrough artifact.

8. **Test logic outside scenes.** Put rules in plain C# classes and test them in EditMode; use PlayMode tests for integration. If Enter Play Mode Options disable domain reload, reset static state with `[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]`.

   **Check:** EditMode tests run in seconds from the command line.

9. **Build and test from the command line** (patterns below). The Editor path differs by OS (for example `C:\Program Files\Unity\Hub\Editor\<version>\Editor\Unity.exe` on Windows). Headless CI needs a valid license activation; check current licensing terms for CI.

   **Check:** CI produces a player build and a test results XML without opening the Editor UI.

## Patterns

### Pooled projectiles

```csharp
using UnityEngine;
using UnityEngine.Pool;

public sealed class BulletSpawner : MonoBehaviour
{
    [SerializeField] private Bullet prefab;
    private ObjectPool<Bullet> pool;

    private void Awake()
    {
        pool = new ObjectPool<Bullet>(
            createFunc: () => { var b = Instantiate(prefab); b.Init(pool); return b; },
            actionOnGet: b => b.gameObject.SetActive(true),
            actionOnRelease: b => b.gameObject.SetActive(false),
            actionOnDestroy: b => Destroy(b.gameObject),
            collectionCheck: false, defaultCapacity: 64, maxSize: 256);
    }

    public void Fire(Vector3 position, Vector3 direction)
    {
        var bullet = pool.Get();
        bullet.transform.SetPositionAndRotation(position, Quaternion.LookRotation(direction));
    }
}
// Bullet calls pool.Release(this) on hit or timeout instead of Destroy(gameObject).
```

### Command-line build and tests

```csharp
// Assets/Editor/Builds.cs
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;

public static class Builds
{
    public static void BuildWindows()
    {
        var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
        {
            scenes = EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray(),
            locationPathName = "Build/Windows/Game.exe",
            target = BuildTarget.StandaloneWindows64,
            options = BuildOptions.None,
        });
        if (report.summary.result != BuildResult.Succeeded) EditorApplication.Exit(1);
    }
}
```

```bash
Unity -batchmode -nographics -quit -projectPath . -buildTarget StandaloneWindows64 \
  -executeMethod Builds.BuildWindows -logFile build.log
Unity -batchmode -nographics -projectPath . -runTests -testPlatform EditMode \
  -testResults results/editmode.xml -logFile tests.log     # no -quit with -runTests
```

### Where things belong

| Concern | Put it in |
| :--- | :--- |
| Rules, math, state machines | Plain C# classes with EditMode tests |
| Scene wiring and engine callbacks | Thin `MonoBehaviour` components |
| Tunable data, archetypes, channels | ScriptableObject assets |
| Reusable objects | Prefabs and variants; Addressables for streaming |
| Global services | A small bootstrap scene or explicit composition root, not scattered singletons |

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| `Find` or `GetComponent` every frame | Cache in `Awake` or inject references | Lookups cost time and hide dependencies |
| Public fields everywhere | `[SerializeField] private` plus properties | Anything can mutate state |
| Store runtime state in ScriptableObject assets | Instantiate a runtime copy | Editor sessions leak state into the asset |
| `Instantiate` and `Destroy` per shot | `ObjectPool<T>` | Allocation churn causes GC spikes |
| Everything in a `Resources` folder | Addressables | `Resources` content is always in the build and hard to unload |
| Deep Profile for every capture | Normal profiling plus `ProfilerMarker` | Deep Profile distorts timings heavily |
| Build only through the Editor menu | `-executeMethod` build script in CI | Manual builds are not reproducible |

## Verification checklist

- [ ] Meta files, text serialization, LFS and merge tooling are configured; Editor version is pinned.
- [ ] No per-frame `Find`, `GetComponent` or allocations in gameplay code.
- [ ] Tunable data lives in ScriptableObjects without runtime state leaking into assets.
- [ ] Input works on keyboard and gamepad, and rebinds persist.
- [ ] Frame time was profiled on target hardware and meets the budget.
- [ ] EditMode tests and player builds run headless in CI.

## Related

- Workflows: `/game-build`, `/tdd`, `/verify`.
- Knowledge: `game-architecture`, `game-ai`, `game-ui`, `shaders-glsl`, `multiplayer-networking`, `csharp-dotnet`, `game-publishing`.
- Agents: `game-engine-specialist`, `csharp-reviewer`, `performance-optimizer`.
