---
title: Tags
note_role: reference
aliases:
  - tag bibliography
---

Tags answer *"what state is this note in?"* — not what it's about, not what type it is. Links, `categories`, and `topics` carry meaning. Tags carry state.

If a tag would still be correct in a year without edits, it's probably not a tag — it belongs in a property or a backlink.

## Status Tags

| Tag | When to apply |
|---|---|
| `#active` | Intentionally being worked on now. Remove when no longer current. |
| `#stuck` | Active but blocked — missing context, decision, or unclear next step. Usually paired with `#active`. |
| `#backlog` | Worth keeping, not current. Parked, not abandoned. |
| `#needs-review` | Drafted once but needs another pass before it's trusted or reused. |
| `#polished` | Pragmatically good enough to reuse. Not perfect. |
| `#done` | For task or work-delivery notes. For knowledge notes, prefer `#polished` or `#archived`. |
| `#archived` | Completed or retained for historical reference. Not in active maintenance. |
| `#deprecated` | Superseded or no longer recommended, but kept because the history is useful. |

### Transitions

```
#active → #needs-review, #stuck, #backlog, #done, or #polished
#stuck → moves to #backlog if no longer current
#needs-review → #polished, #done, #backlog, or #archived
```

Terminal tags are `#polished`, `#done`, `#archived`, `#deprecated`. Don't combine with queue tags without a reason.

## Type and Source Tags

| Tag | Meaning |
|---|---|
| `#clippings` | Material not primarily written by me. Source copy of external content. |
| `#to-read` | A clipping not yet consumed. Delete or archive if not worth reading. |
| `#reflection` | Personal processing. May later become a reusable note. |
| `#excalidraw` | System tag for drawings. Keep — has practical utility. |
| `#weekly` | Weekly note. Structural; acceptable because weekly reviews are a real surface. |
| `#monthly` | Monthly note. Structural; acceptable if monthly reviews remain useful. |

## Tags to Avoid

| Tag | Status |
|---|---|
| `#note` | Deprecated. Everything here is already a note. |
| `#categories` | Deprecated. Use the `categories` property and category notes instead. |
| `#guide` | Candidate for deprecation. Link from a category note instead. |
| `#journal` | Candidate for deprecation. Prefer `#reflection` or `#weekly`. |
| `#meeting` | Candidate for deprecation. Prefer a `categories` value or links to people/projects. |

## Note Roles

`note_role` is a frontmatter property, not a tag. Use it sparingly for the *shape* of a note when it changes how the note is reviewed, searched, or templated.

| Value | Meaning |
|---|---|
| `thinking` | My own working thought. Default for root notes being developed through writing. |
| `source` | Primarily about external material or derived from a source. |
| `communication` | Drafts, meeting prep, feedback, or notes whose purpose is talking to people. |
| `evergreen` | Durable, reusable, should improve over time and connect densely. |
| `reference` | Vault infrastructure, dictionaries, indexes, stable reference pages. |
