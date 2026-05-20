---
title: Empower — Runbook
tags:
  - empower
  - runbook
  - ops
aliases:
  - empower ops
  - empower on-call
description: Deployment, rollback, and incident response guide for Empower.
---

# Empower — Runbook

## Deployment

Empower deploys on merge to `main` via GitHub Actions:

1. TypeScript type-check + ESLint
2. Jest unit + integration tests
3. Docker build and push to ECR
4. ECS rolling update (minimum 50% healthy)
5. GraphQL smoke tests (`npm run test:smoke:prod`)

**Typical deploy time:** ~6 minutes.

---

## Rollback

```bash
# Get recent task definition revisions
aws ecs list-task-definitions \
  --family-prefix empower-api \
  --sort DESC \
  --query 'taskDefinitionArns[0:5]'

# Rollback
aws ecs update-service \
  --cluster nourish-prod \
  --service empower-api \
  --task-definition empower-api:88
```

---

## BullMQ Queue Management

Access the BullMQ dashboard at `https://empower-internal.nourish.care/queues` (VPN required).

### Stuck jobs

```bash
# Exec into container
aws ecs execute-command \
  --cluster nourish-prod \
  --task <task-id> \
  --container api \
  --command "node -e \"require('./dist/queues').clearStuckJobs('compliance-alerts')\""
```

### Payroll export failure

> [!warning] High impact
> Payroll export failures must be resolved before 16:00 Friday. Escalate immediately if unresolved after 2 retries.

1. Check BullMQ dashboard for the failed `payroll-export` job
2. Inspect the job error — most common cause is SFTP timeout from the payroll provider
3. Re-queue manually: `await payrollExportQueue.add('retry', { weekEnding: '...' })`

---

## Common Alerts

### `Empower_GraphQL_ErrorRate`
- **Threshold:** >2% GraphQL errors (non-client errors) over 5 min
- **Check:** CloudWatch Logs Insights — filter for `"level":"error"` in `/ecs/empower-api`
- **Common cause:** Prisma connection pool exhausted (see below)

### `Empower_PrismaPoolExhausted`
- **Symptom:** Errors matching `"Timed out fetching a new connection from the connection pool"`
- **Immediate action:** Increase `connection_limit` in `DATABASE_URL` env var (add `?connection_limit=20`)
- **Root cause:** Usually a long-running BullMQ job holding connections — check for stuck workers

### `Empower_SchedulingJobTimeout`
- **Threshold:** `rota-publish` job exceeds 15 min (solver timeout is 10 s — 15 min means the job is stuck)
- **Action:** Kill the stuck job via BullMQ dashboard; check OR-Tools native binding for segfault in CloudWatch

---

## On-Call Contacts

| Escalation | Contact |
|---|---|
| L1 — On-call engineer | PagerDuty: `nourish-empower-prod` |
| L2 — Engineering Lead | Direct Slack DM |
| Payroll emergency | Head of Finance (phone tree in LastPass) |
