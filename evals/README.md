# Evaluación de la skill

Comprueba si un agente **con** la skill integra Cotizave mejor que **sin** ella, en
cualquier lenguaje. Lo que se evalúa es el comportamiento del agente, que no es
determinista; los ejemplos de contrato están en `skills/cotizave/assets/fixtures/`.

| Archivo | Qué contiene |
|---|---|
| `evals.json` | Escenarios con `prompt` y `expectations` verificables (formato de `skill-creator` de anthropics/skills) |
| `trigger-evals.json` | Consultas que deben activar la skill y otras que no (`should_trigger`) |

## Protocolo reproducible (propuesto; pendiente de ejecución)

Hay una [evaluación focalizada de fallback con artefactos](results/2026-10-15-fallback/REPORT.md).
Incluye código generado, defecto encontrado en revisión y regresión corregida.
No sustituye la comparación de tres brazos ni prueba activación implícita.

Compara tres brazos: A sin skill; B con la única skill `cotizave`; C sin skill y con
instrucciones generales del repositorio. En los tres usa el mismo contrato público
fijado de Cotizave, fixtures y proyecto inicial: así no confundes conocer la API con
mejor ingeniería. En C fija y conserva el texto exacto de las instrucciones generales.
A y B conservan las mismas instrucciones de entorno indispensables.

1. Fija modelo y versión, configuración de razonamiento, herramientas, permisos,
   presupuesto, runtime, dependencias, snapshot del proyecto y hash del contenido de
   la skill. Desactiva skills globales ajenas y sesiones/memoria anteriores.
2. Usa workspaces temporales aislados, red externa deshabilitada y solo credenciales
   ficticias. Compila/ejecuta el código generado contra transporte local; una respuesta
   solo en texto no demuestra que la solución funcione.
3. Ejecuta al menos 3 repeticiones por brazo como piloto, con orden aleatorio. No
   concluyas mejoras pequeñas con esa muestra; amplíala si la variación impide decidir.
   Repite por modelo/agente y compara resultados dentro de cada configuración.
4. Conserva prompt, diff, respuesta, herramientas/referencias leídas, comandos,
   resultados de tests, tokens, duración y razones de cada expectativa aprobada o fallida.
   Usa evaluadores ciegos al brazo para mantenibilidad, simplicidad e idiomaticidad;
   prioriza tests para corrección, contratos, aislamiento y recursos.
5. Separa pruebas de eficacia (carga explícita) de activación (descubrimiento real).
   Para estas últimas ofrece solo nombre/description mediante el mecanismo del agente,
   registra si carga SKILL.md y mide falsos positivos/negativos con trigger-evals.json.
   Pedir a otro agente que lea la skill no mide activación implícita.
6. Reserva casos nuevos para validar cambios: no optimices y concluyas sobre los mismos
   prompts. Reporta distribución/rango de resultados y evidencia por caso, sin una
   puntuación global que esconda una fuga de secretos o un importe incorrecto.

La matriz incluye Go, Python, TypeScript, PHP, Rust, C#, C++ y Java, con fallos de
concurrencia, aislamiento, dinero y migraciones de **esta integración**. Kotlin, Swift
 y Ruby requieren ampliar ejecuciones antes de declarar compatibilidad comprobada.
Los escenarios genéricos de autenticación, SQL o rendimiento sin Cotizave son negativos
de activación: esta no es una skill universal de ingeniería.

Criterios: corrección funcional, seguridad, contratos, regresiones, simplicidad,
compatibilidad idiomática y cambios innecesarios. Mide recursos/rendimiento cuando
el caso lo requiera, y tokens/contexto en todos los brazos. Una fuga de credenciales,
mezcla de cuentas o factura incorrecta bloquea ese caso aunque otros criterios pasen.

Guarda los artefactos bajo una carpeta de resultados con identificador de corrida;
no declares aprobado un escenario sin ellos. Los tests locales de scripts se ejecutan
con `node --test scripts/*.test.mjs` y son evidencia distinta de estas evaluaciones.

## Observaciones exploratorias anteriores (2026-10-15)

Registro heredado: no se conservan respuestas, versión exacta del modelo ni
artefactos de calificación. No se revalidó durante los fixes y no certifica la
versión actual. Se mantiene para trazabilidad, no como benchmark reproducible.

8 escenarios (los originales, antes de ampliar `evals.json`), Claude Sonnet, 1 corrida por brazo, respuestas solo en texto. En el
brazo "con skill" el agente leyó `SKILL.md` y solo las referencias que eligió. La skill
evaluada es la versión sin código por lenguaje: el agente tuvo que escribir el cliente a
partir del contrato y del algoritmo de referencia. Calificación manual contra las
`expectations`.

| Escenario | Sin skill | Con skill |
|---|---|---|
| `react-private-key` | Escribe el componente con la key en `VITE_` (lo advierte y sugiere un proxy como alternativa); inventa ruta y header (`Authorization: Bearer`) | Se niega a exponer la key; endpoint propio con trim de la key, timeout, sin redirecciones, cache, single-flight y fallback marcado; ruta y header correctos |
| `monthly-quota-429` | No reintenta el `monthly` y calcula bien el gasto (≈ 43.200/mes), pero no usa `X-RateLimit-Reset` y supone la API | No reintenta; bloquea hasta `X-RateLimit-Reset`, sirve el último valor, alerta; reintenta solo `burst`/5xx/red, acotado |
| `rust-no-example` | Ruta, parámetros y header inventados; sigue redirecciones; campos no opcionales | Trae `/v1/fx/rates/parallel` una vez y multiplica localmente (cache con single-flight); `Policy::none`, `https_only`, timeouts, `Option`, key con trim y error tipado con `scope` |
| `route-plan-gate` | Implementa `/route` sin saber que es de Escala; supone la autenticación | Indica que `/route` es solo Escala (`402`, `details.feature: "route"`); ante el 402 calcula con `/v1/fx/rates` excluyendo `reference`, `eur_reference` y base no USD |
| `python-bcv-rate` | Supone ruta (`/v1/rates/usd/bcv`), header `Bearer` y campo `rate`; sin `effective_date` | `/v1/fx/rates/reference`, `X-API-Key` con trim, timeout, sin redirecciones, cache, devuelve `mid` + `effective_date`, reintentos solo `burst`/5xx/red |
| `outage-fallback` | Buen diseño (job periódico, última tasa en BD) pero API supuesta y frescura del BCV medida con su propia hora de descarga (corta los Bs a las 72 h aunque la tasa siga vigente) | Cache compartido, último valor bueno sin expiración, single-flight con lock, bloqueo por `monthly`, distingue mostrar de cobrar, usa `effective_date` y 132 h |
| `eur-ves-conversion` | Supone campos (`quote`, `source: "official"`, `rate`) y header `Bearer`; mete el cuerpo de la respuesta en el error | `from=EUR&to=VES` sin `via` (default `eur_reference`); promedio filtrado por moneda base con la regla de `eur_reference` |
| `bulk-convert-shape` | Supone ruta (`/v1/convert/batch`), campos (`rate`, `converted`) y header `Bearer` | `POST /v1/fx/bulk/convert` con `from`/`to`/`amounts`/`market`; advierte que `via` se ignora; `results[i]` ↔ `amounts[i]`; no repite el POST |

Defectos que aparecieron **con** la skill:

- `route-plan-gate`: sigue llamando a `/route` en cada ejecución aunque sabe que dará
  `402`, dice que ese 402 gasta un request (no consume cuota) y duerme sin respetar
  la cancelación del `context`.
- `monthly-quota-429`: lee `X-RateLimit-Retry-After-Ms` con `||`, así que un valor `0`
  cae al siguiente header (inofensivo).
- `outage-fallback`: parsea `X-RateLimit-Reset` como segundos en vez de fecha ISO 8601,
  así que tras un `429 monthly` volvería a llamar cada hora. Corregido en el algoritmo
  de referencia, que ahora dice el formato.
- `python-bcv-rate`: un `2xx` con JSON roto sale como `ValueError` sin envolver (sigue
  siendo un error explícito).

## Limitaciones

- Una sola corrida por brazo y un solo modelo: sirve para detectar regresiones
  grandes, no para medir mejoras pequeñas.
- La calificación fue manual y quien calificó sabía qué brazo era cuál.
- `trigger-evals.json` todavía no se corrió: la activación solo se puede medir con la
  skill instalada en un agente real, no con subagentes a los que se les indica leerla.
- El registro anterior declara uso de Claude. No hay evidencia reproducible para
  ninguno de los agentes; OpenCode no se evaluó y Gemini CLI solo en descubrimiento.
