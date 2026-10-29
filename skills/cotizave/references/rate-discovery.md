# Rate discovery and selection

1. Identify country, base and quote currency, purpose, required effective date and tolerance for age. Ask when an invoice's legally required reference is unspecified.
2. Check [published coverage](https://docs.cotizave.com/api/v2/coverage.md) and [rate coverage by plan](https://global.cotizave.com/rate-coverage). These show registered IDs, not guaranteed current observations. With Pro, `/v2/countries` enumerates published countries. Otherwise, request `/v2/fx/{CC}/rates` for the chosen documented country.
3. Select a returned `id` and inspect `base`, `quote` when present, `type`, `updated_at`, `effective_date`, and availability. Consult `/v2/fx/{CC}/markets` for directions when Growth is available. Never build an ID from a display name or V1 market. Do not assume a country's official, parallel, interbank, card or P2P source exists.
4. Match meaning: an official rate suits a requirement for that authority's reference; P2P and market values describe other markets; card rates describe card use. Compare only compatible base/quote and effective periods. A quote need not be executable.
5. Handle 402, 404, 503 and missing rows separately. A registered ID, plan permission and a current observation are distinct. Do not switch to another source automatically.

Examples of intent: Colombia TRM for a specified official reference; Australian or Peruvian rates require country discovery before choosing an ID; a multi-country dashboard stores each returned ID and source metadata. The country list grows without changing this procedure.
