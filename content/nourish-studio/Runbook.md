---
title: Nourish Studio — Runbook
tags:
  - nourish-studio
  - runbook
  - ops
aliases:
  - studio runbook
  - studio releases
description: Release process, crash reporting, and support escalation guide for Nourish Studio.
---

# Nourish Studio — Runbook

Studio is a desktop app — its operational model differs from server-side services. There is no ECS cluster to manage; the "ops" concerns are **releases**, **crash reporting**, and **support escalation**.

---

## Release Process

1. Merge to `main` triggers the CI pipeline:
   - TypeScript type-check + ESLint
   - Jest unit tests
   - Electron Builder bundles macOS (`.dmg`) and Windows (`.exe`) installers
   - macOS build is signed and submitted for Apple notarisation (~5 min)
   - Windows build is signed with the EV certificate
2. Installers and a `latest.yml` file are published to the `nourish/nourish-studio` GitHub Release for the tag.
3. Existing Studio installs receive an update notification within 24 hours (next launch or 24-hour timer).

**Release cadence:** Bi-weekly on Wednesdays.

---

## Forcing an Urgent Update

If a critical bug requires all users to update immediately:

1. Publish the patched release as normal.
2. Set the `FORCE_UPDATE_FROM` env var in the Nourish Control Panel to the last known-good version string.
3. Studio's updater checks this on launch — if the installed version is ≤ `FORCE_UPDATE_FROM`, it blocks the UI until the update is applied.

> [!warning]
> Force-update should be used sparingly. Users on slow connections may be blocked for several minutes while the update downloads.

---

## Crash Reporting

Studio uses **Sentry** for crash reporting (both main and renderer processes). Crashes appear in the `nourish-studio` Sentry project.

Common crash categories:

| Crash | Cause | Fix |
|---|---|---|
| `SQLite: disk I/O error` | Corrupted local DB (rare, usually after hard shutdown) | Reset local DB: delete `%APPDATA%/NourishStudio/db.sqlite` (Windows) or `~/Library/Application Support/NourishStudio/db.sqlite` (macOS) |
| `net::ERR_CERT_DATE_INVALID` | System clock skew | Advise user to sync system clock |
| `Keytar: could not get credentials` | macOS Keychain locked | User must unlock Keychain or re-authenticate |
| Native crash in `node-or-tools` | OR-Tools binding issue (rare) | Pin to previous OR-Tools version; file issue |

---

## Support Escalation

Studio is operator-facing. Support requests come through the Nourish Customer Success team.

| Tier | Handled By | Criteria |
|---|---|---|
| T1 | Customer Success | Login issues, UI confusion, update failures |
| T2 | Studio Engineering | Crashes, sync failures, plugin errors |
| T3 | Core Platform | Issues caused by [[better-care/index\|Better Care API]] rejecting Studio payloads |

For T3 escalations, capture the `X-Request-Id` header from the failed API call (visible in Studio's **Help → Diagnostic Log**) and pass it to the Better Care on-call team.
