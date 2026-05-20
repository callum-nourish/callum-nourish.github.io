---
title: Deployment - Monitoring Checks
tags:
  - process
---

Run after each stage of [[Deployment]] and after a [[Hotfix]].

## Checks
- [ ] Watch the target environment in [[AppSignal]] for ~1 hour
- [ ] Review error spikes around deployment time
- [ ] Review `5xx` NGINX status codes around deployment time
- [ ] Zoom logs to ~1 hour and check for unexpected jumps in log volume
- [ ] Watch Teams channels: `Development Fires`, `Deployments`, `Support`, `General`
- [ ] Confirm the target site loads and basic login looks normal

## Environment Links

| Environment | AppSignal |
|---|---|
| Beta | [Dashboard](https://appsignal.com/nourish-care/sites/64492d1983eb67110020a23d/dashboard) |
| Pre-production (Seacole) | [Dashboard](https://appsignal.com/nourish-care/sites/64523e23d2a5e45f620b626a/dashboard) |
| Production | [Dashboard](https://appsignal.com/nourish-care/sites/645e968ad2a5e4f45cc6cd33/dashboard) |

## Rule
Do not proceed to the next environment unless you understand any spike or anomaly.

## Extra Check For Beta
- [ ] Review transactions and look for an increase in slow requests
