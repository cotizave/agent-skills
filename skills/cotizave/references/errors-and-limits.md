# V2 errors, quotas and response formats

Use the current [error reference](https://docs.cotizave.com/api/errors.md), [rate limits](https://docs.cotizave.com/api/rate-limits.md) and [V2 plan matrix](https://docs.cotizave.com/api/v2/plans.md) for exact entitlements. Do not hardcode a public plan's quota into a client. Account entitlements and published limits can change.

## Error handling

Check HTTP status before parsing the body. API errors normally use JSON with root-level `code` and `message`; `field` and `details` are optional. A proxy may return a non-JSON body. Branch on status and `code`, not the literal `message`.

```json
{"code":"feature_not_in_plan","message":"This feature ('response_formats') requires a plan upgrade.","details":{"feature":"response_formats","current_plan":"free"}}
```

| HTTP | Typical cause | Client action |
|---|---|---|
| `400` | Missing, invalid, unknown or repeated input | Correct the request; do not retry unchanged |
| `401` | Invalid or revoked API key | Fix the server credential; do not retry |
| `402` | Endpoint, rate or format outside the account's plan | Treat as permission; do not retry |
| `403` | Inactive account, unverified email, access control or history outside retention | Resolve the stated cause |
| `404` | Unknown resource or no data for the requested date | Check route, ID, coverage and date; never replace a missing historical point with today's value |
| `406` | Requested output format cannot represent the response | Request JSON or a supported format |
| `422` | A required reference, comparison or route is unavailable | Apply the application's explicit unavailable-data policy |
| `429` | Minute limit, monthly quota or another protection | Inspect headers and details; use the policy below |
| `5xx` | Provider, source or proxy failure | Bound GET retries by attempt count and total deadline; avoid replaying an uncertain POST |

Preserve status and structured details in application errors without exposing the API key. A displayed rate is not an executable offer.

## Plans and quotas

The monthly quota is shared by the account's keys. The minute limit is separate. Check the effective `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` when present; tolerate missing headers. The reset follows the account's cycle, which need not start on the first of the month.

Count the combined polling of every worker, endpoint and retry. Cache compatible GET results and coordinate refreshes when that reduces quota use. Access to a rate, history, conversion, analysis or output format are separate permissions. A `402` is not a transient failure.

## Handling a 429

Read `Retry-After` when present. For a short-term limit, wait within the caller's deadline, add jitter, reduce concurrency and stop after bounded attempts. For an exhausted monthly quota, stop calls until reset or confirmed entitlement change. Other protections may also return `429`; do not infer monthly exhaustion from the status alone. Never let background retries outlive cancellation.

## CSV and XML formats

V2 authenticated routes accept `format=json|csv|xml`; CSV and XML require the applicable plan. Errors remain JSON even when a different format was requested. Check status before choosing a parser. CSV cannot represent every nested response; if the API returns `406 format_not_available`, use JSON or another supported format. See the [V2 contract](api-v2.md) for current behavior.
