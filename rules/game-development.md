# Video Game Development Rules

1. **Deterministic Physics**: Never tie movement velocity directly to frame rate. Always multiply delta velocity by `delta_time` or run physics inside fixed timestep loops.
2. **Decoupled Architecture**: Keep input handling, game logic, state machines, and rendering routines strictly decoupled.
3. **Asset Memory Management**: Pool frequently spawned objects (bullets, particles, enemies) to prevent garbage collection pauses during gameplay.
4. **Game Feel (Juice)**: Polish game interactions with responsive controls, coyote time on platformers, screen shake, and auditory confirmation.
