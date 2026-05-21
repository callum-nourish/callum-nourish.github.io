---
title: Data Points
tags:
  - products
aliases:
  - Data Points
---

Node.js Lambda microservice that stores and serves data point configuration. Consumed by [[Better Care]]'s `critical_information` endpoint and by [[Nourish Mobile]] on app startup.

[data-points](https://github.com/nourishcare/data-points) · Node.js · AWS Lambda

`DataPointsFetcher` is the primary interface — `clients_data_points` batches all client data in one call, `data_point_groups_by_codenames` fetches group config (slow on cold cache, fast on Redis hit).

## Direction

[[Absorption into Nourish Studio]] — working proposal to deprecate this service and absorb it into [[Nourish Studio]].
