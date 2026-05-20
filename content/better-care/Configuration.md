---
title: Configuration
tags:
  - references
---

[[Better Care]] uses a central `Configuration` model for storing JSON config on records. Direct writes are banned by a custom RuboCop cop — use the safe API instead.

## Safe API

```ruby
# Fetch or create config for a record
config = Configuration.fetch_or_create_for!(record, initial_config: { key: 'value' })

# Merge a patch (thread-safe, deep merge by default)
config.merge_config!(key: 'value')

# Full replace of a specific key (e.g. for arrays)
config.merge_config!({ items: [...] }, replace_keys: ['items'])

# Block form — receives current config snapshot
config.merge_config! do |current|
  current.merge('key' => computed_value)
end
```

`fetch_or_create_for!` locks the record and retries once on unique constraint races.

`merge_config!` acquires a database lock, deep merges the patch, and skips the write if nothing changed.

## What's banned

```
# These trigger the SafeConfigurationWrites RuboCop cop:
record.create_configuration!
record.configuration.config = { ... }
record.configuration.update(config: { ... })
```

The only exception is `organisation_unit.rb`, which needs full key replacement for explicit removals.
