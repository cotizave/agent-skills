# V2 HTTP contract

Documented in [official endpoints](https://docs.cotizave.com/api/v2/endpoints.md), [data dictionary](https://docs.cotizave.com/api/v2/data-dictionary.md), [coverage](https://docs.cotizave.com/api/v2/coverage.md) and [plans](https://docs.cotizave.com/api/v2/plans.md). The 2026-10-31 local documentation source and backend launch registry agree on 29 published countries; verify the deployed API separately. This is a compact route index, not a production test. Base `https://api.cotizave.com`, header `X-API-Key`; `{CC}` is an ISO two-letter country code for a published country. Use the returned canonical `id`. All authenticated routes accept `format=json|csv|xml`; CSV/XML require Growth. Unlisted or repeated query parameters return 400.

| Operation | Method and route | Key inputs / constraints |
|---|---|---|
| Country rates | `GET /v2/fx/{CC}/rates` | Optional `tag`, `category`, `base`, `quote`; `markup` only VE with Growth and an active rule. A missing observation can omit a rate. |
| One rate | `GET /v2/fx/{CC}/rates/{id}` | 402 inaccessible, 404 unknown/wrong country, 503 no current observation. |
| History | `GET /v2/fx/{CC}/rates/{id}/history` | `date` alone for a point; `from`/`to`, optional `granularity=daily|raw`; only raw mode accepts `cursor`, `limit` (1–5000). Retention and series availability vary. |
| Market catalogue | `GET /v2/fx/{CC}/markets` | Growth; includes conversion directions, availability and required plan, without prices. |
| Spread | `GET /v2/fx/{CC}/spread` | Growth; optional `against`, `base`; country official reference comparison. |
| Route | `GET /v2/fx/{CC}/route` | Pro; required `from`, `to`, `amount`; optional `direction=send|receive`, `max_staleness` seconds. Supported pairs vary. |
| Bank board | `GET /v2/fx/{CC}/bank-rates` | Optional `bank`; 404 `bank_rates_not_available` where absent. |
| Convert | `GET /v2/fx/convert` | Required `from`, `to`, positive `amount` ≤ 1e12; optional `via`, `date`; `market` is a VE V1 alias. Historical conversion needs Growth. Default is a compatible reference: choose `via` explicitly when meaning matters. |
| Cross-currency conversion | `GET /v2/fx/convert` | For supported pairs without a direct quote, omit `via`: the response includes `legs`. An explicit `via` for such a pair returns `400 invalid_format`; do not assume a single direct rate. |
| Bulk convert | `POST /v2/fx/convert` | Pro; JSON `{"conversions":[{"from","to","amount","via"?,"date"?}]}` (1–50). Also accepts the V1 body. Each `results` item has `index` and either `conversion` or `error`; HTTP 200 can include item failures. No-store. |
| Country/currency catalogues | `GET /v2/countries`, `GET /v2/countries/{CC}`, `GET /v2/currencies`, `GET /v2/currencies/{code}` | Pro. These enumerate published countries/ISO currencies; absence of Pro does not block country rates. |
| Bank catalogue | `GET /v2/banks/{CC}`, `GET /v2/banks/{CC}/{code}` | Optional `q` on collection. Bank catalogue and bank board are different resources. |
| Holidays | `GET /v2/holidays/{CC}` | Basic; at most one of `year`, `date`, `from`. |
| Business days | `GET /v2/holidays/{CC}/business-days` | Basic; required `days` 0–3650, optional `from`. |
| Stable references | `GET /v2/crypto`, `GET /v2/crypto/{id}` | Individual details need Growth; these USD references cannot be used as local-currency `via`. |
| Official issuers | `GET /v2/issuers` | Authenticated; available from Free. Returns issuer metadata, not a live rate. |

For countries other than Venezuela, the maintainer confirms that Free can request every published rate; published access does not guarantee a current observation. Venezuela retains per-rate restrictions. Verify the account response because legacy entitlements may differ.

Published country-rate routes and conversion support are separate. A currency pair can be convertible without its country being listed in `/v2/countries` or having `/v2/fx/{CC}/rates`; do not present a conversion-only country as published rate coverage. Check the current coverage page and the API response rather than carrying a saved country list into an integration.

Free rate fields are not the Growth schema: `id`, `market`, `type`, `mid`, `updated_at` are the core of an available rate; `base`, `effective_date`, `bid`, `ask` and `stale_after_sec` depend on source and legacy rules. Basic adds identity/freshness fields; Growth adds descriptions, tags and analysis, some nullable. A restricted VE row can be an ID-only descriptor without price. The same rate ID can have different field sets by plan; parse optional values by presence and use the `stale_after_sec` returned with that observation rather than a fixed country or plan threshold. If it differs across plans, do not assume the source price or entitlement changed. `fetched_at` is the collection retrieval time; `updated_at` is source time; `effective_date` is value date. See [plan matrix](https://docs.cotizave.com/api/v2/plans.md) before consuming optional fields.

See the official [conversion](https://docs.cotizave.com/api/v2/convert.md), [history](https://docs.cotizave.com/api/v2/history.md), [reference data](https://docs.cotizave.com/api/v2/reference-data.md) and [advanced operations](https://docs.cotizave.com/api/v2/advanced.md) pages for full response schemas. Never infer a response from an illustrative example.

Commercial use and redistribution are governed by the [official data-use rules](https://docs.cotizave.com/data-use.md); consult them for the application’s distribution model. Do not infer permission from endpoint access.
