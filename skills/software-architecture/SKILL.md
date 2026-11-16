---
name: software-architecture
description: "Architect scalable, decoupled software systems using Clean Architecture, Hexagonal patterns, and domain-driven design."
---

# Software Architecture & System Design

## Overview
Design maintainable, testable, and loosely-coupled software architectures for distributed backends, desktop platforms, and cloud-native services.

## Architecture Principles
1. **Hexagonal (Ports & Adapters) / Clean Architecture**:
   - Inward dependency rule: Domain models and business logic have zero dependencies on frameworks, databases, or UI.
   - Ports: Abstract interfaces defining operations the core domain needs or provides.
   - Adapters: Concrete implementations (e.g., Postgres repository, REST controller, gRPC handler).
2. **Event-Driven Architectures**:
   - Asynchronous decoupled communication via Pub/Sub or Kafka.
   - Outbox pattern for guaranteed at-least-once message delivery.
3. **Resilience Engineering**:
   - Graceful degradation under load using backpressure and rate limiting.
   - Idempotent API endpoints with unique request deduplication keys.

## Architecture Decision Records (ADR)
Document every structural architectural choice:
- **Title**: Short description of decision.
- **Status**: Proposed / Accepted / Superseded.
- **Context**: Problem statement and forces at play.
- **Decision**: The selected path.
- **Consequences**: Positive outcomes and trade-offs.
