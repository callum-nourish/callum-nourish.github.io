---
title: Nourish Studio
tags:
  - nourish-studio
  - overview
aliases:
  - studio
  - NS
  - nourish studio
description: Desktop configuration tool for care home operators to customise their Nourish platform instance.
---

# Nourish Studio

Nourish Studio is a desktop application (Electron + React) used by care home operators and Nourish implementation consultants to configure their [[better-care/index|Better Care]] instance. It is the authoring environment for anything that customises the platform — [[better-care/Data Points|Data Points]], care plan templates, medication formularies, and branding.

Studio is **operator-only** — it is never used by front-line care staff. Most care homes have one or two "super users" who own their Studio access.

> [!note] Repo
> `github.com/nourish/nourish-studio` — internal access only

---

## At a Glance

| Property | Value |
|---|---|
| Language | TypeScript 5 |
| Framework | Electron 30 · React 18 · Vite |
| Local DB | SQLite (via better-sqlite3) |
| Sync | REST → [[better-care/index|Better Care API]] |
| Releases | GitHub Releases — auto-update via `electron-updater` |
| Platforms | macOS 13+, Windows 11 |

---

## What Studio Configures

| Feature | Configured In | Consumed By |
|---|---|---|
| [[Data Points Editor\|Data Points]] | Studio | [[better-care/index\|Better Care]] |
| Care Plan Templates | Studio | Better Care |
| Medication Formulary | Studio | Better Care |
| Organisation Branding | Studio | Better Care (PDFs, emails) |
| Staff Role Definitions | Studio | [[empower/index\|Empower]] (read-only sync) |

---

## Pages

- [[Architecture]] — Electron process model and sync architecture
- [[Data Points Editor]] — How operators author Data Point definitions
- [[Plugin System]] — Studio's extension mechanism
- [[Runbook]] — Release process and support escalation
- [[ADR-001 Electron vs Web]] — Why Electron over a web app
