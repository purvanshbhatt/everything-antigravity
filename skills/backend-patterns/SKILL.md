---
name: backend-patterns
description: "Implement high-throughput backend design patterns: CQRS, Event Sourcing, Circuit Breakers, Unit of Work, and Connection Pooling."
---

# High-Performance Backend Patterns

## Overview
Production-tested patterns for building reliable, resilient, and high-throughput server backends in Python, Go, Node.js, and Java.

## Core Patterns
1. **CQRS (Command Query Responsibility Segregation)**:
   - Separate write models (optimized for business invariants and ACID transactions) from read models (denormalized, cached, and optimized for fast queries).
2. **Circuit Breaker & Retry with Exponential Backoff**:
   - Prevent cascading failures when downstream services degrade.
   - States: Closed (normal), Open (fast fail), Half-Open (testing recovery).
   - Jittered exponential backoff to avoid thundering herd problems.
3. **Unit of Work & Repository**:
   - Maintain a list of business objects affected by a business transaction and coordinate the writing of changes.
4. **Database Connection Pooling**:
   - Proper sizing: $Connections = ((Core Count \times 2) + Effective Spindle Count)$.
   - Health checks and lifecycle management to prevent stale connection timeouts.
