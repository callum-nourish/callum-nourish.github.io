---
title: Fixing N+1s
tags:
  - internals
---

An N+1 is when ActiveRecord queries the database once per record instead of once for the whole collection.

```ruby
# Bad — 11 queries
clients = Client.limit(10)
clients.each { |c| puts c.address.postcode }

# Good — 2 queries
clients = Client.includes(:address).limit(10)
clients.each { |c| puts c.address.postcode }
```

## Finding them

- **ScoutAPM** — enabled on Beta and Staging. Lists N+1s by impact, shows SQL and backtraces.
- **[[AppSignal]]** — all environments. Slow queries shows impactful SQL but doesn't flag N+1s directly.

## Fixing them with Bullet

Add to `config/environments/development.rb` and restart:

```ruby
config.after_initialize do
  Bullet.enable = true
  Bullet.raise = true
end
```

Call the endpoint (e.g. via Postman with an `x-api-key` header). Bullet will raise with the suggested fix and the source location.

## Where N+1s usually live

Serializers. Most serializers have a `self.preload_associations` method — this is usually where the fix goes:

```ruby
def self.preload_associations(relation, options)
  return relation if options.dig(:scope, :short)
  relation.preload(:organisation_units, person: %i[user addresses])
end
```

If you're not seeing a Bullet error, make sure your test data has enough associated records to trigger the N+1.
