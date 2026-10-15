# Cotizave Agent Skills

Skill oficial para que los agentes de código (Claude Code, OpenAI Codex, Cursor,
GitHub Copilot y cualquier herramienta compatible con el estándar abierto
[Agent Skills](https://agentskills.io)) integren la
[API de Cotizave](https://cotizave.com/docs) **correctamente**: tasa BCV oficial,
dólar paralelo, Binance y otros P2P, conversiones a bolívares, histórico, cuotas y
manejo de errores.

Con la skill instalada, el agente sabe, entre otras cosas, que:

- la API key va en `X-API-Key`, se lee de `COTIZAVE_API_KEY` y **nunca** se expone en
  el navegador;
- `/v1/fx/convert` sin `via` usa la tasa **oficial del BCV**;
- `effective_date` (fecha valor) no es lo mismo que `updated_at`;
- un `429` por `burst` se reintenta, pero uno por cuota `monthly` **no**;
- los parámetros desconocidos devuelven `400 unknown_parameter`;
- hay que cachear según la cadencia real de cada mercado.

## Instalación

### Cualquier agente (recomendado)

```bash
npx skills add cotizave/agent-skills
```

Funciona con Claude Code, Codex, Cursor, Copilot y otros agentes soportados por el
CLI [`skills`](https://github.com/vercel-labs/skills).

### Claude Code (plugin)

```bash
claude plugin marketplace add cotizave/agent-skills
claude plugin install cotizave@cotizave-agent-skills
```

### Manual

Copia la carpeta `skills/cotizave` al directorio de skills de tu agente:

| Agente | Proyecto | Usuario |
|---|---|---|
| Claude Code | `.claude/skills/cotizave` | `~/.claude/skills/cotizave` |
| OpenAI Codex | `.agents/skills/cotizave` | `~/.agents/skills/cotizave` |
| Otros | el directorio de skills que indique su documentación | |

```bash
git clone https://github.com/cotizave/agent-skills
cp -R agent-skills/skills/cotizave .claude/skills/
```

## Configura tu API key

Crea una key en [app.cotizave.com](https://app.cotizave.com) y guárdala como variable
de entorno del **servidor** (nunca en el repositorio ni en código de frontend):

```bash
export COTIZAVE_API_KEY="ctz_live_..."
./skills/cotizave/scripts/check-key.sh   # verifica la key y muestra tu cuota
```

## Prompts para probar

- "Muestra el precio de mis productos en bolívares usando la tasa BCV."
- "Agrega a mi API un endpoint `/tasas` que devuelva BCV, paralelo y Binance con cache."
- "Crea un bot de Telegram que responda a cuánto está el dólar hoy en Venezuela."
- "Guarda en cada factura la tasa BCV y su fecha valor."
- "Mi integración con Cotizave recibe 429: manéjalos bien."
- "Compara el dólar paralelo contra el BCV y avísame si la brecha supera el 20 %."

## Contenido

```
skills/cotizave/
├── SKILL.md                         # instrucciones principales
├── references/
│   ├── endpoints.md                 # todos los endpoints públicos
│   ├── errors-and-limits.md         # errores, planes, cuotas y 429
│   ├── caching-and-freshness.md     # cadencia de cada mercado y TTLs
│   └── examples/                    # TypeScript, Python, PHP y Go
└── scripts/check-key.sh             # verifica COTIZAVE_API_KEY
```

Documentación completa: https://cotizave.com/docs · Soporte: support@cotizave.com

## Licencia

[MIT](LICENSE)

---

## In English

Official [Agent Skill](https://agentskills.io) that teaches AI coding agents (Claude
Code, OpenAI Codex, Cursor, GitHub Copilot, …) how to integrate the
[Cotizave API](https://cotizave.com/docs) — Venezuelan exchange rates (BCV official
rate, parallel dollar, Binance and other P2P markets, USD/EUR ↔ VES conversion,
history, BCV per-bank rates and Venezuelan bank catalog) — with correct auth, quota
and 429 handling, caching and freshness semantics.

```bash
# Any agent
npx skills add cotizave/agent-skills

# Claude Code plugin
claude plugin marketplace add cotizave/agent-skills
claude plugin install cotizave@cotizave-agent-skills
```

Manual install: copy `skills/cotizave` into your agent's skills directory
(`.claude/skills/` for Claude Code, `.agents/skills/` for Codex). Set your key as a
server-side environment variable `COTIZAVE_API_KEY`; never ship it to a browser. The
skill content is written in Spanish, the language of most Cotizave users; agents
apply it regardless of the language you prompt in.

License: [MIT](LICENSE).
