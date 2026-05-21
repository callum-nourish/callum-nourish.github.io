---
title: Authentication
tags:
  - internals
---

[[Nourish Studio]] uses AWS Cognito for auth, managed through `useSessionStore`.

## Initialisation

On app load, `useSessionStore().initializeFromSessionStorage()` runs before mounting. This restores a valid session from storage so a page reload doesn't log the user out.

## Token refresh

Cognito tokens expire after 60 minutes. If the user is active, the token refreshes every 15 minutes via `useSessionActivityRefresh`, initialised in `App.vue`.

## Route protection

A `router.beforeEach` guard checks `hasActiveSession` and the route's `meta.requiresAuth` flag:

- `requiresAuth: false` → always accessible (e.g. `/login`)
- Signed in + visiting `/login` → redirect to `/`
- Signed in + `requiresAuth: true` → proceed
- Not signed in → redirect to `/login`

## Sign out

`clearSession()` on `useSessionStore` clears the token, then the router pushes to `/login`.
