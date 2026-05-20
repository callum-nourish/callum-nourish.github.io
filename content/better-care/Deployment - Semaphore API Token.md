---
title: Deployment - Semaphore API Token
tags:
  - references
---

Hard prerequisite for [[Deployment]] and [[Hotfix]]. If the token is not set, the task fails with `API token env var not set`.

## What Good Looks Like
The token is already configured in [[Semaphore]] before you run `Deploy Launcher`. You are not prompted to supply it manually during the task.

## If Missing
Add your API token in [[Semaphore]] before running `Deploy Launcher`. If the deployment already failed with the missing token error, fix it first then retry.
