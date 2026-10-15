# Errores, cuotas y rate limits

## Formato de error

Todos los errores son JSON (también cuando pediste CSV o XML), con
`Content-Type: application/json`:

```json
{
  "code": "feature_not_in_plan",
  "message": "This feature ('response_formats') requires a plan upgrade.",
  "field": "format",
  "details": { "feature": "response_formats", "current_plan": "free" }
}
```

- `code`: estable, `snake_case`. **Ramifica por aquí.**
- `message`: para desarrolladores, en inglés. No lo muestres tal cual al usuario final.
- `field`: opcional, el parámetro culpable.
- `details`: opcional, datos estructurados (plan, límites, tiempos).

## Códigos y qué hacer

| HTTP | `code` | Causa | Respuesta correcta |
|---|---|---|---|
| 400 | `unknown_parameter` | Parámetro de query que el endpoint no acepta | Corrige el código. El `message` lista los aceptados. No reintentar |
| 400 | `invalid_format` | Valor mal formado (monto, fecha, par de monedas, `via` incompatible, `format` inválido) | Corrige el input (`field`) |
| 400 | `missing_field` | Falta un parámetro requerido | Corrige el input |
| 400 | `invalid_against` / `invalid_base` | `/v1/fx/spread` con market o base inválidos | Corrige el input |
| 401 | `invalid_api_key` | Key ausente, mal copiada o inexistente | Revisa `COTIZAVE_API_KEY`. No reintentar |
| 401 | `key_revoked` | Key revocada | Crea otra en el dashboard |
| 402 | `feature_not_in_plan` | El plan no incluye el endpoint, el market o el formato (`details.feature`) | Mensaje de upgrade o quitar lo que lo activó. **No reintentar.** No consume cuota |
| 403 | `account_inactive` | Cuenta suspendida | Contactar soporte |
| 403 | `history_out_of_retention` | Fecha más vieja que la retención del plan (`details.max_days`) | Acotar el rango o subir de plan |
| 403 | `endpoint_disabled` | Utilidad deshabilitada temporalmente | No reintentar en bucle |
| 404 | `resource_not_found` | Market inexistente o ausente, sin histórico para esa fecha | Verifica el market; tolera que falte un P2P |
| 404 | `bank_not_found` / `bcv_snapshot_unavailable` | Banco inexistente / snapshot BCV aún no disponible | Manejar como "sin dato" |
| 406 | `format_not_available` | CSV de una respuesta con 2 colecciones (`/v1/fx/route`) | Usar JSON o XML |
| 422 | `reference_unavailable` / `compared_unavailable` | `/v1/fx/spread` sin dato de alguna de las dos tasas | Reintentar en unos minutos |
| 429 | `rate_limit_exceeded` | Burst o cuota mensual (ver abajo) | Según `X-RateLimit-Scope` |
| 500 | `internal_error` | Error de Cotizave | Backoff exponencial + jitter; servir el último valor bueno |
| 503 | `service_unavailable` | No disponible temporalmente (trae `Retry-After`) | Respetar `Retry-After`, backoff |

Cualquier otro `5xx` se trata igual que `500`: backoff + jitter, respetando
`Retry-After` si viene.

## Planes y cuotas

| Plan (id) | Requests/mes | rps sostenido | Burst | Histórico | Extras |
|---|---|---|---|---|---|
| Gratis (`free`) | 1.500 | 2 | 5 | 14 días | — |
| Inicio (`lite`) | 3.500 | 3 | 6 | 30 días | — |
| Esencial (`hobby`) | 20.000 | 3 | 8 | 90 días | CSV/XML, `paypal`, `zelle` |
| Profesional (`indie`) | 60.000 | 5 | 15 | 180 días | + `syklo`, `yadio`, `zoom`, `western_union`, `/route` |
| Escala (`pro`) | 150.000 | 10 | 25 | 365 días | + `cash`, `cucuta`, `/bulk/convert` |

Precios vigentes y planes mayores: https://cotizave.com/precios. Cada cuenta tiene 1
API key; la cuota es por cuenta.

- **El ciclo mensual se ancla al día de activación del plan** (en Gratis, al día de
  creación de la cuenta), no al día 1 del mes. `X-RateLimit-Reset` trae la fecha.
- **Cuentan:** `2xx`, `400`, `404`. **No cuentan:** `401`, `402`, `403`, `429`, `5xx`.
- `/v1/fx/bulk/convert` cuenta 1 por llamada (hasta 50 montos) y además tiene un tope
  de 300 llamadas por hora.

### Presupuesto de polling

| Intervalo | Requests/mes (1 endpoint) | Cabe en |
|---|---|---|
| cada 1 min | ~43.200 | Profesional+ |
| cada 5 min | ~8.640 | Esencial+ |
| cada 15 min | ~2.880 | Inicio no; Esencial+ |
| cada 30 min | ~1.440 | Gratis (justo) |
| cada 60 min | ~720 | Todos |

Multiplica por el número de endpoints distintos que consultas y por el número de
procesos si cada uno llama por su cuenta (por eso el cache debe ser compartido).

## Headers

En cada respuesta:

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

Cuerpo del 429: `details.kind` repite el scope (`burst` | `monthly`); en `burst` trae
`retry_after_ms` y en `monthly` trae `resets_at`.

En un 429 por `burst`, `X-RateLimit-Remaining` sigue mostrando la cuota real: no la
interpretes como agotada.

## Algoritmo para manejar un 429

```text
si status == 429:
  scope = header X-RateLimit-Scope (o body.details.kind)
  si scope == "burst":
     espera = X-RateLimit-Retry-After-Ms  (o Retry-After * 1000)
     dormir(espera + jitter aleatorio de 0–250 ms)
     reintentar (máx. 3 veces); si persiste, bajar la concurrencia
  si scope == "monthly":
     NO reintentar. Marcar "cuota agotada hasta X-RateLimit-Reset",
     servir el último valor cacheado, avisar a una persona
     (log de error / alerta) y sugerir upgrade.
```

Insistir contra el límite (429 sostenidos, reintentos sin backoff, rotar cuentas para
evadir la cuota) puede terminar en throttling adicional o suspensión según los
Términos. Un 429 ocasional bien manejado no tiene consecuencias.

## Formatos CSV y XML

- Se piden con `?format=csv|xml|json` o con `Accept: text/csv`, `application/xml`,
  `text/xml`, `application/json`. Si mandas ambos, **gana el query**. Un `Accept` que
  pide HTML (lo que mandan los navegadores) se ignora.
- Requieren plan **Esencial o superior**; en Gratis/Inicio → `402 feature_not_in_plan`
  (`details.feature: "response_formats"`). `?format=json` siempre es gratis.
- CSV (RFC 4180, coma separadora, punto decimal): si la respuesta tiene **una**
  colección, cada elemento es una fila y los campos sueltos se repiten (columnas
  prefijadas, p. ej. `rates.mid`); sin colecciones → una sola fila con campos anidados
  (`from.currency`); con dos o más → `406 format_not_available`.
- XML: sin atributos ni namespaces; los elementos de un array siempre son `<item>`
  (`/response/rates/item`).
- **Revisa el status antes de parsear**: los errores llegan en JSON.
- Excel en español espera `;`: importa con "Datos → Desde texto/CSV" eligiendo coma.
