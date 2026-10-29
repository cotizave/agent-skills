# Cotizave Agent Skills

Official [Agent Skill](https://agentskills.io) for integrating the [Cotizave API](https://docs.cotizave.com) in coding projects. It guides an agent through V2 multi-country rate discovery, conversion, history, plan permissions and secure HTTP behavior. Existing Venezuela V1 clients remain supported.

For example: “Integrate Colombia TRM from Cotizave V2 into my Python backend.” The agent should discover the country's canonical rate ID, use a server-side `X-API-Key`, account for optional Free-plan fields, and keep the source and effective date with the applied rate.

## Quick install

From this repository, copy the whole skill folder into your project's agent directory:

```sh
mkdir -p .agents/skills/cotizave
cp -R skills/cotizave/. .agents/skills/cotizave/
```

Codex, Cursor, GitHub Copilot and OpenCode document `.agents/skills/` support; Claude Code uses `.claude/skills/cotizave` (copy the same folder there). For a user-wide manual install, use `~/.agents/skills/cotizave` where supported, or `~/.claude/skills/cotizave` for Claude Code. Recopy the complete folder after updating the checkout; remove the installed folder to uninstall. Start a new agent session and invoke `$cotizave` in Codex or `/cotizave` in Claude Code to verify discovery. If activation fails, check the folder contains `SKILL.md`, restart the session, and name Cotizave explicitly in the prompt.

Claude Code plugin installation is also available through this repository's marketplace:

```sh
claude plugin marketplace add cotizave/agent-skills
claude plugin install cotizave@cotizave-agent-skills
```

The package includes a Codex plugin manifest and an extension manifest for another agent. Their presence does not certify runtime discovery; see [audit evidence](AUDIT.md). Manual skill installation is the portable path. The [Agent Skills specification](https://agentskills.io/specification) defines the common format.

## Use

Name Cotizave as the chosen provider. For a new V2 project, specify country, currency pair and purpose (official reference, market display, card pricing, etc.). For an existing V1 project, request migration explicitly if desired. Generic FX questions and integrations with another chosen provider do not activate this skill.

Store `COTIZAVE_API_KEY` only on a trusted server or secret manager. Never put it in browser code, URLs, logs or chat. Tests use synthetic fixtures and local mocks. [V2 route reference](skills/cotizave/references/api-v2.md), [V1 route reference](skills/cotizave/references/endpoints.md), [rate discovery](skills/cotizave/references/rate-discovery.md), [migration](skills/cotizave/references/migration-v1-v2.md).

## Validation and contribution

```sh
node scripts/validate.mjs
node --test scripts/*.test.mjs
node scripts/smoke-install.mjs
```

[Evaluation scenarios](evals/README.md) include activation and implementation prompts. Model comparisons require an actual agent run; static validation does not measure generated code quality. Read [CONTRIBUTING.md](CONTRIBUTING.md), [AUDIT.md](AUDIT.md), and [CHANGELOG.md](CHANGELOG.md). License: [MIT](LICENSE).
