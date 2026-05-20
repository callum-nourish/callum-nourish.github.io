---
title: Deployment - Rollback
tags:
  - process
---

Use when a [[Deployment]] succeeded technically but needs to be reversed quickly.

## Immediate Rollback

```bash
cap <ENV> deploy:rollback
```

Run this for each affected environment, not just one.

## Important

This is not a complete fix. After rolling back you still need to revert the change in GitHub and redeploy properly through [[Semaphore]].
