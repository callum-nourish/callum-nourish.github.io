---
title: Better Care — Runbook
tags:
  - better-care
  - runbook
  - ops
aliases:
  - BC runbook
  - better care ops
description: Deployment, rollback, and incident response guide for Better Care.
---

# Better Care — Runbook

## Deployment

Better Care deploys via GitHub Actions on every merge to `main`. The pipeline:

1. Runs RSpec + Jest test suites
2. Builds and pushes Docker image to ECR
3. Updates the ECS Fargate service with the new task definition
4. Runs smoke tests against the staging environment
5. Promotes to production with a blue/green swap

**Typical deploy time:** ~8 minutes end-to-end.

> [!info] Deploy notifications
> Deployments post to `#better-care-deploys` in Slack. Production deploys also notify `#eng-releases`.

---

## Rollback

### Automatic rollback
If the smoke tests fail after promotion, the pipeline automatically reverts the ECS task definition to the previous version. This is triggered within 2 minutes of a bad deploy.

### Manual rollback

```bash
# List recent task definition revisions
aws ecs list-task-definitions \
  --family-prefix better-care-api \
  --sort DESC \
  --query 'taskDefinitionArns[0:5]'

# Roll back to a specific revision
aws ecs update-service \
  --cluster nourish-prod \
  --service better-care-api \
  --task-definition better-care-api:123
```

> [!warning] Database migrations
> ECS rollback does **not** revert database migrations. If the deploy included a destructive migration, follow the [[#Migration Rollback]] procedure instead.

---

## Migration Rollback

1. Put the application into maintenance mode via the feature flag:
   ```bash
   bundle exec rails runner "FeatureFlags.enable(:maintenance_mode)"
   ```
2. Run the down migration:
   ```bash
   # Exec into a running container
   aws ecs execute-command \
     --cluster nourish-prod \
     --task <task-id> \
     --container api \
     --command "rails db:rollback STEP=1"
   ```
3. Roll back the ECS service (see above).
4. Disable maintenance mode.

---

## Force Token Invalidation

If a user account is compromised or deactivated urgently:

```bash
# Flush the Redis token cache for a specific user
redis-cli -h $REDIS_HOST DEL "token_cache:user:<user_id>"

# Or flush all cached tokens (nuclear option — causes a brief 401 storm)
redis-cli -h $REDIS_HOST KEYS "token_cache:*" | xargs redis-cli -h $REDIS_HOST DEL
```

After flushing, the Token Service will deny subsequent introspection calls for revoked tokens.

---

## Common Alerts

### `BetterCare_HighErrorRate`

- **Threshold:** >1% 5xx rate over 5 minutes
- **First check:** ECS service logs in CloudWatch → `/ecs/better-care-api`
- **Common causes:** Bad deploy, DB connection pool exhaustion, Sidekiq queue backup
- **Escalate to:** Engineering Lead if unresolved after 15 min

### `BetterCare_SidekiqBacklog`

- **Threshold:** `critical` queue depth >50 jobs
- **Action:** Check for stuck jobs in Sidekiq Web UI (internal VPN only)
- **Nuclear option:** `Sidekiq::Queue.new('critical').clear` — only if jobs are confirmed bad

### `BetterCare_SlowQueries`

- **Threshold:** p95 DB query time >500 ms
- **Check:** RDS Performance Insights for blocking queries
- **See also:** [[Data Model#Indexes of Note]]

---

## On-Call Contacts

| Escalation | Contact |
|---|---|
| L1 — On-call engineer | PagerDuty: `nourish-bc-prod` |
| L2 — Engineering Lead | Direct Slack DM |
| L3 — CTO | Emergency phone tree (LastPass) |
