# Errores, cuotas y rate limits

Contenido: [Formato de error](#formato-de-error) · [Códigos y qué hacer](#códigos-y-qué-hacer) ·
[Planes y cuotas](#planes-y-cuotas) · [Headers](#headers) ·
[Algoritmo para manejar un 429](#algoritmo-para-manejar-un-429) ·
[Formatos CSV y XML](#formatos-csv-y-xml)

## Formato de error

Todos los errores son JSON (también cuando pediste CSV o XML), con
`Content-Type: application/json`:

```json
{
  "code": "feature_not_in_plan",
  "message": "This feature ('response_formats') requires a plan upgrade.",
  "details": { "feature": "response_formats", "current_plan": "free" }
}
```

- `code`: estable, `snake_case`. **Ramifica por aquí.**
- `message`: para desarrolladores, en inglés. No lo muestres tal cual al usuario final.
- `field`: opcional, el parámetro culpable (no viene en los `402`).
- `details`: opcional, datos estructurados (plan, límites, tiempos). En un `402` por
  endpoint o formato trae `feature` y `current_plan`; en un `402` por market trae
  `feature` y `market`.

## Códigos y qué hacer

| HTTP | `code` | Causa | Respuesta correcta |
|---|---|---|---|
| 400 | `unknown_parameter` | Parámetro de query que el endpoint no acepta | Corrige el código. El `message` lista los aceptados. No reintentar |
| 400 | `invalid_format` | Valor mal formado (monto, fecha, par de monedas, `via` incompatible, `format` inválido) | Corrige el input (`field`) |
| 400 | `missing_field` | Falta un parámetro o campo requerido | Corrige el input |
| 400 | `invalid_against` / `invalid_base` | `/v1/fx/spread` con market inexistente, `reference`, con base EUR o **ausente en ese momento** (un P2P sin cotización); base distinta de USD | Corrige el input; si el market es válido pero no está cotizando, trátalo como "sin dato" (no en bucle) |
| 401 | `invalid_api_key` | Key ausente, mal copiada o inexistente | Revisa `COTIZAVE_API_KEY`. No reintentar: muchos 401 seguidos desde una IP terminan en `429` temporal |
| 401 | `key_revoked` | Key revocada | Crea otra en el dashboard |
| 402 | `feature_not_in_plan` | El plan no incluye el endpoint, el market o el formato (`details.feature`) | Mensaje de upgrade o quitar lo que lo activó. **No reintentar.** No consume cuota |
| 403 | `account_inactive` | Cuenta suspendida | Contactar soporte. No reintentar |
| 403 | `email_not_verified` | El correo de la cuenta dueña de la key no está verificado | Verificarlo en https://app.cotizave.com. No reintentar |
| 403 | `history_out_of_retention` | Fecha más vieja que la retención del plan (`details`: `plan`, `max_days`, `requested_days_ago`) | Acotar el rango o subir de plan |
| 403 | `endpoint_disabled` | Utilidad fuera de esta referencia, deshabilitada | No es tu key ni tu plan. No reintentar en bucle |
| 404 | `resource_not_found` | Market inexistente o ausente, sin histórico para esa fecha (`?date=`), ruta inexistente | Verifica el market y la ruta; tolera que falte un P2P |
| 405 | `method_not_allowed` | Método HTTP equivocado (p. ej. `GET` a `/bulk/convert`) | Corrige el código |
| 404 | `bcv_snapshot_unavailable` | Publicación diaria del BCV aún no disponible | Manejar como "sin dato" |
| 406 | `format_not_available` | CSV de una respuesta con 2 colecciones (`/v1/fx/route`); `field: "format"` | Usar JSON o XML |
| 422 | `reference_unavailable` / `compared_unavailable` | `/v1/fx/spread`: una de las dos tasas está, pero sin valor válido | Reintentar en unos minutos (no en bucle) |
| 429 | `rate_limit_exceeded` | Burst, cuota mensual u otro tope (ver abajo) | Según `X-RateLimit-Scope` |
| 500 | `internal_error` | Error de Cotizave | Reintentos GET acotados con backoff + jitter; luego respaldo solo si cumple la política de vigencia |
| 503 | `service_unavailable` | No disponible temporalmente (trae `Retry-After`), o el market pedido no tiene cotización válida (`/convert`, `/bulk/convert`) | Respetar `Retry-After`, reintentos acotados |
| 504 | `query_timeout` | Consulta de histórico demasiado lenta | Acota el rango (`from`/`to`); no repitas la misma consulta en bucle |

Cualquier otro `5xx` se trata igual que `500`: pocos reintentos con
backoff + jitter, respetando `Retry-After` si viene. Nunca reemplaces el dato por un
valor inventado o "por defecto".

## Planes y cuotas

| Plan (id) | Requests/mes | rps sostenido | Burst | Histórico | Extras |
|---|---|---|---|---|---|
| Gratis (`free`) | 1.500 | 2 | 5 | 14 días | — |
| Inicio (`lite`) | 3.500 | 3 | 6 | 30 días | — |
| Esencial (`hobby`) | 20.000 | 3 | 8 | 90 días | CSV/XML, `paypal`, `zelle` |
| Profesional (`indie`) | 60.000 | 5 | 15 | 180 días | + `syklo`, `yadio`, `zoom`, `western_union` |
| Escala (`pro`) | 150.000 | 10 | 25 | 365 días | + `cash`, `cucuta`, `/route`, `/bulk/convert` |

Son los planes públicos; pueden cambiar. Precios vigentes:
https://cotizave.com/precios. En tiempo de ejecución, lo que manda es el `402` con
`details.feature`. Cada cuenta tiene 1 API key; la cuota es por cuenta.

- **El ciclo mensual se ancla al día de activación del plan** (en Gratis, al día de
  creación de la cuenta), no al día 1 del mes. `X-RateLimit-Reset` trae la fecha.
- **Cuentan:** los `2xx` y cualquier `4xx` salvo `401`, `402`, `403` y `429` (o sea,
  `400`, `404`, `406`, `422`… sí cuentan). **No cuentan:** `401`, `402`, `403`, `429`
  ni ningún `5xx`.
- `/v1/fx/bulk/convert` cuenta 1 por llamada (hasta 50 montos) y además tiene un tope
  de 300 llamadas por hora.

### Presupuesto de polling

| Intervalo | Requests/mes (1 endpoint) | Cabe en |
|---|---|---|
| cada 1 min | ~43.200 | Profesional+ |
| cada 5 min | ~8.640 | Esencial+ |
| cada 15 min | ~2.880 | Inicio+ |
| cada 30 min | ~1.440 | Gratis (justo) |
| cada 60 min | ~720 | Todos |

Multiplica por el número de endpoints distintos que consultas y por el número de
procesos si cada uno llama por su cuenta (evalúa coordinación si el presupuesto agregado no alcanza).

## Headers

En las respuestas que pasan la autenticación y el limitador (los `2xx` y casi todos los
`4xx`). **No** vienen en `401`, en los `403` de cuenta (`account_inactive`,
`email_not_verified`), en el `429` por keys inválidas ni en el `402` por formato: tu
código debe tolerar que falten.

| Header | Significado |
|---|---|
| `X-RateLimit-Limit` | Cuota mensual del plan |
| `X-RateLimit-Remaining` | Requests que quedan en el ciclo |
| `X-RateLimit-Reset` | ISO 8601 del próximo reinicio del ciclo |

Solo en un `429`:

| Header | Significado |
|---|---|
| `X-RateLimit-Scope` | `burst` (velocidad) o `monthly` (cuota) |
| `Retry-After` | Segundos enteros (mínimo 1). En `monthly`, segundos hasta el reset: **pueden ser semanas** |
| `X-RateLimit-Retry-After-Ms` | Espera exacta en ms (solo `burst`) |
| `X-RateLimit-Limit-Second` | rps sostenido del plan |
| `X-RateLimit-Burst` | Tamaño de ráfaga del plan |

Cuerpo del 429: `details.kind` repite el scope (`burst` | `monthly`) y
`details.retry_after` los segundos; en `burst` trae además `retry_after_ms` y en
`monthly`, `resets_at`.

Un `429` **sin** `X-RateLimit-Scope` es otro tope: las 300 llamadas por hora de
`/v1/fx/bulk/convert` (`Retry-After: 3600`) o demasiadas keys inválidas desde la
misma IP (`Retry-After: 300`). Ninguno se resuelve reintentando enseguida.

En un 429 por `burst`, `X-RateLimit-Remaining` sigue mostrando la cuota real: no la
interpretes como agotada.

## Algoritmo para manejar un 429

Resumen; la política completa de plazos y cancelación está en
[integration-patterns.md](integration-patterns.md#reintentos-y-plazo-total).

```text
si status == 429:
  scope = header X-RateLimit-Scope (o body.details.kind)
  si scope == "burst":
     espera = X-RateLimit-Retry-After-Ms  (o Retry-After * 1000)
     si espera + jitter no caben en el plazo total o máximo de espera: fallar
     esperar con cancelación (sin bloquear el event loop)
     reintentar (máx. 3 intentos en total); si persiste, bajar la concurrencia
  si scope == "monthly":
     NO reintentar. Marcar "cuota agotada hasta X-RateLimit-Reset",
     servir el último valor solo si su vigencia y el caso lo permiten; si no, fallar;
     avisar a una persona
     (log de error / alerta) y sugerir upgrade.
  si no hay scope:
     NO reintentar ahora; respetar Retry-After antes de volver a llamar.
```

Insistir contra el límite (429 sostenidos, reintentos sin backoff, rotar cuentas para
evadir la cuota) puede terminar en throttling adicional o suspensión según los
Términos. Un 429 ocasional bien manejado no tiene consecuencias.

## Formatos CSV y XML

- Se piden con `?format=csv|xml|json` o con `Accept: text/csv`, `application/xml`,
  `text/xml`, `application/json`. Si mandas ambos, **gana el query**. Un `Accept` que
  pide HTML (lo que mandan los navegadores) se ignora.
- Requieren plan **Esencial o superior**; en Gratis/Inicio → `402 feature_not_in_plan`
  (`details.feature: "response_formats"`). `?format=json` siempre es gratis. Un
  `format` desconocido → `400 invalid_format` (`field: "format"`).
- CSV (RFC 4180, coma separadora, punto decimal): si la respuesta tiene **una**
  colección, cada elemento es una fila y los campos sueltos se repiten (columnas
  prefijadas, p. ej. `rates.mid`; un array de valores simples va en una celda unido por
`|`); sin colecciones → una sola fila con campos anidados
  (`from.currency`); con dos o más → `406 format_not_available`.
- XML: sin atributos ni namespaces; los elementos de un array siempre son `<item>`
  (`/response/rates/item`).
- **Revisa el status antes de parsear**: los errores llegan en JSON.
- Excel en español espera `;`: importa con "Datos → Desde texto/CSV" eligiendo coma.
