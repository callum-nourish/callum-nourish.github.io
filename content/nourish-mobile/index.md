---
title: Nourish Mobile
tags:
  - products
aliases:
  - Nourish Mobile
---

Offline-first mobile app for carers. Preloads data on startup and syncs changes back via a Sidekiq job through `nourish-organisations` when connectivity is restored.

[nourish-carer-android](https://github.com/nourishcare/nourish-carer-android) · Android

Unlike [[Better Care]] web, the mobile app fetches data in bulk rather than incrementally — API endpoints need org-unit scope, not client-level scope, to support this.
