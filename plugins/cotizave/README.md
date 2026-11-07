# Cotizave Agent Skill

Official Agent Skill that guides AI coding agents to integrate the [Cotizave](https://docs.cotizave.com) exchange-rate API v2 correctly: official and market rates across the published countries, currency conversion, history and statistics, plan permissions, caching and freshness, and secure server-side authentication. It also includes a procedure to migrate a deprecated V1 Venezuela client to V2 while preserving the application's own contract.

## What this folder contains

- `skills/cotizave/SKILL.md`: the skill, with a short workflow and a table that tells the agent which reference to read for each task.
- `skills/cotizave/references/`: the V2 contract, rate discovery, errors and quotas, caching and freshness, integration patterns for any language, and the V1 to V2 migration procedure.
- `skills/cotizave/assets/fixtures/`: synthetic HTTP responses for local tests. They are illustrative and never replace the live API.
- `assets/`: the Cotizave icon and logo used by the directory listing, taken from Cotizave's public site (`global.cotizave.com`).

## Install

- Claude Code: `claude plugin marketplace add cotizave/agent-skills`, then `claude plugin install cotizave@cotizave-agent-skills`.
- Codex: `codex plugin marketplace add cotizave/agent-skills`, then `codex plugin add cotizave@cotizave-agent-skills`.
- Cursor and other agents: `npx skills add cotizave/agent-skills`.

Then ask, for example: "Use the Cotizave skill to integrate Colombia TRM into my Python backend."

## What it does not do

The plugin ships documentation and data only. It runs no scripts, hooks or MCP servers, sends nothing to Cotizave, and never asks for or reads an API key: the application you build supplies its own key server-side, from its configuration or secret manager. Tests use the bundled synthetic fixtures and local mocks.

## Support

Documentation: https://docs.cotizave.com. Support: https://global.cotizave.com/contact. Source and issues: https://github.com/cotizave/agent-skills. License: MIT.
