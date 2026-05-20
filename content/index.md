---
title: Nourish Engineering Docs
tags:
  - home
aliases:
  - home
  - engineering hub
  - docs
---

# Nourish Engineering Docs

Welcome to the Nourish engineering knowledge base. This site is the single source of truth for architecture decisions, data models, runbooks, and API references across all Nourish codebases.

> [!info] How to navigate
> Use the **search bar** (top right) to find any note by title or alias. The **graph view** shows how codebases relate to one another. Each codebase lives in its own section below.

---

## Codebases

| Codebase | Description | Stack |
|---|---|---|
| [[better-care/index\|Better Care]] | Core care management platform | Rails · React · PostgreSQL |
| [[empower/index\|Empower]] | Staff scheduling & workforce management | Node.js · GraphQL · Redis |
| [[nourish-studio/index\|Nourish Studio]] | Desktop config tool for care home operators | Electron · React · SQLite |

---

## Key Cross-Codebase Concepts

- **[[better-care/Data Points\|Data Points]]** — Configurable measurement types (e.g. blood pressure, weight) defined in [[nourish-studio/index\|Nourish Studio]] and consumed by [[better-care/index\|Better Care]].
- **Shared Auth** — All three services authenticate against a central OAuth 2.0 token service maintained by the Better Care team. See [[better-care/Architecture#Authentication|Better Care Auth]].
- **Staff Identity** — Staff profiles are owned by [[empower/index\|Empower]] and referenced by foreign key in Better Care.

---

## ADR Index

| # | Codebase | Decision |
|---|---|---|
| ADR-001 | Better Care | [[better-care/ADR-001 Adopting PostgreSQL\|Adopting PostgreSQL over MySQL]] |
| ADR-002 | Better Care | [[better-care/ADR-002 React Query for State\|React Query over Redux]] |
| ADR-001 | Empower | [[empower/ADR-001 GraphQL Migration\|Migrating REST → GraphQL]] |
| ADR-001 | Nourish Studio | [[nourish-studio/ADR-001 Electron vs Web\|Electron vs. Web App]] |
