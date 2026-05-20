---
title: Adding Interactions
tags:
  - references
---

How the + button works and why interactions appear or don't on the timeline. Part of [[Better Care]].

## Why the + button doesn't show

Start in `showPlusButton` inside `TimelinePlusButtonWrapper`.

The button is hidden when:
- You are on an events/skin tab (`timelineInstanceTypeMounted` is set) **and** there are no `newInstanceServices` for that tab.
- You have selected an instance **and** there are no `matchingManagedInstanceServices` for it.

## Where the interaction list comes from

`filteredNonAdhocProvidedServices` in the `serviceFiltering` store drives the list.

Data sources:
- `/api/v2/provided_services/?include_deleted=true` — the available services (interaction types) for the org unit
- `/api/v2/services/filters` — filter data including instance types and adhoc flags

## Filtering logic

| Context | What shows |
|---|---|
| Events/skin tab | Only `newInstanceServices` — services marked as creating new instances of that type |
| Inside an event or wound instance | `matchingManagedInstanceServices` — services that can be added ad-hoc into the instance |
| Standard timeline | Editable, non-adhoc services; `careplan_review` excluded; filtered by client type if a matching client type group exists |

Client type filtering: if a client type match exists in `filteringClientTypes`, only services in that group show. If no match, no client type filtering is applied.
