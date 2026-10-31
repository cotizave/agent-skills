# Cotizave Agent Skills

Official [Agent Skill](https://agentskills.io) for integrating the [Cotizave API](https://docs.cotizave.com) in coding projects. It guides an agent through V2 multi-country rate discovery, conversion, history, plan permissions and secure HTTP behavior. Existing Venezuela V1 clients remain supported.

For example: “Integrate Colombia TRM from Cotizave V2 into my Python backend.” The agent should discover the country's canonical rate ID, use a server-side `X-API-Key`, account for optional Free-plan fields, and keep the source and effective date with the applied rate.

## Quick start

Run this in your application repository, then choose your coding agent and the `cotizave` skill when prompted:

```sh
npx skills add cotizave/agent-skills
```

Then ask the agent: **“Use the Cotizave skill to integrate Colombia TRM into my Python backend.”** Name the country, currency pair and purpose when relevant. For an existing Venezuela V1 client, ask for migration explicitly if you want it.

For an existing integration, ask: **“Use the Cotizave skill to migrate this project's V1 integration to V2 while preserving the responses my clients use.”** The agent should inspect the code, choose the matching V2 routes and IDs, adapt the project in its current language, and run local regression tests. It should identify any V1 operation with no identical V2 response and report account-specific access that local tests cannot verify. You do not need to prepare a route mapping or supply an API key in chat; see the [migration procedure](skills/cotizave/references/migration-v1-v2.md).

`skills.sh` is a website, not a script you run or a place where maintainers upload a package. Its [Cotizave page](https://skills.sh/cotizave/agent-skills/cotizave) is already live. The command above uses the [skills CLI](https://github.com/vercel-labs/skills) to install files from this public GitHub repository. According to the [skills.sh FAQ](https://www.skills.sh/docs/faq), listings come from installs with that CLI; there is no separate submission step. The page does not imply approval by an agent vendor.

For a noninteractive Codex install, use `npx skills add cotizave/agent-skills -a codex -s cotizave --copy -y`. This was tested in an isolated project; the copy retained its references and fixtures. Use `npx skills list` to inspect installed skills, `npx skills check` to check for updates, and `npx skills remove cotizave` to uninstall a skills CLI copy. See the [CLI reference](https://github.com/vercel-labs/skills/blob/main/docs/commands.md) for global installs and other agents.

**Current distribution status:** [v0.3.1 GitHub Release](https://github.com/cotizave/agent-skills/releases/tag/v0.3.1) and skills.sh page live; Claude directory submission under security review; ChatGPT plugin directory submission not started; GitHub Copilot can install directly from this repository. See [release status and remaining actions](RELEASE.md).

## Other installation routes

### GitHub Copilot via GitHub CLI

With [GitHub CLI 2.90.0 or newer](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills), install the skill in your project:

```sh
gh skill preview cotizave/agent-skills cotizave
gh skill install cotizave/agent-skills cotizave --agent github-copilot --scope project
test -f .agents/skills/cotizave/SKILL.md
```

Use `--scope user` instead of `--scope project` for a personal install. GitHub CLI placed the tested project install in `.agents/skills/cotizave`, with its references and fixtures. For Copilot cloud agent or code review, commit that folder to the project repository so it is available in the remote checkout. Ask Copilot, for example, “Use the Cotizave skill to integrate Colombia TRM into this Python backend.” Copilot selects relevant skills from the prompt and their descriptions; inspect the agent's response to confirm it followed the Cotizave contract. Run `gh skill update cotizave` to update an installed copy, or `gh skill update --dry-run` to check without changing files. To uninstall a project copy, remove `.agents/skills/cotizave` from that project.

The GitHub CLI skill commands are in public preview. [Direct installation](https://cli.github.com/manual/gh_skill_install) works independently of GitHub Code Search indexing or a GitHub Release. `gh skill search cotizave` may take time to find a new repository; a GitHub Release is not a separate Copilot marketplace approval.

### Claude Code: repository marketplace

```sh
claude plugin marketplace add cotizave/agent-skills
claude plugin install cotizave@cotizave-agent-skills
```

Restart Claude Code, then invoke `/cotizave:cotizave` or ask it to integrate Cotizave. To update, use `claude plugin marketplace update cotizave-agent-skills` and `claude plugin update cotizave@cotizave-agent-skills`. This installs from Cotizave's GitHub repository marketplace. The separate Anthropic directory submission is pending security review.

### Codex: repository marketplace

```sh
codex plugin marketplace add cotizave/agent-skills
codex plugin add cotizave@cotizave-agent-skills
```

Restart Codex, then invoke `$cotizave`, for example: `$cotizave Integrate Cotizave V2 Colombia TRM into my backend.` Use `codex plugin list` to inspect the installed version. To update, run `codex plugin marketplace upgrade cotizave-agent-skills` and restart Codex; this refreshed an installed local plugin from 0.2.0 to 0.3.0 in Codex CLI 0.163.0. To uninstall, run `codex plugin remove cotizave@cotizave-agent-skills`. Codex also discovered the skill in an isolated `.agents/skills` install. This repository marketplace works independently of the ChatGPT plugin directory, where Cotizave has not been submitted.

### Manual fallback

From a checkout of this repository, copy the *whole* `skills/cotizave` folder, including references and assets. For one project, copy to `.agents/skills/cotizave` (Codex and compatible agents) or `.claude/skills/cotizave` (Claude Code). For a user-wide Codex install, copy to `~/.agents/skills/cotizave`. Verify with `node scripts/smoke-install.mjs --codex` from this repository; it uses a temporary project and starts no model turn. Remove the installed folder to uninstall a manual copy.

The [Agent Skills specification](https://agentskills.io/specification) defines the common format. Repository and CLI installation are distinct from approval in any platform's official directory.

## Use

Name Cotizave as the chosen provider. For a new V2 project, specify country, currency pair and purpose (official reference, market display, card pricing, etc.). For an existing V1 project, request migration explicitly if desired. Generic FX questions and integrations with another chosen provider do not activate this skill.

Store `COTIZAVE_API_KEY` only on a trusted server or secret manager. Never put it in browser code, URLs, logs or chat. Tests use synthetic fixtures and local mocks. [V2 route reference](skills/cotizave/references/api-v2.md), [V1 route reference](skills/cotizave/references/endpoints.md), [rate discovery](skills/cotizave/references/rate-discovery.md), [migration](skills/cotizave/references/migration-v1-v2.md).

### Data handling

Installing or invoking the skill does not send project files, chat content, or
credentials to Cotizave. The skill has no connector, telemetry, background
process, or API-key diagnostic. It does not read or store personal data. An
application built using its instructions makes Cotizave API calls only under
the application's control; its developer supplies a server-side API key.
Cotizave's [privacy policy](https://global.cotizave.com/legal/privacy) says
individual API request logs, including IP address and request metadata, are
deleted within three days. The plugin is not intended for users under 18.

## Validation and contribution

```sh
node scripts/validate.mjs
node --test scripts/*.test.mjs
node scripts/smoke-install.mjs
```

[Evaluation scenarios](evals/README.md) include activation and implementation prompts. Model comparisons require an actual agent run; static validation does not measure generated code quality. Read [CONTRIBUTING.md](CONTRIBUTING.md), [AUDIT.md](AUDIT.md), and [CHANGELOG.md](CHANGELOG.md). License: [MIT](LICENSE).

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
