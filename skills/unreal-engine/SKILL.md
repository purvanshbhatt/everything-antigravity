---
name: unreal-engine
disable-model-invocation: true
description: >-
  Builds Unreal Engine 5 games: splitting work between C++ and Blueprints, the
  gameplay framework (GameMode, GameState, PlayerController, Pawn, PlayerState,
  subsystems), UPROPERTY and garbage-collection rules, Enhanced Input, a
  Gameplay Ability System overview, profiling with stat commands and Unreal
  Insights, and packaging with BuildCookRun. Use when structuring an Unreal
  project, exposing C++ to designers, or packaging builds.
---

# Unreal Engine

Use C++ for systems, base classes and anything performance- or
network-critical; use Blueprints for content, tuning and designer iteration.
Put each piece of state in the gameplay-framework class that owns it, keep
every `UObject` reference visible to the garbage collector, and package
Shipping builds from the command line.

## When to use

- Starting an Unreal 5 project, or untangling one where Blueprints and C++ fight.
- Deciding where game rules, player state and UI logic belong.
- Adding Enhanced Input, abilities, or exposing C++ to designers.
- Profiling hitches, or packaging and automating builds.

## When not to use

- Engine-agnostic loop, state and save design: use `game-architecture`.
- Unity or Godot projects: use `unity` or `godot-engine`.
- Replication strategy, prediction and lag compensation: use `multiplayer-networking`.
- Modern C++ language questions: use `cpp-modern`.

## Workflow

1. **Set up the project and source control.** Create a C++ project (Blueprint-only projects can add C++ later). Use Perforce or Git with LFS; ignore `Binaries/`, `Intermediate/`, `Saved/` and `DerivedDataCache/`. Enable One File Per Actor for World Partition levels so people do not lock whole maps. Regenerate IDE files from the `.uproject` context menu or `GenerateProjectFiles.bat`.

   **Check:** A fresh clone builds the editor target and opens the default map.

2. **Draw the C++ / Blueprint line** using the table below, and record it in the implementation plan artifact.

   **Check:** Every gameplay system has one owner language, and Blueprints never reimplement C++ logic.

3. **Place state by framework role** (table below). Rules live in GameMode (server only); replicated match state in GameState; per-player persistent data in PlayerState; input and UI ownership in PlayerController; the body in Pawn or Character. Cross-level services go in `UGameInstanceSubsystem`, per-world services in `UWorldSubsystem`.

   **Check:** No client-side code reads GameMode, and nothing that must survive respawn lives on the Pawn.

4. **Expose C++ cleanly.** Abstract base classes with `UPROPERTY(EditDefaultsOnly)` tunables, `BlueprintCallable` functions and `BlueprintImplementableEvent` hooks for VFX and audio. Bind Enhanced Input actions in C++, and add Input Mapping Contexts through `UEnhancedInputLocalPlayerSubsystem` in the PlayerController.

   **Check:** Designers can create a Blueprint child, tune it and add effects without editing C++.

5. **Respect the garbage collector.** Hold `UObject` pointers in `UPROPERTY()` members (`TObjectPtr<>` in UE5), use `TWeakObjectPtr` for non-owning references, create objects with `NewObject<T>` and actors with `SpawnActor`, and check `IsValid()` before use. Use soft references (`TSoftObjectPtr`) for heavy assets to avoid loading them with every cast.

   **Check:** `grep_search` finds no raw `UObject*` members without `UPROPERTY`, and the size map of the main Blueprints shows no accidental hard references to whole asset sets.

6. **Adopt GAS only when it pays.** The Gameplay Ability System (AbilitySystemComponent, GameplayAbility, GameplayEffect, AttributeSet, GameplayTags, GameplayCues) suits games with many abilities, cooldowns, buffs and networked prediction. For a handful of actions, plain components are simpler. Put the AbilitySystemComponent on PlayerState when abilities must survive respawn.

   **Check:** The plan records why GAS was or was not chosen.

7. **Profile in a packaged Development or Test build**, not in the editor. Use `stat unit` (Game, Draw, GPU, RHI thread), `stat fps`, `stat game` and `stat gpu`, then capture with Unreal Insights (launch with `-trace=default`). Turn off ticking you do not need (`PrimaryActorTick.bCanEverTick = false`) and prefer timers and events.

   **Check:** The bottleneck thread is identified, and p95 frame time on minimum spec meets the budget.

8. **Package from the command line** (pattern below) and keep Shipping builds free of debug-only code paths.

   **Check:** The archived Shipping build launches on a clean machine without the editor installed.

## Patterns

### C++ base class for designers

```cpp
UCLASS(Abstract)
class MYGAME_API AMyCharacter : public ACharacter
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category = "Combat")
    void ApplyDamage(float Amount);

    UFUNCTION(BlueprintImplementableEvent, Category = "Combat")
    void OnDamaged(float Amount, float NewHealth);    // effects and audio in Blueprint

protected:
    virtual void SetupPlayerInputComponent(UInputComponent* Input) override;
    void Fire(const FInputActionValue& Value);

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Combat", meta = (ClampMin = "1"))
    float MaxHealth = 100.f;

    UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category = "Combat")
    float Health = 0.f;

    UPROPERTY(EditDefaultsOnly, Category = "Input")
    TObjectPtr<UInputAction> FireAction;
};

void AMyCharacter::SetupPlayerInputComponent(UInputComponent* Input)
{
    Super::SetupPlayerInputComponent(Input);
    if (auto* EIC = Cast<UEnhancedInputComponent>(Input))
    {
        EIC->BindAction(FireAction, ETriggerEvent::Started, this, &AMyCharacter::Fire);
    }
}
```

### C++ or Blueprint

| Put in C++ | Put in Blueprint |
| :--- | :--- |
| Base classes, core rules, math-heavy or per-frame code | Content variants (enemy types, weapons) built on C++ bases |
| Replication, RPCs, save systems | Tuning values, effects, audio, animation hooks |
| Subsystems and shared services | Level scripting, one-off sequences, UI layout (UMG) |
| Anything you need to unit test or diff in review | Rapid prototypes, later moved to C++ if they stick |

### Gameplay framework ownership

| Class | Exists on | Holds |
| :--- | :--- | :--- |
| GameMode | Server only | Rules, spawning, win conditions |
| GameState | Server and all clients | Replicated match state (score, phase, timer) |
| PlayerController | Owning client and server | Input, camera, UI ownership, client RPCs |
| PlayerState | Server and all clients | Per-player data that survives respawn |
| Pawn / Character | Server and relevant clients | Body, movement, physical presence |
| GameInstance and its subsystems | Each process, whole session | Cross-level services, settings, online session |

### Packaging

```powershell
& "C:\Program Files\Epic Games\UE_5.x\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun `
  -project="C:\Work\MyGame\MyGame.uproject" -noP4 -platform=Win64 `
  -clientconfig=Shipping -build -cook -stage -pak -archive -archivedirectory="C:\Builds\MyGame"
```

On macOS and Linux use `Engine/Build/BatchFiles/RunUAT.sh` with the matching platform. Check the current EULA and royalty terms before commercial release.

## Anti-patterns

| Don't | Do instead | Why |
| :--- | :--- | :--- |
| Tick every actor | Timers, events, or tick only where needed | Thousands of ticks dominate the Game thread |
| Raw `UObject*` members without `UPROPERTY` | `UPROPERTY` with `TObjectPtr` or a weak pointer | The GC frees objects under you, causing crashes |
| Chains of Blueprint casts to concrete classes | Interfaces and soft references | Hard references load huge asset graphs into memory |
| Game rules in the Pawn or level Blueprint | GameMode and components | Rules break on respawn and cannot be reused |
| Hot Reload for header changes | Live Coding, or close the editor and rebuild | Hot Reload corrupts Blueprint class state |
| Profile in Play-In-Editor | Packaged Development or Test build | Editor overhead hides real costs |
| Commit `Intermediate/` or `Binaries/` | Ignore generated folders | Huge diffs and broken builds on other machines |

## Verification checklist

- [ ] Source control ignores generated folders, and large maps use One File Per Actor.
- [ ] The C++ / Blueprint split and the state ownership are documented.
- [ ] Every `UObject` reference is `UPROPERTY`, weak, or otherwise GC-safe.
- [ ] Input uses Enhanced Input with mapping contexts added in the PlayerController.
- [ ] Profiling was done in a packaged build, and the frame budget holds on minimum spec.
- [ ] A Shipping build packages from the command line and runs on a clean machine.

## Related

- Workflows: `/game-build`, `/verify`, `/build-fix`.
- Knowledge: `game-architecture`, `multiplayer-networking`, `game-ai`, `game-ui`, `shaders-glsl`, `cpp-modern`, `game-publishing`.
- Agents: `game-engine-specialist`, `cpp-reviewer`, `cpp-build-resolver`, `performance-optimizer`.
