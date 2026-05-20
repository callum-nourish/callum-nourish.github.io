---
title: Confidential Interactions
categories: references
---

Any interaction can be marked confidential via a `confidential` boolean. Access is then restricted by role.

Requires [[Feature Toggles|feature toggle]]:

```ruby
ft :confidential_interactions, false, 'true', 'true', 'enterprise'
```

## Access levels

| Role setting | Can do |
|---|---|
| `full` | Read all confidential interactions |
| `write_only` | Create confidential interactions; view own planned ones; cannot read after closing |

`write_only` is designed for witness statements — you record the information but cannot read what others have written.

## Exceptional access

A user with `write_only` can still read a confidential interaction if they created it and it is still in `planned` state:

```ruby
def person_saved_confidential_interaction_for_later?(interaction, person)
  interaction.confidential? &&
    (interaction.state_in_database.nil? || interaction.state_in_database == 'planned') &&
    (interaction.auditable_responsible_person_ids.blank? ||
     interaction.auditable_responsible_person_ids.include?(person.id))
end
```

## SQL filtering

Confidential interactions are filtered at the SQL level for dashboard reports and statistics where CanCan is not in full effect:

```ruby
def maybe_filter_by_confidentiality(current_person, table_name = 'interactions')
  return '' if should_have_confidential_access?(current_person, current_person&.organisation_role)
  "AND #{table_name}.confidential IS NOT TRUE"
end
```

## Service-level configuration

Confidentiality behaviour is set on the `ServiceSpecification` and inherits through the [[Service Hierarchy]]:

| Value | Meaning |
|---|---|
| `always` | Interaction is always confidential |
| `never` | Never confidential (default) |
| `default_on` | Confidential by default, can be changed |
| `default_off` | Not confidential by default, can be changed |
| `nil` | Inherit from level above |
