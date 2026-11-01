# Errores, cuotas y rate limits

> The route-specific examples below describe V1 Venezuela. For new V2 integrations, use [V2 routes](api-v2.md) and adapt country, rate ID, permissions and source freshness. Do not carry V1 plan TTLs or market defaults into another country.

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
| 429 | `rate_limit_exceeded` | Límite temporal, cuota mensual u otro tope (ver abajo) | Inspecciona `Retry-After`, cabeceras y detalles disponibles |
| 500 | `internal_error` | Error de Cotizave | Reintentos GET acotados con backoff + jitter; luego respaldo solo si cumple la política de vigencia |
| 503 | `service_unavailable` | No disponible temporalmente (trae `Retry-After`), o el market pedido no tiene cotización válida (`/convert`, `/bulk/convert`) | Respetar `Retry-After`, reintentos acotados |
| 504 | `query_timeout` | Consulta de histórico demasiado lenta | Acota el rango (`from`/`to`); no repitas la misma consulta en bucle |

Cualquier otro `5xx` se trata igual que `500`: pocos reintentos con
backoff + jitter, respetando `Retry-After` si viene. Nunca reemplaces el dato por un
valor inventado o "por defecto".

## Planes y cuotas

Los IDs internos de los planes públicos no son sus nombres comerciales. Las cuotas y límites se comparten entre V1 y V2 y pueden cambiar: contrástalos con [cuotas oficiales](https://docs.cotizave.com/api/rate-limits.md), el catálogo del producto y la respuesta de la cuenta antes de fijarlos en una integración.

| Plan (id) | Solicitudes/mes | Solicitudes/minuto | Histórico |
|---|---:|---:|---:|
| Free (`free`) | 800 | 60 | 3 días |
| Basic (`hobby`) | 10.000 | 120 | 90 días |
| Growth (`indie`) | 40.000 | 180 | 180 días |
| Pro (`pro`) | 100.000 | 240 | 365 días |
| Pro Plus (`pro_extra`) | 250.000 | 360 | Verificar en el catálogo vigente |

CSV/XML y conversión histórica requieren Growth; rutas y bulk requieren Pro. Los permisos de una cuenta heredada pueden variar. La cuota es por cuenta, compartida entre claves: no presupongas una sola clave. Un `402` con `details.feature` informa una restricción de la cuenta, no un error transitorio.

- **El ciclo mensual se ancla a la activación del plan** (en Free, a la creación de la cuenta), no al día 1 del mes. Consulta `X-RateLimit-Reset`.
- **Cuentan:** los `2xx` y los errores de validación o recurso como `400`, `404`, `406` y `422`. **No cuentan:** `401`, `402`, `403`, `429` ni `5xx`.
- `/v1/fx/bulk/convert` cuenta 1 por llamada (hasta 50 montos) y tiene además un tope de 300 llamadas por hora.

### Presupuesto de polling

Con un endpoint y un ciclo de 30 días: cada minuto consume ~43.200 llamadas; cada 5 minutos ~8.640; cada 15 minutos ~2.880; cada 30 minutos ~1.440; cada hora ~720. Free solo cubre aproximadamente una llamada por hora si no hay otros consumos. Multiplica por endpoints, procesos y reintentos; usa caché o coordinación según el caso.

## Headers

Una respuesta puede omitir las cabeceras del limitador, en particular ante fallos de autenticación o del proxy. No hagas depender el parser de su presencia.

| Header | Significado |
|---|---|
| `X-RateLimit-Limit` | Cuota mensual del plan |
| `X-RateLimit-Remaining` | Solicitudes restantes en el ciclo |
| `X-RateLimit-Reset` | Siguiente reinicio del ciclo, ISO 8601 |
| `Retry-After` | Espera indicada en un 429/503; admite segundos o fecha HTTP |

## Algoritmo para manejar un 429

Distingue el límite de solicitudes por minuto, la cuota mensual y otros límites usando el código, cabeceras y detalles que efectivamente devuelva la respuesta. Para un límite temporal, respeta `Retry-After`, agrega jitter, reduce concurrencia y acota intentos y tiempo total. Si se agotó la cuota mensual, detén nuevas llamadas hasta el reinicio o un cambio confirmado de cuota. Para otro 429, como el tope horario de bulk o la protección por IP, evita reintentos inmediatos. Nunca deduzcas que la cuota mensual se agotó solo porque llegó un 429. La política de plazos y cancelación está en [patrones de integración](integration-patterns.md#reintentos-y-plazo-total).

## Formatos CSV y XML

- Se piden con `?format=csv|xml|json` o con `Accept: text/csv`, `application/xml`,
  `text/xml`, `application/json`. Si mandas ambos, **gana el query**. Un `Accept` que
  pide HTML (lo que mandan los navegadores) se ignora.
- Requieren plan **Growth o superior**; en Free/Basic → `402 feature_not_in_plan`
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
