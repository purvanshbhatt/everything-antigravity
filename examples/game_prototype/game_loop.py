"""
Deterministic 2D Game Loop Prototype.
Demonstrates fixed-timestep physics updates, entity state management, and collision detection.
"""

import time
import math
from typing import List, Dict, Any


class Vector2:
    def __init__(self, x: float, y: float):
        self.x = x
        self.y = y

    def __add__(self, other):
        return Vector2(self.x + other.x, self.y + other.y)

    def __mul__(self, scalar: float):
        return Vector2(self.x * scalar, self.y * scalar)


class Entity:
    def __init__(self, name: str, position: Vector2, velocity: Vector2, radius: float = 10.0):
        self.name = name
        self.position = position
        self.velocity = velocity
        self.radius = radius

    def update(self, dt: float):
        self.position = self.position + (self.velocity * dt)


class GameWorld:
    """Manages game simulation with fixed-timestep physics."""

    def __init__(self, width: float = 800.0, height: float = 600.0, fixed_dt: float = 1.0 / 60.0):
        self.width = width
        self.height = height
        self.fixed_dt = fixed_dt
        self.entities: List[Entity] = []
        self.simulated_time = 0.0

    def add_entity(self, entity: Entity):
        self.entities.append(entity)

    def physics_step(self, dt: float):
        """Simulates one deterministic physics step."""
        for entity in self.entities:
            entity.update(dt)
            # Boundary bounce
            if entity.position.x <= 0 or entity.position.x >= self.width:
                entity.velocity.x *= -1
            if entity.position.y <= 0 or entity.position.y >= self.height:
                entity.velocity.y *= -1

        self.simulated_time += dt

    def run_simulation(self, total_seconds: float) -> Dict[str, Any]:
        """Runs headless simulation for benchmarking or verification."""
        steps = int(total_seconds / self.fixed_dt)
        for _ in range(steps):
            self.physics_step(self.fixed_dt)

        return {
            "total_steps": steps,
            "simulated_time": round(self.simulated_time, 4),
            "entity_count": len(self.entities),
            "entity_positions": {e.name: (round(e.position.x, 2), round(e.position.y, 2)) for e in self.entities}
        }


def main():
    world = GameWorld()
    world.add_entity(Entity("Player", Vector2(100, 100), Vector2(150, 50)))
    world.add_entity(Entity("Enemy", Vector2(400, 300), Vector2(-100, 80)))

    results = world.run_simulation(1.0)
    print("Game Simulation Completed:")
    print(results)


if __name__ == "__main__":
    main()
