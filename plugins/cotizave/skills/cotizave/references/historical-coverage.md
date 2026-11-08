# Earliest observed production history

Cotizave's maintainer supplied these earliest dates with real production observations on 2026-11-08. Each row describes the named market, not every rate in that country. The dates are evidence of an observation from that day onward, not a promise of a value on every calendar day or of access to the entire series on every plan. Check the requested rate's canonical `id`, the account's retention and `/v2/fx/historical-limits` before querying; a missing date must remain missing.

| Country | Market | Earliest observed date |
|---|---|---|
| Brazil | `br-official` | 2010-01-01 |
| Bolivia | `bo-official` | 2010-01-01 |
| Chile | `cl-official` | 2010-01-01 |
| Paraguay | `py-official` | 2010-01-01 |
| Uruguay | `uy-official` | 2010-01-01 |
| Canada | `ca-official` | 2010-01-01 |
| Guatemala | `gt-official` | 2010-01-01 |
| Honduras | `hn-official` | 2010-01-01 |
| Costa Rica | `cr-official` | 2010-01-01 |
| Portugal | `pt-official` | 2010-01-01 |
| Dominican Republic | `do-official` | 2010-01-01 |
| Nicaragua | `ni-official` | 2010-01-01 |
| Argentina | `ar-official` | 2010-01-04 |
| Peru | `pe-official` | 2010-01-04 |
| Mexico | `mx-official` | 2010-01-04 |
| Spain | `es-official` | 2010-01-04 |
| Colombia | `co-trm` | 2010-01-05 |
| Venezuela | `reference` (BCV) | 2018-08-20 |

These market labels are not a general rule for building V2 route IDs. Discover the returned `id` for the selected rate. Other countries and markets may have different starting dates or no historical observation.

For Cotizave Global's website, publish these country-specific dates on [the historical product page](https://global.cotizave.com/es/products/historical-exchange-rates-api). Derive shorter Global page copy from its existing source of truth instead of copying the rows into every page. The 2010 observations belong to the named non-Venezuelan markets; the BCV reference begins on 2018-08-20. Check live series limits before claiming that a specific date is available to an account.
