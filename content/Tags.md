---
title: Tags
aliases:
  - tag bibliography
---

Tags here follow a strict two-tier model. A tag is only added if it would still be correct in a year without any edits — if it wouldn't, it's probably a task, not a tag.

## Tier 1 — Content type

What the note *is*. Applied at creation, rarely changed. Used for filtering and navigation.

| Tag | Meaning |
|---|---|
| `products` | A product or system (Better Care, Nourish Studio, Pulse…) |
| `features` | A feature within a product |
| `processes` | A repeatable workflow or runbook (deployment, hotfix…) |
| `tools` | An external tool or platform (Semaphore, AppSignal, Jira…) |
| `references` | Background knowledge, API reference, architectural context |
| `decisions` | A documented design or architectural decision, including open questions and rationale |

One tag per note is the default. A note that spans two types is a sign it should be split.

## Tier 2 — Workflow state

Where the note is in its lifecycle. Applied temporarily; remove when no longer true.

| Tag | Meaning |
|---|---|
| `needs-processing` | Captured but not yet shaped into a proper note |
| `active` | Currently being worked on or frequently referenced |

## What tags are not

- **Not topics.** Topics are captured via [[WikiLinks]] to subject notes, not tags.
- **Not status flags** like `draft` or `wip` — those belong in the note body or a task tracker.
- **Not names.** People, products, and systems are wikilinked, not tagged.
- **Not categories.** The directory structure (`better-care/`, `nourish-studio/`) is the category layer — tags add a *type* dimension on top of that, not a second category system.
