# Evaluación focalizada — 2026-10-15

Se encargó a un agente independiente una integración Node con transporte y reloj
inyectados, sin darle las respuestas esperadas de evals. El
[prompt](prompt.txt), [código final](client.mjs), [tests](client.test.mjs),
[salida](test-results.txt) y [decisiones](DECISIONS.md) están conservados.
Estos archivos son evidencia de evaluación: no se instalan con la skill y no son
un SDK ni ejemplos oficiales para copiar a producción.

## Resultado y corrección

La primera versión pasó 14 tests propios. La revisión detectó que una descarga
reciente podía rejuvenecer un dato antiguo. Tres regresiones añadidas fallaron
contra esa implementación; se conserva la [salida negativa](test-results.initial-regression.txt).
La versión corregida pasa 20 tests, incluidos edad de origen, BCV sin admisibilidad,
base incompatible y recuperación sin declarar vigente un dato viejo.

También se comprueban cache vacío, límite de tolerancia, JSON inválido, bloqueo
mensual, reset, market incompatible, cancelación y refresco concurrente. La skill
ahora explicita que recibir nuevamente una cotización no renueva su vigencia.

## Repetir desde la raíz del repositorio

```sh
node --test evals/results/2026-10-15-fallback/client.test.mjs
node scripts/smoke-install.mjs
node scripts/smoke-install.mjs --codex
claude plugin validate .
```

Runtime observado: Node v26.4.0, Codex CLI 0.160.0, Claude Code 2.1.301.
La copia aislada conserva bytes y referencias en `.agents/skills` y
`.claude/skills`. Codex descubre la copia habilitada mediante `skills/list`.
Claude valida el manifiesto. El test de copia forma parte de CI. Los 20 tests
del artefacto se ejecutan manualmente como evidencia histórica, fuera de la suite
de producto. El manifiesto SHA-256 conserva el estado al cerrar esa corrida;
los cambios posteriores de la skill no se atribuyen a esa evaluación.

Para reproducir el defecto original (se espera salida 1):

```sh
node --test --test-name-pattern='ancient upstream|same old upstream|BCV fallback defaults' evals/results/2026-10-15-fallback/regression-initial.mjs
```

## Alcance

Es una ejecución focalizada seguida de revisión y corrección, no el benchmark A/B/C
propuesto en evals. No demuestra activación implícita, compatibilidad ejecutada de
Cursor/Copilot/OpenCode, HTTP real, precisión monetaria ni persistencia de facturas.
La política de vigencia BCV de los tests es artificial, no un calendario de producción.

No se conservó un snapshot de la primera lectura de la skill; el
[manifiesto SHA-256](skill-final-sha256.json) identifica solo el estado final.
El identificador exacto del modelo y métricas de consumo no están disponibles.
Las fixtures se copiaron al comienzo y se conservaron. No hubo llamadas a la API
de Cotizave ni uso de credenciales. La documentación pública se consultó por separado
para la [revisión del contrato](../../../skills/cotizave/references/contract-evidence.md).
