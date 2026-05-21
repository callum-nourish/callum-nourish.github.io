---
title: Feature Toggles
tags:
  - internals
---

[[Better Care]] uses a Ruby feature toggle system. Toggles are defined with `ft` and exposed to the frontend via `window.featureToggle`.

```ruby
ft :confidential_interactions, false, 'true', 'true', 'enterprise'
#   name                        default  org_config  ou_config  version
```

## Config levels

| `org_config` / `ou_config` | Behaviour |
|---|---|
| `'admin'` | Configurable by anyone via admin panel |
| `'true'` | Configurable only with `?developer=1` in the URL |
| `'false'` | Non-configurable — Rails console only |

If both `org_config` and `ou_config` are `false`, the toggle is `non_configurable`.

`version` is `'enterprise'` (current) or `'blue'` (deprecated).

## Admin routes

- `admin/feature_toggles`
- `admin/organisations/{org_slug}`
- `admin/organisation_units/{ou_slug}`

## Frontend

```javascript
featureToggles.isEnabled('cloneDeleteOrganisationInteractions')
```
