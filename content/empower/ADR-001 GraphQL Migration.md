---
title: "ADR-001: Migrating REST to GraphQL"
tags:
  - empower
  - adr
  - api
  - graphql
aliases:
  - empower ADR-001
  - why graphql
  - graphql migration
date: 2024-02-01
status: accepted
description: Decision record for migrating Empower's primary API from REST to GraphQL.
---

# ADR-001: Migrating REST to GraphQL

**Status:** Accepted  
**Date:** 2024-02-01  
**Deciders:** Empower Engineering Lead, Mobile Chapter, Frontend Chapter

---

## Context

Empower's original REST API was designed with the web app in mind. When the mobile app launched in 2023, it became clear the REST API was a poor fit:

- The mobile app required deeply nested data (staff member + shifts + compliance + qualifications) in a single fetch to avoid waterfall requests on poor connections.
- Over-fetching was rampant — the mobile app received large staff payloads but only displayed name, role, and next shift.
- Adding new views required new endpoint variants, leading to REST endpoint proliferation (`/staff`, `/staff/summary`, `/staff/mobile-v2`).

The internal REST projection API for [[better-care/index|Better Care]] was excluded from scope — it's a narrow, stable interface and REST is appropriate there.

---

## Decision

Migrate Empower's **primary client-facing API to GraphQL** using **GraphQL Yoga** and **Pothos** (schema-first TypeScript). The internal REST projection API for Nourish platform integrations remains REST.

---

## Rationale

| Concern | GraphQL | REST |
|---|---|---|
| Mobile underfetching | ✅ Client specifies exact fields | ❌ Fixed response shape |
| Nested data in one request | ✅ Single query, multiple types | ⚠️ Multiple round trips or custom endpoint |
| API evolution | ✅ Additive — deprecate fields, never remove | ❌ Version proliferation |
| Type safety | ✅ Schema-generated TypeScript types | ⚠️ Manual OpenAPI → types |
| Subscriptions (rota live updates) | ✅ Native GraphQL Subscriptions | ⚠️ WebSocket bolt-on |
| Operational tooling | ⚠️ Less standard than REST | ✅ Mature ecosystem |

The rota live-update feature (staff watching their rota generate in real time) required a subscription model. GraphQL Subscriptions over WebSocket removed the need for a separate WebSocket server.

---

## Migration Strategy

The migration used a **strangler-fig pattern** over 3 months:
1. GraphQL layer deployed alongside REST, behind a feature flag.
2. Web app migrated screen by screen to GraphQL.
3. Mobile app launched on GraphQL from day one (greenfield).
4. REST endpoints deprecated with 6-month sunset notice.
5. REST endpoints removed (except internal projection API).

---

## Consequences

**Positive**
- Mobile app bundle size reduced by ~18% (no over-fetching).
- New view development no longer requires backend changes in most cases.
- GraphQL subscriptions power the real-time rota view with zero additional infrastructure.

**Negative**
- HTTP caching is harder with GraphQL (no per-endpoint CDN caching). Mitigated via persisted queries and Apollo Router caching headers.
- N+1 queries required DataLoader discipline — enforced via custom lint rule (`eslint-plugin-nourish/require-dataloader`).
