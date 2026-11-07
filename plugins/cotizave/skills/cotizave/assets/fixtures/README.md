# V2 and migration fixtures

Synthetic examples for testing V2 integrations in **any** language without calling the real API. Fixtures without the `v2-` prefix are old V1 snapshots and are used **only to compare behavior during a V1 → V2 migration**; they are not examples for a new integration. Each file is:

```json
{ "status": 200, "headers": { "...": "..." }, "body": { } }
```

`raw` replaces `body` when the response is not valid JSON. Serve the files from a fake HTTP server (or your framework's HTTP mock) and point the client at it with a placeholder key such as `test_api_key`.

## V2 cases

| Fixture | What the client must do |
|---|---|
| `v2-ve-restricted.200.json` | Recognize an ID-only restricted row with no `mid` or timestamps; it is not a zero-valued rate |
| `v2-rate-unavailable.503.json` | Preserve the HTTP status of a known rate without a current observation. The error body is illustrative: use the official error reference for exact codes and keep the status when an intermediary changes the body |
| `v2-ve-rates-migration.200.json` | Read canonical IDs and optional fields from a V2 response |
| `v2-bulk-partial.200.json` | Inspect every result: HTTP 200 can include a per-item error. Never report a partial success as a wholly successful V1-style result; amounts and error text are illustrative |

For a migration, compare `rates.200.json` with `v2-ve-rates-migration.200.json`: the selected VE prices, markets, value dates and source times match in this synthetic pair, while V2 adds canonical IDs and may return fewer rows. Do not compare entire JSON bodies or require every V1 row in V2.

## V1 snapshots: migration only

| Fixture | What to compare with the old client |
|---|---|
| `rates.200.json` | Parse; look up by `market`; `eur_reference` has base EUR |
| `rate-reference.200.json` | Parse one rate; absent `ask`/`bid` are not `0` |
| `rate-eur-reference-no-base.200.json` | Without `base`, the base-currency helper returns `EUR` |
| `convert.200.json` | Read `to.amount`, `effective_date` and `stale` |
| `bulk-convert.200.json` | `results[i]` corresponds to `amounts[i]` |
| `history-point.200.json`, `history-collection.200.json` | Point mode (object) and collection mode (`points[]`) |
| `malformed.200.json` | A `2xx` with broken JSON is an error, not "no data" |
| `redirect-302.json` | Do not follow the redirect; the key never reaches another host |
| `error-400-unknown-parameter.json` | Typed error with `code` and `field`; no retry |
| `error-401-invalid-api-key.json` | No retry; the key does not appear in the error |
| `error-402-feature-not-in-plan.json` | No retry; expose `details.feature` |
| `error-429-burst.json` | Retry after `X-RateLimit-Retry-After-Ms` (40 ms), bounded |
| `error-429-burst-scope-in-body.json` | No scope header: take it from `details.kind` and retry |
| `error-429-monthly.json` | **Do not** retry; expose `X-RateLimit-Reset` |
| `error-429-no-scope.json` | Do not retry; expose `Retry-After` (3600) |
| `error-500-internal.json` | Bounded retry with backoff + jitter |
| `error-503-service-unavailable.json` | Retry after `Retry-After` (1 s), bounded |
| `error-503-retry-after-long.json` | `Retry-After` (120 s) exceeds the maximum wait: fail without sleeping |

Numbers are illustrative. Cases that need no fixture: a key with a trailing newline is trimmed; a key with invalid characters is not sent; a network error on the bulk `POST` is not retried.

The earlier review declared verification against the backend, but no captures or contract identifier were attached, so these files are not proof of conformance of the current service. They are versioned with the skill; run every test against local transport. The [historical documentation review](../../references/contract-evidence.md) identifies the scope of the V1 snapshots; it does not certify the V2 contract.

## Historical sequences for testing fallback during a migration

These sequences use the old V1 fixtures. Use them only to preserve an application's behavior while it migrates to V2, with a controlled clock and local transport. The fallback policy belongs to the application: these sequences add no fields or endpoints to Cotizave.

| Sequence | Expected result |
|---|---|
| `rates.200.json` → `error-503-service-unavailable.json`, with a fallback within the display tolerance | Retries within budget, then the last good value, identified and keeping market, currency and dates |
| The same sequence with the clock advanced past the tolerance | Unavailable; do not return zero or present the fallback as current |
| `error-503-service-unavailable.json` with an empty cache | Recoverable error and no invented rate |
| `rates.200.json` → `malformed.200.json` | Protocol error; do not overwrite the last good value with invalid content |
| `rates.200.json` → `error-429-monthly.json` → another query before the reset | Send no further upstream request; use the fallback only if the policy allows it |
| Failure → `rates.200.json`, once querying again is allowed | Validate the response, update the cache and leave the degraded state if the value meets the validity rule |
| Successive 200 responses with the same old `updated_at` | Do not renew the value's tolerance just because it was downloaded again |
| A fallback without proven validity when fixing an amount | Do not issue the invoice; preserve previously issued documents |

Pin the clock relative to the fixture dates, not to the real test date. Also test the exact boundary of the agreed limit and a cancellation: it must not start new queries or turn the cancelled operation into a success served from cache. These are tests to implement and run in the consuming client, not results already verified by this package.
