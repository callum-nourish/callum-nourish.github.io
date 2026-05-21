---
title: One Care Plan
tags:
  - internals
---

1CP migrates care plans from being org-unit-specific to organisation-wide. A person supported (PWS) gets one care plan across all org units rather than one per unit.

Part of [[Better Care]].

## Models

All 1CP models live under the `CarePlan` module and use single-table inheritance across three tables:

| Table | Library | Organisation | Client |
|---|---|---|---|
| `care_plan_section` | `CarePlan::LibrarySection` | `CarePlan::OrganisationSection` | `CarePlan::ClientSection` |
| `care_plan_page` | `CarePlan::LibraryPage` | `CarePlan::OrganisationPage` | `CarePlan::ClientPage` |
| `care_plan_need` | `CarePlan::LibraryNeed` | `CarePlan::OrganisationNeed` | `CarePlan::ClientNeed` |

## Terminology mapping

| Old | New |
|---|---|
| Folder (`Category`) | Section |
| Page (`Subcategory`) | Page |
| Need / Care Plan (`Need`) | Need |
| Log (`ServiceLogger`) | Log |
| Risk Assessment (`RiskAssessment`) | Need Risk Evaluation (`NeedRiskEvaluation`) |

## How content flows

1. Org units subscribe to libraries containing 1CP care plans.
2. Library objects are added to the **organisation-level** template. Each section/page/need is tagged with client types and care domains.
3. The **client** receives a care plan from all template content matching their client types across org units.
4. The org unit the care plan is viewed from determines which content is active (others are greyed out).

## Template Builder

A new screen for building the org-level template. Uses drag-and-drop, supports renaming and archiving, links to documents, logs, and interactions.
