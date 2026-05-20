---
title: "ADR-002: React Query over Redux for Server State"
tags:
  - better-care
  - adr
  - frontend
aliases:
  - ADR-002
  - react query adr
  - why react query
date: 2023-04-14
status: accepted
description: Decision record for using React Query instead of Redux for server-side state management in Better Care's React frontend.
---

# ADR-002: React Query over Redux for Server State

**Status:** Accepted  
**Date:** 2023-04-14  
**Deciders:** Frontend Chapter

---

## Context

Better Care's React frontend needed a strategy for managing server-fetched data (residents, care plans, observations). The initial prototype used Redux Toolkit with RTK Query, but the team found the boilerplate-to-value ratio poor for a domain as query-heavy as ours.

---

## Decision

Use **React Query (TanStack Query v5)** for all server state. Use **Zustand** for ephemeral local UI state (modals, form drafts, unsaved changes).

---

## Rationale

The Better Care frontend is read-heavy: a care home shift involves dozens of data fetches (resident lists, care plans, medication rounds, observation history) with relatively few mutations. React Query's stale-while-revalidate caching model maps naturally to this pattern.

| Concern | React Query + Zustand | Redux Toolkit |
|---|---|---|
| Server state caching | ✅ First-class | ✅ Via RTK Query |
| Background refetch | ✅ Built-in | ⚠️ Manual setup |
| Optimistic updates | ✅ Simple API | ✅ Supported |
| Boilerplate per entity | ✅ Low | ⚠️ High (slices, selectors) |
| Local UI state | ⚠️ Not designed for | ✅ Strong |
| DevTools | ✅ React Query DevTools | ✅ Redux DevTools |

The hybrid approach (React Query for server state, Zustand for local state) gives the best of both worlds without the cognitive overhead of a single global store that mixes both concerns.

---

## Consequences

**Positive**
- Dramatically reduced fetch-related boilerplate (estimated ~40% fewer lines vs. RTK Query equivalent).
- Automatic background refetching keeps care plan data fresh without manual polling.
- Query invalidation after mutations (e.g. recording an observation invalidates the resident's observation list) is one `queryClient.invalidateQueries()` call.

**Negative**
- Two state libraries instead of one increases onboarding surface.
- Engineers familiar with Redux-only patterns needed adjustment time.
- The boundary between "server state" and "local state" occasionally requires judgment calls.

---

## Convention

The project uses a `useResidentObservations(residentId, filters)` hook pattern — one custom hook per query, co-located with the feature. Direct `useQuery` calls in components are discouraged. See `src/hooks/queries/` for examples.
