# Endpoint reference

> **For V1 → V2 migration only.** V1 is deprecated. This snapshot exists to identify the contract of an old client while following the [migration guide](migration-v1-v2.md). Every new integration uses [V2](api-v2.md); do not implement V1 endpoints from this reference.

Base URL `https://api.cotizave.com`. Every route requires the `X-API-Key` header with the key that the application's backend obtains from its own configuration or secret manager.
Example responses are trimmed; the numbers are illustrative.
See the [contract evidence](contract-evidence.md) for the scope of the public
review and its differences from legacy examples.

Common rules:

- `/convert`, `/spread`, `/route` and `/history` reject unknown query parameters
  with `400 unknown_parameter` (the `field` names the parameter and the
  `message` lists the accepted ones). The rest ignore them silently: do not send
  parameters that are not in this reference.
- `?format=csv|xml` (or the `Accept: text/csv` / `application/xml` header) works on
  all of these endpoints from the Growth plan up. See
  [errors-and-limits.md](errors-and-limits.md#csv-and-xml-formats).
- Values are JSON numbers. Preserve precision and apply the business rounding
  when fixing amounts; display formatting is independent. See
  [money and persistence](integration-patterns.md#money-and-persistence).
- Every rate expresses **VES per 1 unit of the base currency** (USD, except
  `eur_reference`, which is EUR).

Contents:
[/v1/fx/rates](#get-v1fxrates) ·
[/v1/fx/rates/:market](#get-v1fxratesmarket) ·
[/v1/fx/convert](#get-v1fxconvert) ·
[/v1/fx/bulk/convert](#post-v1fxbulkconvert) ·
[/v1/fx/spread](#get-v1fxspread) ·
[/v1/fx/index](#get-v1fxindex) ·
[/v1/fx/rates/:market/history](#get-v1fxratesmarkethistory) ·
[/v1/fx/route](#get-v1fxroute) ·
[/v1/fx/bcv/banks](#get-v1fxbcvbanks) ·
[/v1/fx/bcv/currencies](#get-v1fxbcvcurrencies)

---

## GET /v1/fx/rates

Full snapshot: every rate your plan includes + Cotizave Index. It is the main
endpoint. No parameters (except `format`).

```json
{
  "country": "VE",
  "currency": "VES",
  "base": "USD",
  "rates": [
    { "market": "reference", "type": "reference", "base": "USD", "mid": 877.9023,
      "updated_at": "2026-10-14T04:00:00Z", "effective_date": "2026-10-14" },
    { "market": "eur_reference", "type": "reference", "base": "EUR", "mid": 982.7589,
      "updated_at": "2026-10-14T04:00:00Z", "effective_date": "2026-10-14" },
    { "market": "parallel", "type": "parallel", "base": "USD", "mid": 1009.6971,
      "updated_at": "2026-10-14T21:01:08Z" },
    { "market": "binance", "type": "p2p", "base": "USD", "ask": 1012.40, "bid": 1010.70,
      "mid": 1011.55, "updated_at": "2026-10-15T03:30:10Z" }
  ],
  "index": {
    "value": 971.0851, "version": "v1", "as_of": "2026-10-15T03:31:30Z",
    "weights": { "bcv": 0.30, "paralelo": 0.20, "p2p": 0.50 },
    "components": { "bcv": 877.9023, "paralelo": 1009.6971, "p2p": 1011.55 },
    "p2p_median": 1011.55, "p2p_count": 7, "flags": {}
  },
  "fetched_at": "2026-10-15T03:31:30Z"
}
```

Fields of each `rates[]` element:

| Field | Notes |
|---|---|
| `market` | Identifier (see the [Venezuela market IDs](migration-v1-v2.md#venezuela-market-ids) table for the V2 equivalents). |
| `type` | `reference`, `parallel`, `p2p`; payment markets can also be `remittance`, `cash`, `exchange_house`, among others. Handle unknown values without breaking. |
| `base` | `USD` or `EUR`. May be missing: if it is, assume USD except for `eur_reference`. |
| `ask` / `bid` | Only on the markets that publish buy and sell (parallel, P2P). Omitted on `reference`. |
| `mid` | Always present. Use this one. |
| `updated_at` | ISO 8601 update timestamp. Do not require a fixed time for BCV and do not confuse it with the local download time; use `effective_date` for the value date. |
| `effective_date` | `YYYY-MM-DD`, only on `reference`/`eur_reference`. Value date. |
| `stale_after_sec` | Optional. Freshness threshold of the market, in seconds; if present, it overrides any default threshold. |

- The order of `rates[]` is not guaranteed: look up by `market`.
- Markets outside your plan are omitted silently (there is no 402 here).
- A P2P with no quote at that moment may not appear, and new markets or
  `type` values may appear: do not validate against a closed list.

## GET /v1/fx/rates/:market

A single rate. Same object as one element of `rates[]`. No query parameters.

```json
{ "market": "reference", "type": "reference", "base": "USD", "mid": 877.9023,
  "updated_at": "2026-10-14T04:00:00Z", "effective_date": "2026-10-14" }
```

Errors: `404 resource_not_found` (nonexistent market or absent from the snapshot),
`402 feature_not_in_plan` (gated market: `details.feature` = `remittance`,
`extended_markets` or `cash_markets`, plus `details.market`).

Rule of thumb from the docs: 1–2 rates → this endpoint; more → `/v1/fx/rates`.

## GET /v1/fx/convert

Converts an amount. All plans.

| Param | Req. | Values |
|---|---|---|
| `from` | yes | `USD`, `EUR`, `VES` |
| `to` | yes | `USD`, `EUR`, `VES` (≠ `from`; one of the two **must** be `VES`) |
| `amount` | yes | number > 0 and ≤ 1e12 |
| `via` | no | any market in the snapshot. **Default: `reference` (BCV) for USD, `eur_reference` for EUR** |
| `market` | no | alias of `via` (if both are sent, `via` wins) |

```json
{
  "from": { "currency": "USD", "amount": 100 },
  "to":   { "currency": "VES", "amount": 87790.23 },
  "rate": 877.9023,
  "market": "reference",
  "type": "reference",
  "updated_at": "2026-10-14T04:00:00Z",
  "effective_date": "2026-10-14",
  "staleness_sec": 84690,
  "stale": false
}
```

- `to.amount = amount × rate` when converting into VES; `amount / rate` when converting out of VES.
- `effective_date` only with `reference`/`eur_reference`: archive it if you invoice.
- `staleness_sec` = age in seconds; `stale` = it exceeded that market's threshold.
- `400 invalid_format` with `field: "via"` if the market quotes in another currency
  (e.g. `eur_reference` with `from=USD`) or if you request VES→USD through a remittance market
  (`paypal`, `zelle`, `western_union`).
- Other errors: `400 missing_field` (`from` or `to` missing), `400 invalid_format`
  (`amount` not numeric, ≤ 0 or > 1e12; unsupported or identical currencies),
  `402 feature_not_in_plan` (gated `via`), `404 resource_not_found` (nonexistent `via`).
- If you convert many amounts per minute, fetch `/v1/fx/rates` once and multiply yourself.

## POST /v1/fx/bulk/convert

Up to 50 amounts with **one** rate, 1 quota unit. **Pro plan or higher only**
(`402 feature_not_in_plan`, `details.feature: "bulk_convert"` on the others). Additional
limit of 300 calls per hour: exceeding it → `429 rate_limit_exceeded` **without**
`X-RateLimit-Scope` and with `Retry-After: 3600` (do not retry before then).

Body (JSON):

| Field | Req. | Notes |
|---|---|---|
| `from` | yes | `USD` or `VES` |
| `to` | yes | `VES` or `USD`, different from `from` |
| `amounts` | yes | `number[]`, 1 to 50 elements, each > 0 and ≤ 1e12 |
| `market` | no | default `reference`. Must quote in USD; for VES→USD it must support both directions. An EUR base or a remittance in the reverse direction returns `400 invalid_format` (`field: "market"`). |

```json
{
  "rate": 1009.6971, "market": "parallel", "type": "parallel",
  "updated_at": "2026-10-14T21:01:08Z",
  "results": [
    { "amount": 100, "result": 100969.71 },
    { "amount": 250, "result": 252424.28 },
    { "amount": 500, "result": 504848.55 }
  ],
  "total_in": 850, "total_out": 858242.54
}
```

`results[i]` corresponds to `amounts[i]`. Headers: `X-RateLimit-Cost: 1`,
`X-Bulk-Operations: <n>`, `X-Bulk-RateLimit-Limit` and `X-Bulk-RateLimit-Remaining`.
Errors: more than 50 amounts → `400 invalid_format` (`field: "amounts"`,
`details: {max, got}`); empty list → `400 missing_field`; an amount ≤ 0 or > 1e12 →
`400 invalid_format`; invalid JSON or incompatible `market` → `400 invalid_format`; gated `market` → `402`;
market without a valid quote → `503`. **Unknown body fields are ignored
silently**: a `via` is discarded and `reference` is used; `items` without `amounts` → `400
missing_field`. Neither `items` nor `via` exists on this endpoint: if you see examples like that, they are
outdated.

## GET /v1/fx/spread

Gap between BCV (`reference`) and another market. Growth or higher.

| Param | Default | Values |
|---|---|---|
| `against` | `parallel` | `parallel`, any P2P (`binance`, `bybit`, …) or another market in your plan; not `reference` |
| `base` | `USD` | `USD` only |

```json
{
  "reference": { "market": "reference", "value": 877.9023, "updated_at": "2026-10-14T04:00:00Z" },
  "compared":  { "market": "binance",   "value": 1011.55,  "updated_at": "2026-10-15T03:30:10Z" },
  "spread": { "absolute": 133.6477, "percentage": 15.22, "direction": "higher" },
  "fetched_at": "2026-10-15T03:31:30Z"
}
```

`direction`: `higher` | `lower` | `equal`. Errors: `400 invalid_against` (nonexistent
market, `reference`, EUR-based **or absent from the snapshot at that moment**, e.g.
a P2P that is not quoting), `400 invalid_base`, `402 feature_not_in_plan` (gated
market), `422 reference_unavailable` / `422 compared_unavailable` (the rate is present but
without a valid value).

## GET /v1/fx/index

Cotizave Index: VES per 1 USD weighted BCV 30 % + parallel 20 % + P2P median 50 %.
All plans. No parameters. Also embedded in `/v1/fx/rates` (`index`).

```json
{
  "value": 971.0851, "version": "v1", "as_of": "2026-10-15T03:31:30Z",
  "weights": { "bcv": 0.30, "paralelo": 0.20, "p2p": 0.50 },
  "components": { "bcv": 877.9023, "paralelo": 1009.6971, "p2p": 1011.55 },
  "p2p_median": 1011.55, "p2p_count": 7,
  "flags": {},
  "methodology_url": "https://cotizave.com/docs/cotizave-index"
}
```

`flags` (all optional): `bcv_stale` (BCV > 132 h without renewal; its weight is
redistributed and `weights` changes), `degraded` (< 4 P2P exchanges), `missing_sources`,
`outliers_excluded`. Read the effective `weights`; do not assume 30/20/50.

## GET /v1/fx/rates/:market/history

History of a market. All plans; **depth depends on the plan** (see the
"History" column in [errors-and-limits.md](errors-and-limits.md#plans-and-quotas)).

`:market`: any market in the catalog (`reference`, `eur_reference`, `parallel`,
the P2Ps…). Gated ones require their feature (`402`). With `?date=` and no records →
`404`; in collection mode, a range without data (or a nonexistent market) responds `200`
with `count: 0` and `points: []`: do not assume there is data.

| Param | Mode | Notes |
|---|---|---|
| `date` | point | `YYYY-MM-DD` (UTC). Returns **1 object**: the last record captured **on or before** that date. Cannot be in the future. |
| `from`, `to` | collection | `YYYY-MM-DD`, inclusive. Default: from the oldest your plan allows up to today. A future `to` is clamped to today. |
| `granularity` | collection | `daily` (default, one close per day) or `raw` (every capture, max. 5,000 points: the **most recent** are kept, `truncated: true` and the response's `from` moves to the first returned point). |

No parameters → collection with your whole retention window.

```json
{ "market": "reference", "date": "2026-10-04", "rate": 870.12,
  "updated_at": "2026-10-02T04:00:00Z", "captured_at": "2026-10-03T20:35:12Z" }
```

```json
{
  "market": "binance", "from": "2026-10-01", "to": "2026-10-07",
  "granularity": "daily", "count": 7,
  "points": [
    { "date": "2026-10-01", "rate": 995.20, "updated_at": "…", "captured_at": "…" }
  ]
}
```

For BCV, a day's `rate` is the rate that was published when captured: check
its `updated_at` (value date) before assuming it applies on that same day. In the example,
Sunday the 4th is governed by the rate with value date Friday the 2nd. `date` is interpreted in UTC,
while the BCV value date follows the Caracas calendar (UTC−4).

Errors: `400 invalid_format` (malformed or future date, `from > to`, invalid
granularity), `403 history_out_of_retention` (older than your plan allows;
`details.max_days`), `404 resource_not_found` (no records on or before that date),
`503 service_unavailable` (history temporarily unavailable), `504 query_timeout`
(range too heavy: narrow it).
Data from the last few days may be adjusted: cache long-term only the dates
older than 3 days and revalidate anything that includes the last 3 days (TTL
≤ 1 h).

## GET /v1/fx/route

Best executable market for a USD↔VES amount + sorted alternatives. **Pro plan
or higher only**: on the others → `402 feature_not_in_plan` with `details.feature: "route"`

| Param | Req. | Default | Notes |
|---|---|---|---|
| `from`, `to` | yes | — | `USD`/`VES` |
| `amount` | yes | — | > 0 and ≤ 1e12 |
| `direction` | no | `send` | `send` = maximize the destination amount; `receive` = sort by the lowest destination amount |
| `max_staleness` | no | `0` | seconds; `0` = no filter |

```json
{
  "from": { "currency": "USD", "amount": 1000 },
  "direction": "send",
  "best": { "market": "mexc", "type": "p2p", "rate": 1015.10, "amount": 1015100.00,
            "updated_at": "2026-10-15T03:30:10Z", "staleness_sec": 80 },
  "alternatives": [ { "market": "binance", "type": "p2p", "rate": 1011.55, "amount": 1011550.00,
                      "updated_at": "2026-10-15T03:30:10Z", "staleness_sec": 80 } ],
  "skipped": [ { "market": "reference", "reason": "not_executable" } ],
  "fetched_at": "2026-10-15T03:31:30Z"
}
```

`skipped[].reason`: `not_executable` (BCV references and exchange houses are not a
market), `currency_mismatch` (`eur_reference`), `feature_not_in_plan`,
`one_way_market` (remittances in VES→USD), `no_quote`, `stale` (exceeded `max_staleness`).
`skipped` is omitted when empty.
If no market qualifies → `503 service_unavailable`. In CSV it responds `406` (two
collections); use JSON or XML.

## GET /v1/fx/bcv/banks

USD buy/sell per institution, as published by the BCV, once a day. All
plans. No parameters.

```json
{
  "indicator_date": "2026-10-13",
  "bank_rates": [
    { "bank": "Banesco", "buy": 875.10, "sell": 880.25 },
    { "bank": "N58 Banco Digital", "buy": 876.00, "sell": 879.90 },
    { "bank": "Otras Instituciones", "buy": 874.80, "sell": 881.00 }
  ],
  "captured_at": "2026-10-14T12:15:03Z"
}
```

- The list of banks **varies from day to day** (the BCV rotates institutions): do not assume a
  fixed list and do not normalize names (`bank` arrives as published by the BCV).
- `404 bcv_snapshot_unavailable` if the day's publication is not available yet.

## GET /v1/fx/bcv/currencies

Official BCV rates for EUR, CNY, TRY and RUB (VES per unit). USD is not here (it is
in `/v1/fx/rates/reference`). Same daily publication as `/bcv/banks`. All plans.

```json
{
  "reference_value_date": "2026-10-14",
  "reference_value_date_text": "Martes, 14 Octubre 2026",
  "rates": { "EUR": 982.7589, "CNY": 123.21, "TRY": 21.03, "RUB": 10.87 },
  "captured_at": "2026-10-14T12:15:03Z"
}
```

For accounting use `reference_value_date` (value date), not `captured_at`.

---

## Outside this reference

Other Venezuela utilities exist (bank catalog, RIF and bank account
validation, holidays and business days) that are **not** part of the public
API reference and may not be enabled for your account (they respond
`403 endpoint_disabled`). Do not use them without first confirming at
https://cotizave.com/docs or with support@cotizave.com.
