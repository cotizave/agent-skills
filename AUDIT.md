# Audit and contract evidence — 2026-10-29

## Follow-up — 2026-10-31

The documentation source now lists the maintainer-selected 29 published V2 countries
and 137 registered IDs, with matching Spanish and English plan matrices. The plan
summary mismatch recorded below was corrected in that source. Publication of the
updated documentation and production availability remain unverified. The historical
findings below retain their original review date and evidence level.

| Severity | Evidence | Impact | Resolution |
|---|---|---|---|
| Critical | SKILL.md said all routes were V1 and non-VES pairs were unsupported. Official V2 introduction and endpoints document multiple countries. | New integrations could select the wrong API or reject supported use cases. | V2-first skill and modular V2 contract; preserve V1 reference. |
| High | README, plugin descriptions and eval prompts centered on V1/VE. | Poor activation and wrong defaults for global use. | Update metadata, README and V2 scenarios. |
| High | The public plans summary counts fewer Pro than Free IDs for several international countries. The maintainer confirms Free can request all published rates outside Venezuela, with higher plans inheriting access. | The summary can mislead developers about Pro permissions. | Correct the summary counts in the official docs; keep Venezuela restrictions. |
| Medium | `/v2/countries` and `/markets` have plan gates, so a universal discovery algorithm would fail on Free. | Free integrations could stop before reading rates. | Use public coverage plus country rates; use catalogues only with permission. |
| Medium | V2 Free omits metadata available to paid plans; some VE rows are descriptors without price. | Parsing could mistake absent fields for zero or availability. | Document optional fields and test responses without price. |
| Medium | Existing evals are primarily V1 and not an executable model comparison. | No evidence of improvement on V2 code generation. | Add V2/activation scenarios and preserve comparison protocol; no scores claimed. |
| Low | README contains unpublished-repository setup instructions. | Confusing installation. | Replace with shorter public repository guide. |

## Evidence levels

- **Documented:** [V2 endpoint reference](https://docs.cotizave.com/api/v2/endpoints.md), [plans](https://docs.cotizave.com/api/v2/plans.md), [migration](https://docs.cotizave.com/api/v2/migration.md), [coverage](https://docs.cotizave.com/api/v2/coverage.md), and official Markdown index pages fetched 2026-10-29. Official global site lists several markets as “In progress” while docs list published IDs. A registered ID is not proof of a live quote.
- **Code and tests:** Existing V1 backend evidence in `skills/cotizave/assets/backend-contract-review.json` records an earlier local revision and 43 passed tests. No V2 backend source was accessed in this audit.
- **Production:** No authenticated calls, key usage or quota consumption; no production behavior confirmed.
- **Unverified announcements:** Event delivery and other product features appear on global marketing pages. Consult the relevant official guide before implementing signatures or events.
- **Documentation correction at audit time:** The [plans page](https://docs.cotizave.com/api/v2/plans.md) summary reported Pro counts below Free for AR/CO/PE/MX/AU/ES. The documentation source now has the inherited counts; deployment still needs verification. A registered ID still does not guarantee a current observation.

## Release-candidate audit of the current checkout

| Severity | Location | Problem and evidence | Correction | Status |
|---|---|---|---|---|
| BLOCKER | `.claude-plugin/` | No plugin manifest before this review; directory submission metadata and standalone validation were incomplete. | Added plugin manifest; changed marketplace strict mode to permit the manifest and marketplace skill path together. | Fixed locally; `claude plugin validate . --strict` passed. |
| HIGH | Repository root, `.codex-plugin/` | No portable plugin manifest or square listing assets. OpenAI's current packaging guide recommends root `plugin.json`; submission reference requires logo and composer icon for Codex. | Added portable identity, official site image assets and listing paths. | Package prepared; directory upload/review unverified. |
| HIGH | `scripts/validate.mjs` | Only Claude marketplace and skill versions were checked. | Added cross-manifest version, route, listing and image checks. | Fixed locally. |
| HIGH | `.github/workflows/ci.yml` | `skills-ref` installed from a mutable Git HEAD and no release ZIP was tested. | Pinned source revision and added deterministic ZIP build/CRC verification. | Fixed locally; remote CI not run. |
| MEDIUM | `evals/` | V2 scenarios omitted Peru, Mexico, unknown ID and optional fields; prompt expectations had no model run. | Added scenarios and preserved NOT RUN status for model results. | Scenario structure validated; model quality remains unmeasured. |
| MEDIUM | `skills/cotizave/assets/fixtures/` | Only V1 response examples existed. | Added V2 synthetic restricted descriptor and temporary unavailability examples. | Structural validation passed; no live API call. |
| LOW | `README.md` | No direct skills.sh install path or release authenticity guidance. | Added tested CLI path and release checklist. | Local install verified; public index position unverified. |

Sources consulted for this audit: [V2 endpoints](https://docs.cotizave.com/api/v2/endpoints.md), [data dictionary](https://docs.cotizave.com/api/v2/data-dictionary.md), [plans](https://docs.cotizave.com/api/v2/plans.md), [Claude manifest](https://code.claude.com/docs/en/plugins/manifest-reference), [OpenAI packaging](https://developers.openai.com/plugins/build/plugins), and [OpenAI submission](https://developers.openai.com/plugins/deploy/submission). The earlier global market-status mismatch was resolved on the live site. Neither a registered ID nor a synthetic fixture proves a live observation.

## Maintainer-provided AU response comparison

Four response bodies shared in the conversation (Free, Basic, Growth and Pro, 2026-10-30 UTC) contained the same seven IDs: `au-official`, `au-market`, `au-usdt`, `au-travelex-cash`, `au-travelex-card`, `au-binance` and `au-okx`. This confirms access to those seven in each shown account, not access to every registered AU ID. The Free response omitted paid metadata while Basic/Growth/Pro added their documented fields. `stale_after_sec` differed between Free and Basic for the same IDs (2700 versus 1800 for `au-market`; 94500 versus 93600 for Travelex). Treat that value as response data; the reason for the difference is not verified. No credentials or full response bodies were committed.
