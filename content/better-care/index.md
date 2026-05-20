---
title: Better Care
tags:
  - better-care
  - overview
aliases:
  - BetterCare
  - better care
  - BC
description: Core patient care management platform for Nourish care homes.
---

# Better Care

Better Care is the primary care management platform used by care staff across all Nourish-registered care homes. It covers everything from care planning and medication management to incident recording and daily observations.

> [!note] Repo
> `github.com/nourish/better-care` — internal access only

---

## At a Glance

| Property | Value |
|---|---|
| Language | Ruby 3.2 / TypeScript 5 |
| Framework | Rails 7.1 (API) · React 18 (frontend) |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Hosting | AWS ECS (Fargate) |
| CI/CD | GitHub Actions → ECR → ECS |

---

## Core Domains

- **Care Plans** — Structured, person-centred care plans authored by registered nurses.
- **Medications** — MAR chart management with e-signature support.
- **[[Data Points]]** — Configurable observation measurements (vitals, weight, mood scores). Defined in [[nourish-studio/index|Nourish Studio]] and streamed live into Better Care.
- **Incidents** — Incident recording, severity classification, and CQC-compliant reporting.
- **Residents** — The core `Resident` entity that ties all other domains together.

---

## Pages

- [[Architecture]] — System design, service boundaries, auth flow
- [[Data Model]] — Entity relationship overview
- [[Data Points]] — How configurable observations work
- [[API Reference]] — REST endpoints and auth
- [[Runbook]] — Deployments, rollbacks, on-call guide
- [[ADR-001 Adopting PostgreSQL]] — Why PostgreSQL over MySQL
- [[ADR-002 React Query for State]] — Why React Query over Redux

---

## Team

| Role | Slack |
|---|---|
| Engineering Lead | `#better-care-eng` |
| On-Call Rotation | PagerDuty — `nourish-bc-prod` |
