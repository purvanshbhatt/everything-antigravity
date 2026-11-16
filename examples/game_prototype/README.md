# Game Prototype Example

This example demonstrates a deterministic, fixed-timestep 2D game loop implemented in pure Python.

## Running the Simulation
```bash
python3 examples/game_prototype/game_loop.py
```

## Features
- Fixed timestep physics (`fixed_dt = 1/60s`) avoiding delta time drift.
- Vector2 math with velocity updates and boundary collision handling.
- Headless execution mode suitable for continuous integration and unit testing.
