# Release 0.3.6

`v0.3.6` corrects the V1 bulk validation claim in the V1→V2 migration reference. Current V1 bulk rejects an incompatible EUR-base market or reverse one-way remittance with `400 invalid_format`; V2 validates `via` against each pair. It also clarifies that the V2 format rule applies to authenticated routes and that cursor/limit belong to raw history mode.

The deterministic package is `cotizave-plugin-0.3.6.zip` (SHA-256 `c64eb0eec6e85640e67b0e86d9cdadad26d8e73e0f4a178367cc5ac8f24fc65e`). Local static validation, Node tests, skill validation and ZIP/CRC verification passed. The GitHub Release includes the ZIP and `SHA256SUMS`.

## Previous release: 0.3.5

`v0.3.5` updates the Free monthly quota from 800 to 500 in the skill reference and synthetic 429 fixture. Polling and cache guidance now budgets for 500 requests per month. This patch follows the owner's pending backend catalogue change; the deployed API may still report 800 until that rollout completes.

The deterministic package is `cotizave-plugin-0.3.5.zip` (SHA-256 `5a9de674df012b404c65b1f3b210db9c9f04440287255c0f132a11a2bb7ed91d`). Local static validation, Node tests, skill validation, GitHub skill dry-run and ZIP/CRC verification passed. The GitHub Release includes the ZIP and `SHA256SUMS`.

## Previous release: 0.3.4

`v0.3.4` corrects the V1 reference after comparing it with the current backend: `/v1/fx/spread` requires Growth or higher in the public plans, and V1 bulk conversion rejects an incompatible EUR-base or one-way remittance market with `400 invalid_format`. The skill version remains independent of API V1 and V2.

The deterministic package is `cotizave-plugin-0.3.4.zip` (SHA-256 `20bc31772757f7af7d9bfa41f91101e8afbc61f43a730cbe950e4ddbc7f2a1a5`). Local validation and ZIP/CRC verification passed. The GitHub Release includes the ZIP and `SHA256SUMS`.

## Previous release: 0.3.3

`v0.3.3` updates the Cotizave Agent Skill for the current public plans and V2 contract. It corrects monthly quotas, minute limits and Free history retention; documents authenticated `/v2/issuers` and cross-currency conversion; and removes guidance about public API routes. The reference and synthetic fixtures were checked against the current docs and backend catalogue. The skill version is independent of API V2.

The deterministic release package is `cotizave-plugin-0.3.3.zip` (SHA-256 `6e6357afbb8ffaa6d5ca5973974024cd6b7bd9e1c805a1525f27ba75b11eb59d`). Local static validation, Node tests, Codex isolated discovery, Claude strict validation, GitHub skill dry-run and ZIP/CRC verification passed. The GitHub Release will carry the ZIP and `SHA256SUMS`; publication does not imply vendor-directory approval.

## Previous release: 0.3.2

[`v0.3.2`](https://github.com/cotizave/agent-skills/releases/tag/v0.3.2) updates V2 discovery guidance for the 29 published countries and separates country-rate routes from currencies that are available only for conversion. It points integrations to the current coverage catalogue and marks older V1 contract evidence as historical. The documentation source lists 137 registered IDs in those countries; registration does not guarantee a current observation or production deployment. The skill includes no static country or rate list. This patch does not change the Cotizave API version or vendor-directory submission status. Model-driven evaluations remain unrun.

The release package is the deterministic `cotizave-plugin-0.3.2.zip` with `SHA256SUMS` attached to the GitHub Release. Its SHA-256 is `5567d3581783dbc765496da3fd2ccdcc7f0aa7a0dcf5a3257ea26a9ca17ceb5a`. Local validation, Node tests, isolated Codex discovery, Claude strict validation, GitHub skill dry-run and ZIP/CRC checks passed. skills.sh reads the GitHub repository through CLI installations; there is no separate package upload or submission for this patch.

## Previous release: 0.3.1

[`v0.3.1`](https://github.com/cotizave/agent-skills/releases/tag/v0.3.1) packages the V1 to V2 migration guidance, canonical VE market mapping, paired synthetic rate fixtures, a partial-bulk fixture and migration evaluation prompts. It is a patch release of the skill; the Cotizave API version is independent. Local validation, Node tests, isolated Codex installation, Claude strict plugin validation, GitHub skill dry-run and ZIP/CRC checks passed. The portable ZIP SHA-256 is `ef6483b380cac7aeb45f3437b16d72b6c987c08536c15eb058e5bc685391eb8a`. Model-driven migration evaluations remain unrun and are not claimed as proof of real-project compatibility. This GitHub release does not change vendor-directory submission status.

## Previous release: 0.3.0

[`v0.3.0`](https://github.com/cotizave/agent-skills/releases/tag/v0.3.0) was published on 2026-10-30 from commit `ff9dab2d54381d5829f81e0431a56fa4ca7cbcd1`. V2 global support is a minor feature addition. The tag's skill and manifest versions are synchronized. The GitHub Release includes the portable ZIP and `SHA256SUMS`; its ZIP SHA-256 is `e44abd97fcd2e5f37a41f2d1a287b7a14d2e6e861f912ef2a17c343caf0cce5f`.

Build locally with `node scripts/validate.mjs`, `node --test scripts/*.test.mjs`, `node scripts/smoke-install.mjs --codex`, `claude plugin validate . --strict` and `python3 scripts/package-release.py`. The generated `dist/cotizave-plugin-0.3.0.zip` is ignored by Git and includes the portable plugin manifest, compatibility overlays, official site imagery, skill and all its references. The [tag CI run](https://github.com/cotizave/agent-skills/actions/runs/40995201875) passed all four jobs and uploaded the ZIP plus checksum as a workflow artifact. The GitHub Release has matching assets. This does not submit the plugin to any vendor directory.

| Channel | What works now | Publication status / next action |
|---|---|---|
| [skills.sh](https://skills.sh/cotizave/agent-skills/cotizave) | GitHub-source CLI install tested; public page live | **Nothing to upload or submit.** The [FAQ](https://www.skills.sh/docs/faq) says the listing follows CLI installations. Ranking depends on install counts. |
| Claude Code | Repository marketplace manifest and strict plugin validation passed; clean install not tested | Anthropic directory submission is pending security review; wait for its result. |
| Codex | Repository marketplace and isolated skill discovery tested; release ZIP ready | ChatGPT plugin directory submission not started; requires developer dashboard review and publisher identity. |
| GitHub Copilot | `gh skill install` from GitHub tested in an isolated project; all references present | `gh skill publish` created the tag, GitHub Release and `agent-skills` topic; Code Search indexing is not verified. This is not a separate Copilot directory approval. |
| Cursor, OpenCode | Standard folder documented; no clean runtime test in this review | Not verified |
| Google CLI extension | Extension manifest present; runtime installation not tested | Gallery indexing not verified |

The remaining publication decisions are separate: wait for Anthropic's review; submit the ZIP to OpenAI only if publisher identity and directory listing are desired. No action on skills.sh is needed. The GitHub repository description should describe multi-country V2 integration and V1 Venezuela compatibility. The `agent-skills` topic is set; optional additional topics: `exchange-rates`, `currency-conversion`, `foreign-exchange-api`, `cotizave`.

No MCP server is needed for this instruction-only skill. No model comparison was run for this candidate; `evals/` contains scenarios and criteria, not claimed scores.

Local checks before publication: static validator PASSED; Node tests 6 PASSED, 1 SKIPPED (private forbidden-term input absent); Codex isolated discovery PASSED; Claude strict validation PASSED; deterministic ZIP/CRC PASSED; local skills CLI copy PASSED; GitHub-source `skills add` installation PASSED. An isolated `gh skill install` from GitHub PASSED for GitHub Copilot, including bundled references. `skills-ref` and Gitleaks PASSED in the tag CI run; they were not run locally. No model-driven evaluation, vendor-directory approval, or authenticated production call was run.

## GitHub Copilot and future version tags

[GitHub CLI's `gh skill publish`](https://cli.github.com/manual/gh_skill_publish) validated and published `v0.3.0`, added the `agent-skills` topic and created the GitHub Release. The dry run reported non-blocking recommendations to enable secret scanning, push protection and tag protection. It did not submit the skill for approval to a separate Copilot marketplace. [`gh skill search`](https://cli.github.com/manual/gh_skill_search) uses GitHub Code Search, so the release does not guarantee immediate search indexing; direct installation from `cotizave/agent-skills` was tested.

For a future version, use either `gh skill publish --tag v<version>` or the GitHub Actions **Create version tag** workflow on `master`. The workflow verifies successful CI, builds/checksums/uploads the ZIP as a workflow artifact and creates the tag, but it does not create a GitHub Release. **Choose one tag-creation path per version.** A tag created by the workflow's `GITHUB_TOKEN` does not trigger another GitHub Actions workflow; the workflow uploads the artifact itself. When using `gh skill publish`, attach the generated ZIP and `SHA256SUMS` to the GitHub Release as done for `v0.3.0`.
