---
title: "ADR-001: Adopting PostgreSQL over MySQL"
tags:
  - better-care
  - adr
  - database
aliases:
  - ADR-001
  - postgresql adr
  - why postgres
date: 2022-11-08
status: accepted
description: Decision record for choosing PostgreSQL as the primary database for Better Care.
---

# ADR-001: Adopting PostgreSQL over MySQL

**Status:** Accepted  
**Date:** 2022-11-08  
**Deciders:** Engineering Lead, Backend Chapter

---

## Context

Better Care needed a relational database for its initial launch. At the time, the wider Nourish engineering team had more operational experience with MySQL (Aurora), and Aurora MySQL was the default for new services. However, the [[Data Points]] system — a core differentiator of Better Care — required schema-flexible storage for observation values.

---

## Decision

We will use **PostgreSQL 15** (Aurora PostgreSQL) as the primary database for Better Care.

---

## Rationale

| Factor | PostgreSQL | MySQL (Aurora) |
|---|---|---|
| JSONB support | ✅ First-class with GIN indexes | ⚠️ JSON supported, but no native indexing |
| Full-text search | ✅ `tsvector` / `tsquery` | ⚠️ Limited, plugin-dependent |
| Partial indexes | ✅ Supported | ❌ Not supported |
| Window functions | ✅ Full support | ✅ Full support |
| Operational familiarity | ⚠️ Less experience | ✅ Higher existing knowledge |

The [[Data Points]] system stores observation schemas and values as JSONB. GIN indexes on JSONB allow efficient querying of arbitrary observation fields without schema migrations — this was a hard requirement from the product team.

Partial indexes (e.g. filtering only active, non-deprecated Data Point definitions) also provided meaningful query performance improvements that MySQL could not support natively.

---

## Consequences

**Positive**
- JSONB + GIN indexes enable the flexible [[Data Points]] schema without EAV anti-patterns.
- Partial indexes keep common queries fast as the table grows.
- `pg_trgm` extension provides free-text resident search without Elasticsearch.

**Negative**
- The ops team needed to upskill on PostgreSQL. This was mitigated by Aurora's managed offering.
- One engineer's existing MySQL tooling knowledge was not directly transferable.

---

## Revisit Condition

If JSONB query performance degrades beyond acceptable thresholds at scale (>50M observations), consider migrating observation values to a dedicated time-series store (e.g. TimescaleDB or InfluxDB). The `observations` table is designed to make this extraction straightforward.
