---
title: Empower — Architecture
tags:
  - empower
  - architecture
aliases:
  - empower architecture
description: Service design, GraphQL layer, and integration architecture for Empower.
---

# Empower — Architecture

## System Overview

Empower is a **Node.js + Fastify** service exposing a **GraphQL API** for its primary clients (the Empower web app and mobile app) and a lightweight **REST API** for internal Nourish platform integrations.

```mermaid
graph TD
    WebApp["Empower Web App (React)"]
    MobileApp["Empower Mobile (React Native)"]
    BetterCare["[[better-care/index|Better Care API]]"]
    ALB["AWS ALB"]
    GQL["GraphQL Server (Yoga)"]
    REST["REST Projection API"]
    Worker["BullMQ Workers"]
    DB[("PostgreSQL 15")]
    Redis[("Redis 7")]
    TokenSvc["OAuth Token Service"]
    PayrollExport["Payroll Service (3rd party)"]

    WebApp -->|GraphQL over HTTPS| ALB
    MobileApp -->|GraphQL over HTTPS| ALB
    ALB --> GQL
    ALB --> REST
    GQL --> DB
    GQL --> Redis
    REST --> DB
    Worker --> DB
    Worker --> PayrollExport
    BetterCare -->|Internal VPC| REST
    GQL -->|Token introspection| TokenSvc
```

---

## GraphQL Layer

The GraphQL schema is code-first using **Pothos** with the Prisma plugin. Resolvers are split by domain:

| Module | Key types |
|---|---|
| `staff` | `StaffMember`, `StaffProfile`, `Qualification` |
| `scheduling` | `Shift`, `Rota`, `ShiftAssignment` |
| `timesheets` | `Timesheet`, `ClockEntry`, `PayrollExport` |
| `compliance` | `DBS`, `Training`, `RightToWork` |

### DataLoader pattern

All N+1 queries are eliminated via **DataLoader**. Every resolver that fetches a related entity must use the relevant loader from `src/dataloaders/`. Adding a resolver without a loader is a lint error (`eslint-plugin-nourish/require-dataloader`).

---

## Better Care Integration

Better Care consumes staff data via a **REST projection endpoint** (`/internal/v1/staff-projections`) — a simplified, denormalised view of the staff table designed for Better Care's read pattern.

The sync mechanism is **event-driven**:

```mermaid
sequenceDiagram
    participant Empower
    participant SNS as AWS SNS
    participant SQS as AWS SQS
    participant BC as Better Care

    Empower->>SNS: Publish StaffUpdated event
    SNS->>SQS: Fan out to BC queue
    BC->>SQS: Poll + consume event
    BC->>BC: Upsert staff_projections
```

Events are published on: staff created, profile updated, employment ended.

> [!info] Eventual consistency
> Better Care's staff projections are eventually consistent with Empower. In practice, lag is <30 s under normal load.

---

## Background Jobs (BullMQ)

| Queue | Purpose |
|---|---|
| `compliance-alerts` | Daily DBS/training expiry checks, notification dispatch |
| `payroll-export` | Weekly payroll file generation and SFTP transfer |
| `timesheet-aggregation` | Nightly timesheet roll-up from clock entries |
| `rota-publish` | Async rota generation from [[Shift Scheduling Engine]] |

---

## Key Design Decisions

- [[ADR-001 GraphQL Migration]] — Why Empower moved to GraphQL for its primary API
