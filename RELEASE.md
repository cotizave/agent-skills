# Release 0.3.1

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

The remaining publication decisions are separate: wait for Anthropic's review; submit the ZIP to OpenAI only if publisher identity and directory listing are desired. No action on skills.sh is needed. The GitHub repository description still describes Venezuela only; change it manually if desired. Suggested description: “Official Cotizave Agent Skill for multi-country exchange rate API integration, currency conversion and V1 Venezuela compatibility.” The `agent-skills` topic is set; optional additional topics: `exchange-rates`, `currency-conversion`, `foreign-exchange-api`, `cotizave`.

No MCP server is needed for this instruction-only skill. No model comparison was run for this candidate; `evals/` contains scenarios and criteria, not claimed scores.

Local checks before publication: static validator PASSED; Node tests 6 PASSED, 1 SKIPPED (private forbidden-term input absent); Codex isolated discovery PASSED; Claude strict validation PASSED; deterministic ZIP/CRC PASSED; local skills CLI copy PASSED; GitHub-source `skills add` installation PASSED. An isolated `gh skill install` from GitHub PASSED for GitHub Copilot, including bundled references. `skills-ref` and Gitleaks PASSED in the tag CI run; they were not run locally. No model-driven evaluation, vendor-directory approval, or authenticated production call was run.

## GitHub Copilot and future version tags

[GitHub CLI's `gh skill publish`](https://cli.github.com/manual/gh_skill_publish) validated and published `v0.3.0`, added the `agent-skills` topic and created the GitHub Release. The dry run reported non-blocking recommendations to enable secret scanning, push protection and tag protection. It did not submit the skill for approval to a separate Copilot marketplace. [`gh skill search`](https://cli.github.com/manual/gh_skill_search) uses GitHub Code Search, so the release does not guarantee immediate search indexing; direct installation from `cotizave/agent-skills` was tested.

For a future version, use either `gh skill publish --tag v<version>` or the GitHub Actions **Create version tag** workflow on `master`. The workflow verifies successful CI, builds/checksums/uploads the ZIP as a workflow artifact and creates the tag, but it does not create a GitHub Release. **Choose one tag-creation path per version.** A tag created by the workflow's `GITHUB_TOKEN` does not trigger another GitHub Actions workflow; the workflow uploads the artifact itself. When using `gh skill publish`, attach the generated ZIP and `SHA256SUMS` to the GitHub Release as done for `v0.3.0`.
