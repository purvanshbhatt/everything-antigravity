---
name: api-design
description: "Design clean, idiomatic RESTful, gRPC, and GraphQL APIs with OpenAPI specifications, versioning, and strict schema validation."
---

# API Design & Contract Engineering

## Overview
Standards and workflows for engineering bulletproof API surfaces that are intuitive, backward-compatible, and performant.

## Design Rules
1. **RESTful Conventions**:
   - Nouns for resources (`/v1/projects/{id}/tasks`), HTTP verbs for actions (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
   - Plural resource naming and standard HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `404 Not Found`, `409 Conflict`, `422 Unprocessable Entity`).
2. **Schema-First Specification**:
   - Write OpenAPI 3.1 or Protocol Buffers (`.proto`) specifications before writing handlers.
   - Generate client SDKs and server stubs automatically to guarantee contract fidelity.
3. **Pagination, Filtering & Sorting**:
   - Cursor-based pagination (`limit`, `starting_after`) over offset-based pagination for large datasets.
   - Deterministic sorting orders.
4. **Error Payloads**:
   - Consistent error envelope:
     ```json
     {
       "error": {
         "code": "RESOURCE_NOT_FOUND",
         "message": "User with ID usr_123 does not exist.",
         "details": []
       }
     }
     ```
