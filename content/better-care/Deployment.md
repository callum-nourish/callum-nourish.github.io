---
title: Deployment
tags:
  - process
---

Live deployment runbook for [[Better Care]]. Read top to bottom. Do not skip ahead unless a gate explicitly says you can continue.

## Cadence
Run this process every Monday and Thursday at `10:30`, after morning peak.

## Before You Start
- [ ] A second engineer is watching via screenshare
- [ ] Your [[Semaphore]] API token is configured — [[Deployment - Semaphore API Token]]
- [ ] The [Miro flowchart](https://miro.com/app/board/uXjVLdUakqo=/) is open
- [ ] You can access GitHub releases, [[Semaphore]], [[AppSignal]], Teams, and [[Jira]]
- [ ] If this is your first time, agree up front who makes the go / no-go call

## Stage Rule

For each environment: check → deploy → validate → monitor → decide.

Stop and do not continue if:
- [[AppSignal]] shows an unexplained spike in errors, `5xx`s, or log volume
- Teams has active deployment-related issues that are not understood
- The site does not load in the target environment
- [[Semaphore]] shows the deployment or instance refresh is incomplete
- You are unsure — ask before proceeding

---

## 1. Release `main` To Beta

### Prepare
- [ ] All cards intended for release are merged to `main` and moved in [[Jira]]
- [ ] Latest `main` build is green in GitHub and [[Semaphore]]
- [ ] Check [[AppSignal]] Beta before starting: [Beta errors](https://appsignal.com/nourish-care/sites/64492d1983eb67110020a23d/exceptions/graphs)

### Create The Release
- [ ] Update local `main`

```bash
git checkout main && git pull
```

- [ ] In `nourish-organisations` on GitHub: `Releases → Draft a new release`
- [ ] Target: `main`. Tag: `v<year>.<incremental number>` — check existing tags first
- [ ] Generate and publish release notes

### Post The Beta Message
- [ ] Wait a few seconds, refresh the release page for notes formatting to finish
- [ ] Copy the formatted notes and post in Deployments Teams channel: `Deploying to Better Care Beta`

### Create The Release Branch
```bash
git checkout main && git pull
git checkout -b release-<year>.<number>
git push --set-upstream origin release-<year>.<number>
```

### Deploy To Beta
- [ ] In [[Semaphore]]: `Tasks → Deploy Launcher → Run Now`
  - `DEPLOY_STAGE` → `beta`
  - `DEPLOY_TYPE` → `New version`
  - `REFRESH_WEB_SERVERS` → `YES`
- [ ] If the task fails → [[Deployment - Failures]]

### Validate Beta
- [ ] Deploy Monitor confirms the deployment starts and completes
- [ ] Login page loads: [Beta](https://beta.nourishcare.co.uk/login#/)

### Monitor Beta
- [ ] Follow [[Deployment - Monitoring Checks]]
- [ ] Also check transactions in [[AppSignal]] for slow requests
- [ ] Only continue to pre-production if Beta is healthy

---

## 2. Promote Beta To Pre-production

### Before You Start
- [ ] Confirm Beta is the version you intend to promote
- [ ] Check [[AppSignal]]: [Seacole](https://appsignal.com/nourish-care/sites/64523e23d2a5e45f620b626a/dashboard) · [Beta](https://appsignal.com/nourish-care/sites/64492d1983eb67110020a23d/dashboard)
- [ ] Post in Deployments Teams channel using the Beta release notes as the base
- [ ] Add any Beta-only hotfixes not already in those notes
- [ ] If you are not certain which Beta release is current, stop and confirm before deploying

### Deploy To Pre-production
- [ ] In [[Semaphore]]: `Tasks → Deploy Launcher → Run Now`
  - `DEPLOY_STAGE` → `pre-production`
  - `DEPLOY_TYPE` → `New version`
  - `REFRESH_WEB_SERVERS` → `YES`
- [ ] If the task fails → [[Deployment - Failures]]

### Validate Pre-production
- [ ] Deploy Monitor confirms deployment starts, completes, and instance refresh is complete
- [ ] Login page loads: [Seacole](https://seacole.nourishcare.co.uk/login#/)

### Monitor Pre-production
- [ ] Follow [[Deployment - Monitoring Checks]]
- [ ] Only continue to production if pre-production is healthy

---

## 3. Promote Beta To Production

Only continue if pre-production has been monitored for ~1 hour and looks healthy.

### Deploy To Production
- [ ] In [[Semaphore]]: `Tasks → Deploy Launcher → Run Now`
  - `DEPLOY_STAGE` → `production`
  - `DEPLOY_TYPE` → `New version`
  - `REFRESH_WEB_SERVERS` → `YES`
- [ ] If the task fails → [[Deployment - Failures]]

### Validate Production
- [ ] Deploy Monitor confirms deployment starts, completes, and instance refresh is complete
- [ ] Login page loads: [Production](https://org.nourishcare.co.uk/login#/)

### Monitor Production
- [ ] Follow [[Deployment - Monitoring Checks]]
- [ ] Do not treat the deployment as complete until monitoring has stayed clear for ~1 hour

---

## If You Need To Branch
- [[Deployment - Failures]]
- [[Deployment - Rollback]]
- [[Hotfix]]
