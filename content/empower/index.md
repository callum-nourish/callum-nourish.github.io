---
title: Empower
tags:
  - empower
  - overview
aliases:
  - empower
  - workforce
  - staff platform
description: Staff scheduling and workforce management platform for Nourish care homes.
---

# Empower

Empower is Nourish's workforce management platform. It handles everything related to care home staff — scheduling, timesheets, compliance tracking, and staff profiles. Staff identity in Empower is the canonical source of truth referenced by [[better-care/index|Better Care]] and [[nourish-studio/index|Nourish Studio]].

> [!note] Repo
> `github.com/nourish/empower` — internal access only

---

## At a Glance

| Property | Value |
|---|---|
| Language | TypeScript 5 (Node.js 22) |
| Framework | Fastify · GraphQL (Yoga) |
| Database | PostgreSQL 15 |
| Cache/Queue | Redis 7 (BullMQ) |
| Hosting | AWS ECS (Fargate) |
| CI/CD | GitHub Actions → ECR → ECS |

---

## Core Domains

- **Staff Profiles** — The canonical record of every care home employee. Empower's `staff_id` is referenced as a foreign key across the Nourish platform.
- **[[Shift Scheduling Engine]]** — Constraint-based scheduling engine that assigns staff to shifts while respecting qualifications, rota rules, and Working Time Regulations.
- **Timesheets** — Clock-in/out, automated timesheet generation, payroll export.
- **Compliance** — DBS check tracking, mandatory training expiry alerts, right-to-work status.

---

## Pages

- [[Architecture]] — Service design and integration points
- [[Data Model]] — Entity relationships
- [[Shift Scheduling Engine]] — How scheduling works
- [[API Reference]] — GraphQL schema and REST endpoints
- [[Runbook]] — Deployments and on-call guide
- [[ADR-001 GraphQL Migration]] — Why Empower moved from REST to GraphQL

---

## Integration with Better Care

Empower exposes a **read-only REST projection** consumed by [[better-care/index|Better Care]] to populate its `staff_projections` table. Better Care never writes to staff data — Empower is the sole source of truth.

See [[Architecture#Better Care Integration]] for the sync mechanism.
