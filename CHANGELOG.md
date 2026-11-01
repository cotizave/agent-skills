# Changelog

Todos los cambios relevantes de la skill se documentan aquí. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y la versión, [SemVer](https://semver.org/lang/es/).
La versión de la skill es independiente de las versiones de API V1 y V2.

## [Unreleased]

## [0.3.5] - 2026-11-01

### Changed

- Set the Free monthly quota to 500 and adjust polling and cache guidance accordingly.

## [0.3.4] - 2026-11-01

### Fixed

- Align V1 spread access and bulk market validation with the current backend contract.

## [0.3.3] - 2026-11-01

### Fixed

- Align plan names, monthly quotas, minute limits and Free history retention with the current product catalogue.
- Add the authenticated V2 issuer directory and cross-currency conversion behavior.
- Remove public-route guidance and stale plan assumptions from V1 references and fixtures.

## [0.3.2] - 2026-10-31

### Changed

- Clarify the boundary between published V2 country-rate routes and conversion-only
  currency support, and direct rate discovery to the current coverage catalogue.
- Mark the contract-evidence reference as a historical V1 review and record the
  2026-10-31 documentation-source correction without claiming production deployment.

## [0.3.1] - 2026-10-31

### Changed

- Expand the language-independent V1 to V2 migration procedure with contract
  preservation, market ID mapping, history and bulk differences, persisted data,
  cache isolation, account permissions, local verification and rollback.
- Add paired synthetic VE rate fixtures, a V2 partial-bulk fixture and migration
  evaluation scenarios for existing clients, invoices, history and bulk conversion.
- Show a direct migration request in the README so users need not prepare a route
  mapping or share an API key in chat.

## [0.3.0] - 2026-10-30

- Document tested GitHub Copilot installation and distinguish GitHub CLI release
  publication from directory approval and the alternative tag workflow.
- Clarify the quick start and that skills.sh needs no package upload or submission.
- Remove the optional API-key diagnostic from the distributed skill; integrations
  still use server-side authentication under the consuming application's control.
- Prepare portable plugin package, Claude manifest, official brand assets and deterministic release ZIP.
- Add cross-platform validation, V2 synthetic fixtures and more evaluation scenarios.

- V2 multi-country integration guidance, discovery, plan-aware routes and V1 migration reference.
- Global activation metadata, installation guide and V2 evaluation scenarios.
- Audit evidence and unresolved public documentation contradictions.

## [0.2.0] - 2026-10-15

Versión publicada como tag `v0.2.0`.

### Added

- Prueba reproducible de copia instalable y descubrimiento con Codex CLI.
- Registro de fuentes públicas y verificación local del contrato con hashes y resultados.
- Evaluación histórica separada de la suite de producto; ejecución manual reproducible.
- Evaluación focalizada de fallback con código, resultados y regresión por edad
  de origen; la comparación general entre agentes sigue sin ejecutarse.

### Fixed

- Instalación manual incluye assets y crea el directorio destino.
- BCV no exige una hora fija en updated_at. Recibir un 200 no rejuvenece un dato antiguo.
- Una sola skill Cotizave autónoma, activación limitada al proveedor elegido y flujo
  proporcional al riesgo. Dependencias, pools e interfaces según el runtime.
- Política coherente de cancelación, plazo total, reintentos y fallback; precisión
  monetaria, aislamiento de cache y seguridad del endpoint propio.
- Diagnóstico de key: destino restringido, curlrc ignorado, límite de cuerpo,
  parser JSON, validación de éxito y salida sin texto remoto arbitrario.
- Validación estricta del subconjunto YAML y fixtures, sin seguir symlinks ni
  leer archivos de entorno; tests locales de regresión para el diagnóstico.

### Changed

- Índice por tarea, casos de uso y resolución de discrepancias de contrato.
- Recomendación explícita de fallback con el último dato válido de Cotizave
  y secuencias locales para comprobar vencimiento y recuperación. Evaluaciones
  añadidas como escenarios pendientes de ejecución.
- Fixtures trasladadas a `skills/cotizave/assets/fixtures/` para instalaciones
  autocontenidas. El script opcional requiere Bash 3.2+, curl 8.4+ y jq.
- Evaluaciones ampliadas y protocolo comparativo reproducible; los resultados
  anteriores se identifican como exploratorios y sin artefactos conservados.

## [0.1.0] - 2026-10-15

### Added

- Skill `cotizave` con guía de decisión, sección "Cuándo NO usar esta skill" y
  referencias de endpoints, errores/cuotas y cache/frescura.
- Fixtures JSON ilustrativas del contrato, para que cualquier
  integración las use en sus tests.
- `scripts/validate.mjs`: frontmatter, marketplace, versiones, links, evals, keys
  reales y términos no publicables.
- CI en GitHub Actions (validación, shellcheck y gitleaks).
- Plugin de Claude Code vía `.claude-plugin/marketplace.json`.
- `references/integration-patterns.md`: algoritmo de referencia en pseudocódigo y
  reglas para construir el cliente en cualquier lenguaje (tamaño de la integración,
  política HTTP, reintentos por resultado, credenciales, proxy para frontend/móvil,
  cache, observabilidad y tests). La skill no incluye código por lenguaje.
- `SKILL.md`: flujo de trabajo, trim de la key, checklist ampliado y descripción en
  tercera persona.
- `evals/`: escenarios de comportamiento y de activación, y resultados de una
  comparación con y sin la skill.
- README: OpenCode y rutas de usuario completas de Cursor y Copilot.

### Removed

- Ejemplos de código por lenguaje (`references/examples/`, `examples/`) y sus jobs de
  CI: la skill es independiente del lenguaje.

### Fixed

- Detalles del contrato documentados en la revisión inicial (sin evidencia
  conservada de verificación contra el backend): `402` sin `field`; headers `X-RateLimit-*`
  ausentes en `401`, `403` de cuenta y `402` por formato; `/bulk/convert` ignora
  campos desconocidos y no valida moneda base ni remesas; `/history` en modo colección
  devuelve `200` con `count: 0`; `/spread` con un market que no está cotizando da
  `400 invalid_against`; `402` de `/route` con `details.feature: "route"`; nuevos
  `405`, `504 query_timeout` y umbrales de `stale` de remesas, efectivo y casas de
  cambio; tabla de polling (cada 15 min sí cabe en Inicio).
- `check-key.sh`: no termina con código 5 ante un cuerpo no JSON y lee solo el último
  bloque de headers.

[Unreleased]: https://github.com/cotizave/agent-skills/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/cotizave/agent-skills/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/cotizave/agent-skills/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/cotizave/agent-skills/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/cotizave/agent-skills/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/cotizave/agent-skills/releases/tag/v0.1.0
