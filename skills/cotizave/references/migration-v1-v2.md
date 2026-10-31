# V1 to V2 migration

[Official migration guide](https://docs.cotizave.com/api/v2/migration.md). Keep V1 active unless the user requests migration; test each consumer before switching.

## Procedure for an existing project

Apply this in the language, framework and HTTP client already used by the project. The user need only request migration and provide access to the project; discover implementation details from its code and tests.

1. Find all Cotizave V1 requests, including shared clients, wrappers, background jobs, browser-facing endpoints, fixtures, mocks and stored rate data. Record the route, query/body, chosen market, plan-dependent operation, response fields and downstream consumers for each call. Identify the application's own public contract before editing it. Search configuration and deployment settings for versioned URLs too; read only the Cotizave setting, never dump the environment or secret files.
2. Match each operation to the V2 route below and the current [official migration guide](https://docs.cotizave.com/api/v2/migration.md). For VE rate selection, use an `id` returned by Cotizave or the official mapping; do not generate one from `market`. Keep the existing rate's meaning, base currency and conversion direction. Check plan access and historical retention separately for each operation. Do not require a Pro-only catalogue just to discover rates on Free.
3. Build or update a version-specific adapter at the HTTP boundary. Translate V2 data to the application's existing types and output only where consumers require the old shape. Keep the original V1 path available until the V2 behavior is verified; do not mix V1 and V2 response objects in one cache entry. Preserve account isolation, source timestamps, error codes and decimal/rounding behavior. Avoid a second network call solely to compare versions in a production request path: it changes latency and quota use.
4. Test the observed V1 behaviors against local V1 and V2 fixtures or mocked HTTP: successful rate and conversion, missing or restricted rate, absent optional fields, freshness and date value, errors, plan gates, and every public response that callers depend on. For bulk conversion, inspect every result even when HTTP is 200. Do not use a production key or spend live quota for tests.
5. Switch consumers only after their contract tests pass. If the project has a deployment or rollback mechanism, use it; otherwise keep the V1 adapter until the V2 path is proven in that project. For a persisted data change, use a reversible schema transition that can read old rows and do not backfill a missing historical rate with today's quote. Report changed calls, verified behavior, remaining account-specific checks and any V1 operation that must remain on V1.

Ask the user only when the repository and current contract cannot answer a material business choice, such as whether an old public response may change or which rate to use when its original source has no V2 equivalent. Do the independent migration work first.

### Acceptance and rollback

Compare the application's observable results, not raw V1 and V2 JSON. For the same synthetic observation, assert selected source/market, base and quote, rate and converted amount, rounding, value date, source time, freshness decision, error classification and output shape. Check request count and cache identity when they affect quota or tenants. Historical points may differ in coverage; an absent point is not zero or a current-rate fallback. Keep old stored identifiers readable until all consumers and records are migrated. Never rewrite past invoices or recompute their amounts from a current quote.

Use the project's existing release mechanism for a gradual switch when possible. A rollback must restore the previous consumer path without deleting newly written data or requiring a database downgrade. Remove the V1 adapter only after the project has evidence that no remaining consumer uses it. If V2 access cannot be verified with the user's account without a live call, finish all local work and report that specific check as unverified; do not request or print the API key.

## Route mapping

| V1 | V2 |
|---|---|
| `/v1/fx/rates`, `/rates/{market}`, `/rates/{market}/history` | `/v2/fx/ve/rates`, `/rates/{id}`, `/rates/{id}/history` |
| `GET /v1/fx/convert`, `POST /v1/fx/bulk/convert` | `GET /v2/fx/convert`, `POST /v2/fx/convert` |
| `/v1/fx/markets`, `/spread`, `/route` | `/v2/fx/ve/markets`, `/spread`, `/route` |
| `/v1/fx/bcv/banks` | `/v2/fx/ve/bank-rates` |
| `/v1/fx/index` | `index` inside `/v2/fx/ve/rates` |

V2 adds global `id`; VE `market` remains a local identifier and some local aliases resolve on individual routes. Use the returned ID, since the mapping is not a string transform (`reference` maps to `ve-bcv`). V2 Free preserves key VE price/time fields, but higher plans add optional metadata. The V1 public endpoints and flat BCV currencies response have no identical V2 JSON. `required_plan` in V2 markets is an internal ID. `effective_date`, `updated_at` and `fetched_at` have different meanings. V2 bulk accepts a new per-item format and can return item errors inside HTTP 200. V2 historical retention, conversion permissions and errors must be checked against the account, not assumed from V1. See [V1 details](endpoints.md), [V2 details](api-v2.md), and [official guide](https://docs.cotizave.com/api/v2/migration.md).

## Venezuela market IDs

These pairs are documented for the published VE snapshot. Use the IDs actually returned for the account when available. The table is a lookup for existing V1 markets, not a rule for deriving future IDs. Extra BCV references in V2 do not replace V1 markets.

| V1 `market` | V2 `id` | V1 `market` | V2 `id` |
|---|---|---|---|
| `reference` | `ve-bcv` | `eur_reference` | `ve-euro` |
| `parallel` | `ve-paralelo` | `binance` | `ve-binance` |
| `bybit` | `ve-bybit` | `okx` | `ve-okx` |
| `bitget` | `ve-bitget` | `mexc` | `ve-mexc` |
| `bingx` | `ve-bingx` | `saldo` | `ve-saldo` |
| `syklo` | `ve-syklo` | `yadio` | `ve-yadio` |
| `zelle` | `ve-zelle` | `paypal` | `ve-paypal` |
| `western_union` | `ve-wu` | `zoom` | `ve-zoom` |
| `cash` | `ve-cash` | `cucuta` | `ve-cucuta` |

## Compatibility points to check in code

| Existing V1 assumption | V2 adaptation |
|---|---|
| `market` is the route identifier | V2 routes use global `id` (for example, `reference` → `ve-bcv`); VE `market` remains in rate data. Keep a local mapping only for the V1 markets the project uses, based on returned/official IDs. |
| Every `rates[]` item has a price | A restricted VE descriptor may have only an ID, and an unavailable observation may be absent. Check for `mid` before using a row; never turn an absent value into zero. |
| V1 response fields and timestamps can be copied wholesale | Preserve the fields the app actually exposes. Treat plan/source-dependent V2 fields as optional; keep `updated_at` (source time), `effective_date` (value date) and `fetched_at` (retrieval time) distinct. Do not invent `category` or `as_of` on a V2 rate. |
| V1 bulk request and result shape apply unchanged | V2 POST accepts the V1 request body for migration, but returns indexed per-item `conversion` or `error`; adapt each item back to the app's contract if needed. The V2 operation requires Pro. |
| V1 endpoint availability and plan permissions carry over | Check V2 access for rates, conversion, history, market catalogue, spread and route independently. A 402 is a permission result, not a retry condition. |
| V1 historical `date` and `raw` queries have identical selection rules | V1's `date` can return the latest capture on or before the requested UTC date. V2 can return 404 when that date has no observation. V1 `raw` may truncate to recent points; V2 paginates raw captures with an opaque `next_cursor`. Verify the actual date/point semantics each consumer needs; never silently use a nearby or current point. |
| V1 bank board and spread responses are interchangeable with V2 | V2 bank rows use bank objects/codes and rate-style fields, so adapt them for any existing flat `bank`, `buy`, `sell` consumer. V2 spread requires Growth; V1 spread was available on every plan. Verify V2 `against` ID, response fields and entitlement before switching. |
| V1 bulk accepts any market that previously produced a number | V1 bulk did not fully validate base currency/direction for `market`. V2 conversion validates `via` against the requested pair. Treat a rejected mismatched market as a correction to investigate, never force the old numerically invalid result into V2. |
| A V1 public or BCV currencies response has a drop-in V2 replacement | Keep that call on V1 if its exact JSON is required, or implement and test an explicit application-level adapter. |
| The same cache key or persisted ID works across versions | Include API version and representation in cache identity; retain legacy `market` where old records or clients use it, and add `id` in a compatible field or mapping. Keep cached observations isolated by account and plan. A 304 does not renew the source timestamp. |
| The current quote can fill a missing historical record | Historical retention and coverage may differ. Preserve old records and mark missing historical data explicitly; never invent a past rate or overwrite a fixed invoice. |

For conversion, specify `via` when the existing consumer selected a market; V2 `via` takes a canonical ID, while VE `market` is a V1 alias. Without `via`, V2 chooses a compatible default reference. Verify that this preserves the existing business meaning before relying on it. A displayed rate is not necessarily an executable offer. For history, verify date/range parameters, daily versus raw granularity, cursor handling and available retention rather than assuming V1 limits. For V2, unknown query parameters and repeated parameter names are rejected, so do not carry V1 query strings wholesale. See the [conversion contract](https://docs.cotizave.com/api/v2/convert.md), [history contract](https://docs.cotizave.com/api/v2/history.md), [rates contract](https://docs.cotizave.com/api/v2/rates.md), and [local synthetic fixtures](../assets/fixtures/README.md).
