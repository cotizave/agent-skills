# V2 caching and freshness

Different countries, sources and plans can expose different observations and metadata. Fetch the relevant V2 rate or board from the [V2 contract](api-v2.md). Derive refresh cadence from the product's actual need, the source's publication rhythm and the account's [quota](errors-and-limits.md#plans-and-quotas); do not apply one fixed TTL to every country.

## Interpret timestamps

- `updated_at` identifies the source observation time when provided. A successful download does not make an old observation newer.
- `fetched_at` identifies retrieval time. It is not a substitute for source time or value date.
- `effective_date`, when provided, is a value date. Its business meaning depends on the source and country.
- `stale_after_sec`, when provided, is the source's threshold for that observation. Reassess age when reading a cached rate; do not preserve a cached `stale: false` forever.

Optional fields may be absent because of plan, source or availability. An ID-only restricted descriptor is not a zero-valued rate. An unavailable rate may be absent from a board or return an error when requested alone. Persist the chosen rate ID, value, source, currency pair and relevant timestamps for a fixed transaction.

## Cache design

Cache only compatible responses. Include API version, account, country, rate ID, endpoint, query parameters, output format and entitlement-sensitive representation in cache identity as needed. Do not share a paid representation with another account. Use a shared cache or one refresher if independent workers would exhaust quota; a per-process cache can suffice when usage is small.

Estimate calls before choosing a TTL: one request every `N` seconds is about `2,592,000 / N` requests in 30 days, before other endpoints and retries. Historical dates well outside a mutable window can have a longer TTL than current data. Treat an HTTP `304` as unchanged representation, not a new source observation. Coordinate simultaneous misses when necessary; release locks on error or cancellation.

The browser must call the application's backend, which owns the key and cache. Do not expose `COTIZAVE_API_KEY` to client code. Cache freshness, source freshness and permission to use a quote for a business operation are separate decisions.

## Fallback policy

Follow the application's existing rule for timeout, source failure and exhausted quota. If no rule exists, identify the required freshness and source before using a fallback. A last known rate may be displayed only within an agreed tolerance, labelled with its rate ID, source, timestamp and degraded state. For a transaction that fixes an amount, require the business's admissibility rule; otherwise stop that operation with a recoverable error.

Never substitute zero, an invented value, a different market, a different direction or a current quote for a missing historical value. Re-evaluate age from the original observation, not from cache insertion or repeated downloads. Credentials and permission failures are operational errors; do not hide them behind a seemingly healthy fallback. Validate a recovered response before replacing the last good value, and do not recompute completed transactions.
