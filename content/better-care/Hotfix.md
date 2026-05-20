---
title: Hotfix
tags:
  - process
---

Use for an urgent [[Better Care]] release outside the normal [[Deployment]] cadence.

## Preconditions
- [ ] [[Deployment - Semaphore API Token]] is set up
- [ ] The fix is merged to `main`
- [ ] The commit message starts with the relevant `NP` or `DR` card number
- [ ] You have the commit hash to cherry-pick

## Prepare The Release Branch
- [ ] Check which release branch is currently deployed to the target environment
- [ ] Check out and pull that branch

```bash
git cherry-pick <commit-hash>
git push
```

## Tag The Hotfix

```bash
git tag v<year>.<release>.<hotfix-number>
git push origin v<year>.<release>.<hotfix-number>
```

Wait for release branch tests to pass in [[Semaphore]].

## Announce
Post a release message in the Deployments Teams channel.

## Deploy
- [ ] `Tasks → Deploy Launcher → Run Now`
  - `DEPLOY_TYPE` → `Hotfix`
  - `DEPLOY_STAGE` → target environment, usually `beta` first
- [ ] Repeat for `pre-production` then `production` if needed — monitor between each

## After Deploy
- [ ] Follow [[Deployment - Monitoring Checks]] for each environment
- [ ] If anything looks wrong, stop and investigate before deploying to the next environment
