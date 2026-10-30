# Release candidate 0.3.0

The next SemVer release is `0.3.0`: `v0.2.0` is the latest Git tag, and V2 global support is a minor feature addition. Manifest and skill versions are synchronized. The 0.3.0 changelog entry includes the packaging changes; the Git tag and release remain unpublished.

Build locally with `node scripts/validate.mjs`, `node --test scripts/*.test.mjs`, `node scripts/smoke-install.mjs --codex`, `claude plugin validate . --strict` and `python3 scripts/package-release.py`. The generated `dist/cotizave-plugin-0.3.0.zip` is ignored by Git and includes the portable plugin manifest, compatibility overlays, official site imagery, skill and all its references. Inspect its contents and hash before upload. A version tag triggers CI and, only after all three jobs pass, uploads the ZIP plus SHA256SUMS as a workflow artifact. This does not create a GitHub Release or submit to a directory. A successful build does not certify a directory listing.

| Platform | Local state | Official directory |
|---|---|---|
| Agent Skills / skills CLI | Local and GitHub-source CLI install tested | Index/ranking not verified |
| Claude Code | Strict marketplace/plugin validation passed | Anthropic directory review not submitted |
| Codex | Isolated skill discovery passed; portable and compatibility manifests packaged | OpenAI ZIP upload/review not submitted |
| Cursor, GitHub Copilot, OpenCode | Standard folder documented; no clean runtime test in this review | Not verified |
| Additional CLI | Extension manifest present; runtime installation not tested | Not verified |

Manual publication tasks: verify publisher identity in each directory; confirm the brand asset usage, support and privacy URLs; upload the ZIP to the OpenAI developer dashboard; review automated findings; complete any publisher/reviewer fields requested by the dashboard; submit for review; publish only after approval. For Claude, follow its directory submission separately. Create a signed or otherwise authenticated release tag and attach the verified ZIP only after review of the diff and explicit authorization. Set GitHub repository description/topics manually if desired. Suggested description: “Official Cotizave Agent Skill for multi-country exchange rate API integration, currency conversion and V1 Venezuela compatibility.” Suggested topics: `agent-skills`, `exchange-rates`, `currency-conversion`, `foreign-exchange-api`, `cotizave`.

No MCP server is needed for this instruction-only skill. No model comparison was run for this candidate; `evals/` contains scenarios and criteria, not claimed scores.

Local checks on 2026-10-29 before removal of the optional diagnostic: static validator PASSED; Node tests 17 PASSED, 1 SKIPPED (private forbidden-term input absent); Codex isolated discovery PASSED; Claude strict validation PASSED; deterministic ZIP/CRC PASSED; local skills CLI copy PASSED; GitHub-source `skills add` installation PASSED (against the then-published repository revision). `skills-ref` was NOT RUN locally because system Python is 3.9 and the pinned package requires 3.11 or later; CI config uses Python 3.12. Gitleaks was NOT RUN locally because the binary is unavailable; its CI job remains configured. No model-driven evaluation, public-directory publication, or authenticated production call was run.

A maintainer can use the GitHub Actions **Create version tag** workflow on `master`, enter the version from `plugin.json`, and let it verify the successful CI run, build/checksum/upload the ZIP and create `v<version>`. Tags created with the workflow token do not trigger another GitHub Actions workflow, so this workflow itself uploads the artifact. It does not create a GitHub Release or submit to any directory.
