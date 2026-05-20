---
title: Nourish Mobile
tags:
  - products
---

Offline-first mobile app for carers. Preloads data on startup and syncs changes back via a Sidekiq job through `nourish-organisations` when connectivity is restored.

Unlike [[Better Care]] web, the mobile app fetches data in bulk rather than incrementally — API endpoints need org-unit scope, not client-level scope, to support this.
