# V1 to V2 migration

[Official migration guide](https://docs.cotizave.com/api/v2/migration.md). Keep V1 active unless the user requests migration; test each consumer before switching.

| V1 | V2 |
|---|---|
| `/v1/fx/rates`, `/rates/{market}`, `/rates/{market}/history` | `/v2/fx/ve/rates`, `/rates/{id}`, `/rates/{id}/history` |
| `GET /v1/fx/convert`, `POST /v1/fx/bulk/convert` | `GET /v2/fx/convert`, `POST /v2/fx/convert` |
| `/v1/fx/markets`, `/spread`, `/route` | `/v2/fx/ve/markets`, `/spread`, `/route` |
| `/v1/fx/bcv/banks` | `/v2/fx/ve/bank-rates` |
| `/v1/fx/index` | `index` inside `/v2/fx/ve/rates` |

V2 adds global `id`; VE `market` remains a local identifier and some local aliases resolve on individual routes. Use the returned ID, since the mapping is not a string transform (`reference` maps to `ve-bcv`). V2 Free preserves key VE price/time fields, but higher plans add optional metadata. The V1 public endpoints and flat BCV currencies response have no identical V2 JSON. `required_plan` in V2 markets is an internal ID. `effective_date`, `updated_at` and `fetched_at` have different meanings. V2 bulk accepts a new per-item format and can return item errors inside HTTP 200. V2 historical retention, conversion permissions and errors must be checked against the account, not assumed from V1. See [V1 details](endpoints.md), [V2 details](api-v2.md), and [official guide](https://docs.cotizave.com/api/v2/migration.md).
