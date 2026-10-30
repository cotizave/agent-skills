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

## OpenAI Codex: install and use

Install the complete folder; `SKILL.md` alone is insufficient because it links to references and test assets. The commands below run from a checkout of this repository. To get one, run `git clone https://github.com/cotizave/agent-skills.git` and `cd agent-skills`.

**For one project:** replace `/path/to/your-project` with its actual path.

```sh
mkdir -p /path/to/your-project/.agents/skills/cotizave
cp -R skills/cotizave/. /path/to/your-project/.agents/skills/cotizave/
```

**For your user account:**

```sh
mkdir -p ~/.agents/skills/cotizave
cp -R skills/cotizave/. ~/.agents/skills/cotizave/
```

Start a new Codex session in the project. Invoke the skill explicitly with a prompt such as:

```text
$cotizave Integrate Cotizave V2 Colombia TRM into my backend. Keep the API key on the server and handle unavailable rates.
```

For an existing V1 client, say so: `$cotizave Review my existing V1 integration; preserve its routes and response shape.` Codex may also select the skill automatically when the task clearly names Cotizave. If it does not, use `$cotizave` and check that the installed folder contains `SKILL.md` and `references/`.

To update, pull this repository and recopy the complete folder into the same destination. Review local changes to an installed copy before replacing it; remove files retired by a newer release. To uninstall, remove only the installed `cotizave` folder from the project or user path shown above.

**Verify discovery:** from this repository, run `node scripts/smoke-install.mjs --codex` with Codex CLI installed. The script copies the skill to an isolated temporary project and queries Codex `skills/list`; it does not alter your personal installation or start a model turn. It passed locally with `codex-cli 0.163.0` on 2026-10-29. Discovery does not measure automatic activation or generated-code quality. The [Codex skill documentation](https://learn.chatgpt.com/docs/build-skills) describes the skill format; the [Codex plugin documentation](https://developers.openai.com/plugins/build/plugins) covers the optional `.codex-plugin/plugin.json` manifest.

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

## Install from skills.sh CLI

The independent `skills` CLI discovered this repository's `cotizave` skill through
`npx skills add cotizave/agent-skills --list`. A GitHub-source installation
into an isolated Codex project also succeeded; it tested the currently published
repository revision, not this uncommitted release candidate. To install it into a project with
Codex, run:

```sh
npx skills add cotizave/agent-skills -a codex -s cotizave --copy
```

This CLI is maintained by [vercel-labs/skills](https://github.com/vercel-labs/skills).
Its discovery of a GitHub repository does not establish a skills.sh ranking or
any official directory approval. A clean isolated local install was tested with
`--copy` and retained the references and fixtures.

## Release authenticity and support

Review the repository and [Git tags](https://github.com/cotizave/agent-skills/tags)
before installing; a Git tag identifies a source revision, while directory listings
have their own approval processes. Obtain an application API key from
[the Cotizave dashboard](https://app.cotizave.com) only after installing; the skill
needs no credential to install. Report integration or package issues through
[GitHub issues](https://github.com/cotizave/agent-skills/issues). Product support:
[support@cotizave.com](mailto:support@cotizave.com).

See [release preparation](RELEASE.md) for local package checks and the current
platform verification state.
