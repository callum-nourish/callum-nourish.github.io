---
title: "ADR-001: Electron vs. Web App for Nourish Studio"
tags:
  - nourish-studio
  - adr
  - electron
aliases:
  - studio ADR-001
  - why electron
  - studio platform decision
date: 2023-08-22
status: accepted
description: Decision record for choosing Electron over a web app for the Nourish Studio desktop tool.
---

# ADR-001: Electron vs. Web App for Nourish Studio

**Status:** Accepted  
**Date:** 2023-08-22  
**Deciders:** Studio Engineering Lead, Product (Operator Tools), CTO

---

## Context

Nourish Studio needed to be built from scratch as a replacement for the legacy "Admin Portal" web app. The Admin Portal was a traditional server-rendered web app that had accumulated significant technical debt and was painful to extend. Two platform options were considered: a modern web app (Next.js, deployed to a subdomain) or a desktop app (Electron).

The primary users are care home operators — typically non-technical administrators and Nourish implementation consultants. Care homes often have unreliable internet connectivity.

---

## Decision

Build Nourish Studio as an **Electron desktop application**.

---

## Rationale

### Offline capability was the deciding factor

Care homes frequently operate in buildings with poor or intermittent Wi-Fi. Configuration work (authoring [[better-care/Data Points|Data Points]], building care plan templates) should not be blocked by a network outage. Electron + SQLite enables full offline authoring with sync-on-reconnect.

A Progressive Web App (PWA) was evaluated as a middle-ground option. PWA offline support was deemed insufficient for the complexity of Studio's local-first state — service worker cache management for a full configuration authoring tool is significantly more complex than SQLite + a sync engine.

### OS integration requirements

| Requirement | Electron | Web App |
|---|---|---|
| OS Keychain for credential storage | ✅ `keytar` | ❌ Not available |
| File system access for export/import | ✅ Native | ⚠️ File System Access API (limited) |
| Auto-update with no IT involvement | ✅ `electron-updater` | ✅ Native (but no control) |
| Desktop notifications | ✅ Native | ✅ Web Notifications API |
| Code signing (org security policy) | ✅ Signed installer | ❌ Not applicable |

Several care home organisations have IT policies requiring software to be signed and installed from a known source. Distributing a signed `.dmg` / `.exe` satisfies these policies; a web app does not.

### Staff familiarity

Operators described the existing Admin Portal as feeling "fragile" — losing work on accidental navigation was a recurring complaint. A desktop app with autosave and offline drafts addressed this directly.

---

## Consequences

**Positive**
- Operators can work offline; changes sync when connectivity is restored.
- OS Keychain integration means credentials are never stored in browser localStorage.
- Distribution via signed installers satisfies enterprise IT policies.

**Negative**
- Two build targets (macOS + Windows) increase CI complexity and build time.
- macOS notarisation adds ~5 minutes to the release pipeline.
- Studio cannot be accessed from a mobile browser — operators need their laptop.
- Electron ships ~150 MB of Chromium regardless of app size.

## Revisit Condition

If care home internet reliability improves significantly (e.g. due to 5G adoption) and offline authoring demand drops, consider a web app migration. The Electron app's IPC boundary maps cleanly to a REST/tRPC API, making a future migration tractable.
