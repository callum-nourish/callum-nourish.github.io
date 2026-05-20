---
title: Service Hierarchy
categories: references
---

Interactions in [[Better Care]] follow a 4-level inheritance chain. Each level can customise what the level above defined, within the bounds it allows.

| Level | Model | Scope |
|---|---|---|
| 1 | `LibrariesInteractionType` | Global library template |
| 2 | `Service` | Organisation |
| 3 | `ProvidedService` | Organisation unit |
| 4 | `SubscribedService` | Client-specific |

A `LibrariesInteractionType` is the master blueprint — it defines parameters, schedules, files, and configuration. It controls what lower levels can override (e.g. `can_edit_parameters`, `can_edit_name`).

When an organisation subscribes to a library, they create a `Service` that references the `LibrariesInteractionType`. Changes to the library propagate automatically via `LibrariesSyncJob`.

[[Parameters]] and [[Confidential Interactions]] both use this hierarchy for inheritance.

## Configuration inheritance

`nil` at any level means "inherit from above". The lookup traverses `super_service` up the chain until a non-nil value is found.

```ruby
def super_service
  if respond_to?(:libraries_interaction_type) && libraries_interaction_type.present?
    libraries_interaction_type
  elsif respond_to? :provided_service
    provided_service.presence || service
  elsif respond_to? :service
    service
  end
end
```
