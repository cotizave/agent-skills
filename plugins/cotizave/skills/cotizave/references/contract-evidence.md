# Contract evidence

Historical record of the `/v1` API, kept only as evidence for migrations; it does not describe current V2 coverage or permissions. For a new integration, read [the V2 contract](api-v2.md) and the [published coverage](https://docs.cotizave.com/api/v2/coverage.md).

The public review of 2026-10-15 is identified in the [source register](../assets/contract-review.json). The local backend review of 2026-10-16 keeps the code revision, input hashes and results in the [verification register](../assets/backend-contract-review.json).

## Resolved against the provider's code

| Topic | Result |
|---|---|
| Freshness | BCV 132 h; parallel 26 h; P2P 30 min; remittances 6 h; cash 3 h; exchange houses 26 h. A market-specific threshold prevails; Western Union uses 26 h |
| Missing source | The last value may be kept with its original date; there is no general ten-minute cut-off. Marking `stale` and withdrawing a market are different decisions |
| BCV date | The value date is `effective_date`. One retrieval path derives it from Caracas midnight, but the consumer must not require a fixed time to validate `updated_at` |
| Quota | Counting excludes 401, 402, 403, 429 and 5xx; every other status follows the counting rule |
| Bulk | Additional limit of 300 calls per hour; its 429 uses neither the monthly nor the burst scope |

43 tests and subtests on freshness, timestamp preservation, value date and counting passed in three backend packages, using test doubles and local services. The bulk cap and the specific counting of 406/422 were confirmed by code inspection, not by new tests for those cases. The backend was not modified.

## Public documentation

Consulted: [rates](https://cotizave.com/docs/api/endpoints/get-rates), [single rate](https://cotizave.com/docs/api/endpoints/get-rate-by-market), [quotas](https://cotizave.com/docs/api/rate-limits), [plans](https://cotizave.com/precios) and [invoicing](https://cotizave.com/docs/guides/electronic-invoicing-bcv).

The website source was corrected locally to remove the universal ten-minute exclusion, align the BCV examples with the value date and require validity when invoicing with a fallback. Those changes need their own publication: this review does not certify that the deployed website already includes them.

## Limits of the evidence

The identified local code was verified, not the production deployment. Page hashes identify what was consulted; they are not full snapshots. The tests consumed no quota and used no Cotizave credentials. The fixtures remain synthetic; their amounts and dates are neither current values nor backend captures. Other endpoint details are outside this review.
