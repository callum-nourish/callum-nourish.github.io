---
title: Better Care — Architecture
tags:
  - better-care
  - architecture
aliases:
  - BC Architecture
  - better care architecture
description: System architecture, service boundaries, and authentication flow for Better Care.
---

# Better Care — Architecture

## System Overview

Better Care is a monolithic Rails API consumed by a single-page React frontend. The system is intentionally kept as a well-structured monolith — bounded contexts are enforced via Rails engines and service objects, not microservices.

```mermaid
graph TD
    Browser["Browser (React SPA)"]
    CDN["CloudFront CDN"]
    ALB["AWS ALB"]
    API["Rails API (ECS Fargate)"]
    DB[("PostgreSQL 15")]
    Cache[("Redis 7")]
    S3["S3 — Document Store"]
    Studio["[[nourish-studio/index|Nourish Studio]]"]
    Empower["[[empower/index|Empower API]]"]
    TokenSvc["OAuth Token Service"]

    Browser -->|HTTPS| CDN
    CDN --> ALB
    ALB --> API
    API --> DB
    API --> Cache
    API --> S3
    Studio -->|HTTPS REST| API
    Empower -->|Internal VPC| API
    API -->|Token introspection| TokenSvc
    Browser -->|Auth| TokenSvc
```

---

## Authentication

All requests are authenticated via **OAuth 2.0 Bearer tokens** issued by the central Nourish Token Service.

- The React SPA redirects to the Token Service for login (PKCE flow).
- API requests include `Authorization: Bearer <token>`.
- The Rails API introspects tokens against `/oauth/introspect` on every request (cached in Redis for 60 s).
- [[nourish-studio/index|Nourish Studio]] uses the **Client Credentials** grant for its machine-to-machine calls.
- [[empower/index|Empower]] uses a shared service account token issued from the same Token Service.

> [!warning] Token cache invalidation
> If a user is deactivated, their token remains valid for up to 60 s due to Redis caching. The on-call runbook covers force-invalidation. See [[Runbook#Force Token Invalidation]].

---

## Bounded Contexts (Rails Engines)

| Engine | Responsibility |
|---|---|
| `CareEngine` | Care plans, assessments, goals |
| `MedicationEngine` | MAR charts, prescriptions, e-signatures |
| `ObservationEngine` | [[Data Points]], vitals, recorded observations |
| `ResidentEngine` | Core resident profile, admissions, discharges |
| `IncidentEngine` | Incident recording and reporting |
| `StaffEngine` | Read-only projection of staff from [[empower/index|Empower]] |

---

## Background Jobs

Sidekiq (backed by Redis) handles all async work:

| Queue | Purpose |
|---|---|
| `critical` | E-signature confirmations, medication alerts |
| `default` | Report generation, PDF exports |
| `low` | Analytics event forwarding, audit log writes |

---

## Key Design Decisions

- [[ADR-001 Adopting PostgreSQL]] — PostgreSQL over MySQL for JSONB support (used heavily in [[Data Points]]).
- [[ADR-002 React Query for State]] — React Query manages server state; Zustand handles ephemeral UI state only.
