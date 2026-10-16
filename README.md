# Cotizave Agent Skills

Skill oficial para que los agentes de código (Claude Code, OpenAI Codex, Cursor,
GitHub Copilot, OpenCode y cualquier herramienta compatible con el estándar abierto
[Agent Skills](https://agentskills.io)) integren la
[API de Cotizave](https://cotizave.com/docs) **correctamente**: tasa BCV oficial,
dólar paralelo, Binance y otros P2P, conversiones a bolívares, histórico, cuotas y
manejo de errores.

Con la skill instalada, el agente sabe, entre otras cosas, que:

- la API key va en `X-API-Key`, se lee de `COTIZAVE_API_KEY` y **nunca** se expone en
  el navegador;
- `/v1/fx/convert` sin `via` usa la tasa **oficial del BCV**;
- `effective_date` (fecha valor) no es lo mismo que `updated_at`;
- un `429` por `burst` se reintenta (con límite), pero uno por cuota `monthly` **no**;
- un `402 feature_not_in_plan` es un límite del plan, no un error transitorio;
- hay que cachear según la cadencia real de cada mercado.

## Requisitos

- Un agente compatible con Agent Skills (tabla de compatibilidad abajo).
- Una cuenta en [app.cotizave.com](https://app.cotizave.com) y su API key (hay plan
  Gratis). La skill no necesita la key para instalarse; tu aplicación sí, para llamar
  a la API.
- Solo para el diagnóstico opcional `scripts/check-key.sh`: Bash 3.2+, `curl` 8.4+
  y `jq`. La documentación de la skill no necesita esos ejecutables.

## Instalación

### Claude Code (plugin)

```bash
claude plugin marketplace add cotizave/agent-skills
claude plugin install cotizave@cotizave-agent-skills
```

Dentro de una sesión también funciona `/plugin marketplace add cotizave/agent-skills`
y `/plugin install cotizave@cotizave-agent-skills`.

Abre una sesión nueva y prueba:

```text
/cotizave:cotizave Integra la tasa BCV en mi backend usando Cotizave.
```

Para probar la copia local antes de publicarla, desde la raíz de este repositorio
usa `claude plugin marketplace add .` en lugar del comando de GitHub, y después
el mismo `claude plugin install`. Elige la fuente local o GitHub para este
marketplace; ambos tienen el mismo nombre. [Guía oficial de Claude Code](https://code.claude.com/docs/en/discover-plugins).

### Codex (skill local)

Desde la raíz de este repositorio, instala la carpeta completa para tu usuario:

```bash
mkdir -p ~/.agents/skills/cotizave
cp -R skills/cotizave/. ~/.agents/skills/cotizave/
```

Estos pasos son para una instalación nueva. Si ya tienes una copia, revisa sus
cambios locales antes de reemplazarla. Para compartirla solo con un proyecto,
copia la misma carpeta en `.agents/skills/cotizave/` dentro del proyecto consumidor.

Abre Codex en el proyecto donde quieres integrar Cotizave y escribe:

```text
$cotizave Integra la tasa BCV en mi backend usando Cotizave.
```

Codex descubre las skills de esas rutas; si no aparece, abre una sesión nueva.
La copia local permite probarla antes de subir el repositorio. Para instalarla
desde GitHub también puedes usar el CLI `skills` de la sección siguiente.
[Rutas de skills en la documentación oficial de OpenAI](https://developers.openai.com/codex/skills).

### Cualquier agente, con el CLI `skills`

```bash
npx skills add cotizave/agent-skills                 # pregunta a qué agentes instalar
npx skills add cotizave/agent-skills -a claude-code  # o: codex, cursor, github-copilot, opencode
npx skills add cotizave/agent-skills -g              # a nivel usuario, no del proyecto
```

CLI de [vercel-labs/skills](https://github.com/vercel-labs/skills). En proyecto instala en
`.claude/skills/` para Claude Code y en `.agents/skills/` para los demás.

### GitHub Copilot, con `gh`

```bash
gh skill install cotizave/agent-skills cotizave                  # proyecto, para Copilot
gh skill install cotizave/agent-skills cotizave --scope user     # a nivel usuario
gh skill install cotizave/agent-skills cotizave --agent opencode # u otro agente
```

`gh skill` está en *public preview* (requiere una versión reciente de `gh`). En proyecto
instala en `.agents/skills/`, que Copilot, Cursor, Codex y OpenCode leen.

### Manual

Copia la carpeta `skills/cotizave` completa (con `SKILL.md`, `references/`,
`assets/` y `scripts/`) al
directorio de skills de tu agente:

```bash
git clone https://github.com/cotizave/agent-skills
mkdir -p .claude/skills
cp -R agent-skills/skills/cotizave .claude/skills/   # ajusta el destino según la tabla
```

| Agente | Proyecto | Usuario |
|---|---|---|
| Claude Code | `.claude/skills/cotizave` | `~/.claude/skills/cotizave` |
| OpenAI Codex | `.agents/skills/cotizave` | `~/.agents/skills/cotizave` |
| Cursor | `.agents/skills/cotizave` o `.cursor/skills/cotizave` (también lee `.claude/skills`) | `~/.agents/skills/cotizave` o `~/.cursor/skills/cotizave` |
| GitHub Copilot | `.github/skills/cotizave` (también lee `.claude/skills` y `.agents/skills`) | `~/.copilot/skills/cotizave` o `~/.agents/skills/cotizave` |
| OpenCode | `.opencode/skills/cotizave` (también lee `.claude/skills` y `.agents/skills`) | `~/.config/opencode/skills/cotizave` |

Mantén una fuente de contenido en `skills/cotizave`. El instalador debe adaptarla
a las rutas de cada agente (o usar enlaces compatibles); no asumas que todos
descubren una misma ruta. No mantengas variantes de instrucciones por agente.

En la API de OpenAI (no Codex) las skills se suben como zip con `POST /v1/skills`;
sube la carpeta `skills/cotizave`.

## Activación

El agente puede seleccionarla cuando la tarea implica la API de Cotizave como
proveedor elegido (`api.cotizave.com`, `COTIZAVE_API_KEY`, errores de esa integración).
Mencionar bolívares no autoriza cambiar otro proveedor por Cotizave. La activación
implícita depende del agente y todavía debe evaluarse; también puedes invocarla:

| Agente | Invocación explícita |
|---|---|
| Claude Code | `/cotizave` (instalada como plugin: `/cotizave:cotizave`) |
| OpenAI Codex | `$cotizave` o desde `/skills` |
| Cursor | `/cotizave` en el chat del agente |
| GitHub Copilot (VS Code, CLI) | `/cotizave` |
| OpenCode | la carga con su herramienta `skill` cuando la tarea coincide |

### Prompts para probar

- "Muestra el precio de mis productos en bolívares usando la tasa BCV de Cotizave."
- "Agrega a mi API un endpoint `/tasas` que devuelva BCV, paralelo y Binance desde Cotizave con cache."
- "Crea un bot de Telegram que responda a cuánto está el dólar hoy en Venezuela usando Cotizave."
- "Guarda en cada factura la tasa BCV de Cotizave y su fecha valor."
- "Mi integración con Cotizave recibe 429: manéjalos bien."
- "Con Cotizave, compara el dólar paralelo contra el BCV y avísame si la brecha supera el 20 %."

## Configura tu API key de forma segura

Crea una key en [app.cotizave.com](https://app.cotizave.com) (se muestra una sola vez)
y guárdala como variable de entorno **del servidor**:

```bash
# .env (agrégalo a .gitignore) o el gestor de secretos de tu plataforma
COTIZAVE_API_KEY=ctz_live_...
```

- Nunca la pongas en el repositorio, en código de navegador o de apps móviles, en una
  URL ni en logs. Si tu app es solo frontend, crea un endpoint en tu backend.
- No la pegues en el chat con el agente: pídele que la lea de `COTIZAVE_API_KEY`.
- Para comprobarla: `./skills/cotizave/scripts/check-key.sh` (hace **una** llamada,
  consume 1 request de tu cuota; no lo ejecutes como test). Rechaza destinos
  ajenos a Cotizave; loopback solo admite la key ficticia `ctz_live_test`.
- Si se filtró, revócala y crea otra en el dashboard.

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| `401 invalid_api_key` | Key ausente, mal copiada (espacios, comillas, salto de línea: la API no los recorta) o revocada | Revisa `COTIZAVE_API_KEY` en el entorno del proceso que llama; `check-key.sh` |
| `402 feature_not_in_plan` | Tu plan no incluye ese endpoint, market o formato (`details.feature`; p. ej. `route` y `bulk_convert` son solo de Escala) | Usa otra opción de tu plan o cambia de plan. No reintentes |
| `429` con `X-RateLimit-Scope: burst` | Demasiadas llamadas por segundo | Espera `X-RateLimit-Retry-After-Ms` y reintenta; baja la concurrencia |
| `429` con `X-RateLimit-Scope: monthly` | Cuota del ciclo agotada | No reintentes hasta `X-RateLimit-Reset`; cachea más; cambia de plan |
| `403 email_not_verified` | El correo de la cuenta no está verificado | Verifícalo en [app.cotizave.com](https://app.cotizave.com). No reintentes |
| `403 endpoint_disabled` | Utilidad fuera de la referencia pública, deshabilitada | No es tu key ni tu plan. No reintentes en bucle |
| `400 unknown_parameter` | Parámetro que el endpoint no acepta (p. ej. `currency` en vez de `via`) | El `message` lista los aceptados |
| La skill no se activa | Instalada en otro directorio, o el prompt no menciona el dominio. Las preguntas cortas ("a cuánto está el dólar") no la activan a propósito | Verifica la ruta de la tabla, reinicia el agente o invócala explícitamente (`/cotizave`, `$cotizave`) |

## Compatibilidad

Rutas y comandos verificados contra la documentación oficial de cada herramienta el
2026-10-15; los agentes cambian rápido, así que ante la duda manda su documentación.

La skill usa solo campos del [estándar](https://agentskills.io/specification)
(`name`, `description`, `license`, `metadata`), sin extensiones propias de ningún
agente, y una única copia del contenido en `skills/cotizave/`.

| Agente | Formato `SKILL.md` | Descubrimiento | Instalación | Probado en este repo |
|---|---|---|---|---|
| Claude Code | Sí | Automático + `/cotizave` | Plugin, `npx skills`, manual | Manifiesto validado con Claude Code 2.1.301; activación implícita no evaluada |
| OpenAI Codex | Sí | Automático + `$cotizave` | `npx skills`, manual | Copia manual y descubrimiento con CLI 0.160.0; activación implícita no evaluada |
| Cursor | Sí | Automático + `/cotizave` | `npx skills`, manual | Solo documentación |
| GitHub Copilot (cloud agent, CLI, VS Code, JetBrains) | Sí | Automático + `/cotizave` | `gh skill install`, `npx skills`, manual | Solo documentación |
| OpenCode | Sí | Automático (herramienta `skill`) | `npx skills`, `gh skill install --agent opencode`, manual | Solo documentación |

## Versiones

- **Skill**: SemVer en `metadata.version` de `SKILL.md` (y en
  `.claude-plugin/marketplace.json`). Cambios en [CHANGELOG.md](CHANGELOG.md).
- **API**: la skill describe la API `/v1`. Una versión nueva de la skill no cambia la
  API, y la API puede sumar funciones sin que cambie la major de la skill. Si la API
  publicara `/v2`, la skill subiría de major.

## Publicar este repositorio en GitHub

Estos comandos son para quien mantiene el paquete. Ejecutarlos crea un commit y
publica los cambios; no forman parte de la instalación de la skill.

1. Crea o confirma el repositorio `cotizave/agent-skills` en GitHub. Para que
   cualquiera lo instale, debe ser público. Si lo creas para subir este checkout,
   déjalo vacío, sin generar otro README o licencia.
2. Desde la raíz local, valida y revisa qué vas a incluir:

   ```bash
   node scripts/validate.mjs
   node --test scripts/*.test.mjs
   node scripts/smoke-install.mjs
   git diff --check
   git status --short
   git remote -v
   ```

3. Si todavía no hay un remoto `origin`, añádelo:

   ```bash
   git remote add origin https://github.com/cotizave/agent-skills.git
   ```

   Si ya existe, comprueba su URL antes de continuar. Si el remoto ya contiene
   commits que no tienes, intégralos antes de subir; no uses un push forzado.

4. Tras revisar el conjunto de cambios, incluye también los archivos nuevos y
   las eliminaciones, comprueba lo preparado y publica la rama `master`:

   ```bash
   git add -A
   git diff --cached --stat
   git diff --cached
   git commit -m "feat(skill): prepara Cotizave 0.2.0 con fallback y validación"
   ```

   La rama publicada es `master`. Si el remoto tiene commits que no tienes,
   intégralos antes de subir; no uses un push forzado:

   ```bash
   git fetch origin
   git push -u origin master
   ```

5. Espera que termine correctamente el workflow de GitHub Actions. Después puedes
   etiquetar la versión preparada:

   ```bash
   git tag -a v0.2.0 -m "Cotizave skill 0.2.0"
   git push origin v0.2.0
   ```

   Antes del commit de publicación, actualiza la nota de versión preparada en
   `CHANGELOG.md` y su fecha si corresponde. No recrees un tag ya publicado.

Con el repositorio accesible, comparte los comandos de instalación de arriba.
Claude Code lo instala desde el marketplace del propio repositorio; Codex puede
descubrir la carpeta instalada. Publicar el repositorio no lo incluye
automáticamente en los catálogos oficiales de las plataformas.

Para actualizar una instalación de Claude Code desde GitHub:

```bash
claude plugin marketplace update cotizave-agent-skills
claude plugin update cotizave@cotizave-agent-skills
```

Abre una sesión nueva después de actualizar. En una instalación manual de Codex,
actualiza el checkout y reemplaza la copia instalada completa, incluyendo recursos
eliminados, después de revisar cualquier modificación local.

## Contenido

```
skills/cotizave/
├── SKILL.md                         # guía de decisión (se carga al activarse)
├── references/                      # detalle, se lee solo cuando hace falta
│   ├── endpoints.md
│   ├── errors-and-limits.md
│   ├── caching-and-freshness.md
│   └── integration-patterns.md      # algoritmo y reglas para cualquier lenguaje
├── assets/fixtures/                 # contrato de prueba incluido en la instalación
└── scripts/check-key.sh             # diagnóstico opcional, hace una llamada real
evals/                               # escenarios para evaluar el comportamiento del agente
scripts/validate.mjs                 # validación estática del repo
```

La skill no incluye código por lenguaje: enseña el contrato HTTP y un algoritmo de
referencia que el agente implementa en el lenguaje y con las bibliotecas del proyecto.
Es una única skill de integración, autónoma y sin dependencia de otra skill de
ingeniería. Para contribuir, ver [CONTRIBUTING.md](CONTRIBUTING.md).

Verificación reproducible del paquete: `node scripts/smoke-install.mjs`.
Con Codex CLI instalado, añade `--codex` para comprobar descubrimiento local sin
ejecutar un turno de modelo. No instala nada en los directorios personales.
La [evidencia documental](skills/cotizave/references/contract-evidence.md) distingue
los datos contrastados de las discrepancias pendientes con la documentación pública.

Documentación de la API: https://cotizave.com/docs · Soporte: support@cotizave.com

## Licencia

[MIT](LICENSE)

---

## In English

Official [Agent Skill](https://agentskills.io) that teaches AI coding agents (Claude
Code, OpenAI Codex, Cursor, GitHub Copilot, OpenCode, …) how to integrate the
[Cotizave API](https://cotizave.com/docs) — Venezuelan exchange rates (BCV official
rate, parallel dollar, Binance and other P2P markets, USD/EUR ↔ VES conversion,
history and BCV per-bank rates) — with correct auth, quota
and 429 handling, caching and freshness semantics.

```bash
# Claude Code plugin
claude plugin marketplace add cotizave/agent-skills
claude plugin install cotizave@cotizave-agent-skills

# Any agent (skills CLI)
npx skills add cotizave/agent-skills

# GitHub Copilot
gh skill install cotizave/agent-skills cotizave
```

Manual install: copy `skills/cotizave` into your agent's skills directory
(`.claude/skills/` for Claude Code; `.agents/skills/` for Codex, Cursor, Copilot and
OpenCode). Set your key as a server-side environment variable
`COTIZAVE_API_KEY`; never ship it to a browser. The skill content is written in
Spanish, the language of most Cotizave users; agents apply it regardless of the
language you prompt in.

License: [MIT](LICENSE).
