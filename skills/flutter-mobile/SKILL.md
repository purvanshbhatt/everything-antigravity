---
name: flutter-mobile
description: "Develop responsive, accessible cross-platform mobile applications using Flutter, Dart, Clean Architecture, and BLoC / Riverpod."
---

# Flutter Mobile Engineering

## Overview
Architect and build responsive, fluid cross-platform applications for Android, iOS, web, and desktop using Flutter and Dart.

## Architecture & State Management
1. **Layered Clean Architecture**:
   - Presentation Layer: Widgets, Screens, Controllers/BLoCs.
   - Domain Layer: Entities, Use Cases, Value Objects (pure Dart, zero Flutter dependencies).
   - Data Layer: Repositories, Data Sources (REST, SQLite, Firestore), Data Transfer Objects (DTOs).
2. **State Management Best Practices**:
   - Use BLoC or Riverpod for predictable, testable unidirectional data flow.
   - Keep widget trees shallow using `const` constructors to minimize unnecessary rebuilds.
3. **Responsive UI Layouts**:
   - Adapt to phone, tablet, and desktop viewports using `LayoutBuilder`, `MediaQuery`, and adaptive scaffolds.
4. **Testing Matrix**:
   - Unit tests for pure business logic in domain use cases.
   - Widget tests with `WidgetTester` for interaction and rendering verification.
   - Golden tests to prevent unintended visual regressions.
