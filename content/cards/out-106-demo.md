---
title: OUT-106 Demo
created: 2025-12-16
tags:
  - done
aliases:
  - Care plan report date range demo
---

Carer's can generate a custom careplan report based on filters but the issue is the data within the report is only for the day the report is generated on. What if a carer needed the data of a careplan report for a resident for the past three days, three weeks, three months? 
# Solution
Our change is built upon existing report generation functionality but leverages the new Vue daterange picker component allowing the Carer to generate a single careplan report containing data throughout a range of time. The careplan report orders the elements0 of the report from oldest to newest; date/time flags throughout report.

- Carers don't have to generate as many individual reports
- Makes it easier for carers to analyse historical data, better identifying trends / patterns for  resident's care

# Report Description
We have the standard careplan report elements; pages, needs, interactions however you'll notice the pages and needs that have been modified also have the date and time the update occurred.

## Notes
- It's worth noting that there are some pre-existing formatting issues within the careplan report; e.g. if an element is printed over several pages, it's not formatted nicely with a repeated section header - that's a separate task that I believe is currently in progress.
- Only the latest versions of interactions are included in the report. 
	- These are ordered from oldest to newest via their closed_at date
	- Interactions in progress that haven't been 'completed/closed' do not appear
- Needs and pages that are modified over time have different versions; these are included within the careplan report
	- Any needs or interactions associated with an older version of a page are listed with them
