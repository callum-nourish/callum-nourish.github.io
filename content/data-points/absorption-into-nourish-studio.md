---
title: Absorption into Nourish Studio
tags:
  - decisions
---

Working proposal to deprecate [[Data Points]] as a standalone Lambda service and absorb its responsibilities into [[Nourish Studio]].

## Case for absorption

Data Points exists as a separate microservice but its primary consumer is [[Nourish Studio]] — it serves data point configuration that Studio uses to build interaction templates. Running it as an independent Lambda introduces a deployment boundary, cold-start latency (see [[Slow data-points Lambda response times]]), and a separate release surface for what is effectively Studio configuration data.

Absorbing it into Studio would:
- Eliminate cold-start overhead on the data-points Lambda
- Remove cross-service HTTP calls from the [[Better Care]] `critical_information` endpoint
- Consolidate data point ownership where it conceptually belongs

## Open questions

- [[Better Care]] and [[Nourish Mobile]] also consume Data Points directly — what replaces those integrations post-absorption?
- Is the data model compatible with Studio's existing architecture, or does absorption require a schema migration?
- Who owns the migration and over what timeline?

## Status

Working opinion — not formally agreed. Needs product and engineering alignment before any migration work begins.
