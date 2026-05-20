---
title: Better Care — API Reference
tags:
  - better-care
  - api
aliases:
  - BC API
  - better care api
  - better care endpoints
description: REST API reference for Better Care — authentication, residents, observations, and data points.
---

# Better Care — API Reference

The Better Care API is a JSON REST API served at `https://api.bettercare.nourish.care/api/v1`.

All endpoints require a valid Bearer token — see [[Architecture#Authentication]].

---

## Authentication

```http
Authorization: Bearer <token>
```

Tokens are issued by the central OAuth service. For machine-to-machine access (e.g. from [[nourish-studio/index|Nourish Studio]]), use the Client Credentials grant.

---

## Residents

### `GET /residents`

Returns a paginated list of residents for the authenticated organisation.

**Query params**

| Param | Type | Description |
|---|---|---|
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Results per page (max: 100) |
| `care_level` | string | Filter by `residential`, `nursing`, `dementia` |
| `discharged` | boolean | Include discharged residents (default: false) |

**Response**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-...",
      "first_name": "Jane",
      "last_name": "Smith",
      "care_level": "nursing",
      "admission_date": "2024-03-12"
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 142 }
}
```

> [!note] PII in responses
> `nhs_number` and `date_of_birth` are **not** included in list responses. Fetch the individual resident to access these fields.

---

## Data Points

### `GET /data_point_definitions`

Returns all active [[Data Points|Data Point definitions]] for the organisation.

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Blood Pressure",
      "slug": "blood-pressure",
      "schema": { ... },
      "alert_rules": [ ... ]
    }
  ]
}
```

### `POST /data_point_definitions`

Creates a new Data Point definition. This endpoint is called by [[nourish-studio/Data Points Editor|Nourish Studio]] — direct use by care staff is not expected.

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | Max 80 chars |
| `slug` | ✅ | Unique per org, lowercase, hyphens only |
| `schema` | ✅ | See [[Data Points#Field Types]] |
| `alert_rules` | ❌ | Defaults to `[]` |

### `GET /data_point_definitions/:slug`

Returns a single definition by slug.

---

## Observations

### `POST /residents/:id/observations`

Records a new observation for a resident.

```json
{
  "data_point_slug": "blood-pressure",
  "value": { "systolic": 128, "diastolic": 82 },
  "recorded_at": "2026-05-20T09:15:00Z",
  "notes": "Recorded before morning medication"
}
```

The API validates `value` against the Data Point's `schema` at write time. Invalid values return `422 Unprocessable Entity` with field-level errors.

### `GET /residents/:id/observations`

Returns a paginated, time-ordered list of observations for a resident.

| Param | Type | Description |
|---|---|---|
| `data_point_slug` | string | Filter by measurement type |
| `from` | ISO 8601 | Start of time range |
| `to` | ISO 8601 | End of time range |

---

## Errors

| Status | Meaning |
|---|---|
| `401` | Missing or invalid token |
| `403` | Token valid but insufficient scope |
| `404` | Resource not found or not accessible to this org |
| `422` | Validation error — body contains `errors` array |
| `429` | Rate limited — retry after `Retry-After` header |
