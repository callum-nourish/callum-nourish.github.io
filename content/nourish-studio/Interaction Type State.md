---
title: Interaction Type State
tags:
  - references
---

`useInteractionTypeState` is the central hook for managing an interaction type in [[Nourish Studio]]. It wraps all CRUD against DynamoDB via the Interaction Types Lambda API.

## Shape of an interaction type

```typescript
{
  name: 'My New Interaction Type',
  codename: '',
  description: '...',
  parameters: [],
  supportingDocuments: [],
  ruleNodes: [],
  updatedAt: new Date(),
  status: 'Draft',
  nourishServerUrl: '',
  publishedAt: undefined,
  syncData: { id: '', sync_reason: '', synced_by: '' },
  settings: createDefaultSettings(),
}
```

## Key operations

| Function | What it does |
|---|---|
| `create()` | Initialises a new interaction type in local state |
| `save(id)` | Persists the current state to DynamoDB via PUT |
| `publish({ id, comments })` | Validates rules, sets status to `Published`, syncs to [[Better Care]] |
| `load(id)` | Fetches from DynamoDB and restores local state |
| `list(page, filters)` | Paginated list with status/updatedBy/sortBy filters |
| `remove(id)` | DELETE by ID |
| `searchInteractionTypes(params)` | Search by name or codename |

## Publishing

Before publishing, `validateAllRulesInInteractionType` runs. If any rule validation fails, publish is blocked and errors are surfaced. On success, `syncData` is populated and the type is pushed to [[Better Care]].

See [[Codename Field]] for how codenames are validated before save/publish.
