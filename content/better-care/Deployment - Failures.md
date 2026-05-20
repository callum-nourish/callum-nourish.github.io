---
title: Deployment - Failures
categories: processes
---

Use when a [[Deployment]] step fails. Start with the [[Semaphore]] logs for the failed run.

If the fix requires AWS changes, direct server access, or database changes — stop and pair with an experienced engineer. Do not guess when production or pre-production is affected.

## Common Failures

### `API token env var not set`
Your [[Semaphore]] API token is missing. Set it up before retrying: [[Deployment - Semaphore API Token]]

### `Deployment of new release-X.X to env was less than an hour ago`
The deployment marker was updated in a previous run, often after an earlier failure. Check nothing is still running. If you must continue, deploy as a `Hotfix` with `REFRESH_WEB_SERVERS=TRUE`.

### Bastion Not Responding
SSH timeout through the bastion host. Check the bastion EC2 instance in AWS and restart it if necessary. If you are not comfortable doing this, escalate.

### Autoscaling Issue
An EC2 instance disappeared during deploy. In AWS Auto Scaling Groups:
- [ ] Temporarily set `minimum` equal to `maximum`
- [ ] Wait for instances to provision
- [ ] Rerun the deployment
- [ ] Restore original autoscaling settings after a successful deploy

Reference: [AWS autoscaling capacity limits](https://docs.aws.amazon.com/autoscaling/ec2/userguide/asg-capacity-limits.html). If you are not comfortable changing autoscaling settings, escalate.

### Data Migration Failure
- [ ] Search the deployment log for `db:migrate:`
- [ ] Check whether any migrations already completed — they will not rerun automatically
- [ ] Open the database console:

```bash
cap <server> db:console
```

- [ ] Check migration tables:

```sql
SELECT * FROM data_migrations;
```

- [ ] Mark a missing migration as completed if needed:

```sql
INSERT INTO data_migrations (version) VALUES (20240912085724);
```

If you are not comfortable with database or Rails console changes, escalate.

## Rule
Do not rerun piecemeal server deploys if [[Semaphore]] offers `Rerun`. Redeploy all servers together.
