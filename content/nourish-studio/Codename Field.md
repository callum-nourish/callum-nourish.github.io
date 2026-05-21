---
title: Codename Field
tags:
  - internals
---

Every interaction type in [[Nourish Studio]] requires a codename. The `CodenameParameter` component handles input and validation via `useCodenameField`.

## Validation state

| State | Meaning |
|---|---|
| `isEditing` | User is currently editing the codename |
| `isUnique` | Codename doesn't conflict with existing types |
| `hasError` | Validation failed |
| `stillChecking` | Async uniqueness check in flight |
| `preventSaving` | `hasError` is true — save/publish is blocked |

The tick icon switches between `TickIconValid` and `TickIconInvalid` based on `hasError`.

## Behaviour

- `startEditing` focuses the input field and enters edit mode.
- `stopEditing` triggers on `@focusout` / `@blur`.
- `deleteCodename` clears the field and stops editing if the current value is invalid.
- Max length: 250 characters.

Codename uniqueness is checked asynchronously against the existing pool. The pool is cached as `lastSeenCodenames` and refreshed on publish via `ensureCodenamePool`.

Related: [[Interaction Type State]]
