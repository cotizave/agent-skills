# Referencia de endpoints

Base URL `https://api.cotizave.com`. Todos requieren `X-API-Key: $COTIZAVE_API_KEY`.
Las respuestas de ejemplo están recortadas; los números son ilustrativos.
Consulta la [evidencia del contrato](contract-evidence.md) para el alcance de la
revisión pública y sus diferencias con ejemplos heredados.

Reglas comunes:

- `/convert`, `/spread`, `/route` y `/history` rechazan parámetros de query
  desconocidos con `400 unknown_parameter` (el `field` nombra el parámetro y el
  `message` lista los aceptados). El resto los ignora en silencio: no mandes
  parámetros que no estén en esta referencia.
- `?format=csv|xml` (o header `Accept: text/csv` / `application/xml`) funciona en
  todos estos endpoints desde el plan Esencial. Ver
  [errors-and-limits.md](errors-and-limits.md#formatos-csv-y-xml).
- Los valores son números JSON. Conserva precisión y aplica el redondeo del negocio
  al fijar importes; el formato visual es independiente. Ver
  [dinero y persistencia](integration-patterns.md#dinero-y-persistencia).
- Todas las tasas expresan **VES por 1 unidad de la moneda base** (USD, salvo
  `eur_reference`, que es EUR).

Índice:
[/v1/fx/rates](#get-v1fxrates) ·
[/v1/fx/rates/:market](#get-v1fxratesmarket) ·
[/v1/fx/convert](#get-v1fxconvert) ·
[/v1/fx/bulk/convert](#post-v1fxbulkconvert) ·
[/v1/fx/spread](#get-v1fxspread) ·
[/v1/fx/index](#get-v1fxindex) ·
[/v1/fx/rates/:market/history](#get-v1fxratesmarkethistory) ·
[/v1/fx/route](#get-v1fxroute) ·
[/v1/fx/bcv/banks](#get-v1fxbcvbanks) ·
[/v1/fx/bcv/currencies](#get-v1fxbcvcurrencies)

---

## GET /v1/fx/rates

Snapshot completo: todas las tasas que tu plan incluye + Cotizave Index. Es el
endpoint principal. Sin parámetros (salvo `format`).

```json
{
  "country": "VE",
  "currency": "VES",
  "base": "USD",
  "rates": [
    { "market": "reference", "type": "reference", "base": "USD", "mid": 877.9023,
      "updated_at": "2026-10-14T04:00:00Z", "effective_date": "2026-10-14" },
    { "market": "eur_reference", "type": "reference", "base": "EUR", "mid": 982.7589,
      "updated_at": "2026-10-14T04:00:00Z", "effective_date": "2026-10-14" },
    { "market": "parallel", "type": "parallel", "base": "USD", "mid": 1009.6971,
      "updated_at": "2026-10-14T21:01:08Z" },
    { "market": "binance", "type": "p2p", "base": "USD", "ask": 1012.40, "bid": 1010.70,
      "mid": 1011.55, "updated_at": "2026-10-15T03:30:10Z" }
  ],
  "index": {
    "value": 971.0851, "version": "v1", "as_of": "2026-10-15T03:31:30Z",
    "weights": { "bcv": 0.30, "paralelo": 0.20, "p2p": 0.50 },
    "components": { "bcv": 877.9023, "paralelo": 1009.6971, "p2p": 1011.55 },
    "p2p_median": 1011.55, "p2p_count": 7, "flags": {}
  },
  "fetched_at": "2026-10-15T03:31:30Z"
}
```

Campos de cada `rates[]`:

| Campo | Notas |
|---|---|
| `market` | Identificador (ver la tabla de markets en SKILL.md). |
| `type` | `reference`, `parallel`, `p2p`; los markets de pago también pueden ser `remittance`, `cash`, `exchange_house`, entre otros. Trata valores desconocidos sin romper. |
| `base` | `USD` o `EUR`. Puede faltar: si falta, asume USD salvo en `eur_reference`. |
| `ask` / `bid` | Solo en los markets que publican compra y venta (paralelo, P2P). Omitidos en `reference`. |
| `mid` | Siempre presente. Usa este. |
| `updated_at` | ISO 8601 de actualización. No exijas una hora fija en BCV ni lo confundas con la descarga local; usa `effective_date` para fecha valor. |
| `effective_date` | `YYYY-MM-DD`, solo en `reference`/`eur_reference`. Fecha valor. |
| `stale_after_sec` | Opcional. Umbral de frescura del market, en segundos; si viene, manda sobre cualquier umbral por defecto. |

- El orden de `rates[]` no está garantizado: busca por `market`.
- Los markets fuera de tu plan se omiten en silencio (aquí no hay 402).
- Un P2P sin cotización en ese momento puede no aparecer, y pueden aparecer markets o
  `type` nuevos: no valides contra una lista cerrada.

## GET /v1/fx/rates/:market

Una sola tasa. Mismo objeto que un elemento de `rates[]`. Sin parámetros de query.

```json
{ "market": "reference", "type": "reference", "base": "USD", "mid": 877.9023,
  "updated_at": "2026-10-14T04:00:00Z", "effective_date": "2026-10-14" }
```

Errores: `404 resource_not_found` (market inexistente o ausente del snapshot),
`402 feature_not_in_plan` (market gateado: `details.feature` = `remittance`,
`extended_markets` o `cash_markets`, y `details.market`).

Regla práctica de los docs: 1–2 tasas → este endpoint; más → `/v1/fx/rates`.

## GET /v1/fx/convert

Convierte un monto. Todos los planes.

| Param | Req. | Valores |
|---|---|---|
| `from` | sí | `USD`, `EUR`, `VES` |
| `to` | sí | `USD`, `EUR`, `VES` (≠ `from`; uno de los dos **debe** ser `VES`) |
| `amount` | sí | número > 0 y ≤ 1e12 |
| `via` | no | cualquier market del snapshot. **Default: `reference` (BCV) para USD, `eur_reference` para EUR** |
| `market` | no | alias de `via` (si vienen ambos, gana `via`) |

```json
{
  "from": { "currency": "USD", "amount": 100 },
  "to":   { "currency": "VES", "amount": 87790.23 },
  "rate": 877.9023,
  "market": "reference",
  "type": "reference",
  "updated_at": "2026-10-14T04:00:00Z",
  "effective_date": "2026-10-14",
  "staleness_sec": 84690,
  "stale": false
}
```

- `to.amount = amount × rate` si vas hacia VES; `amount / rate` si sales de VES.
- `effective_date` solo con `reference`/`eur_reference`: archívala si facturas.
- `staleness_sec` = edad en segundos; `stale` = superó el umbral de ese market.
- `400 invalid_format` con `field: "via"` si el market cotiza en otra moneda
  (p. ej. `eur_reference` con `from=USD`) o si pides VES→USD por un market de remesa
  (`paypal`, `zelle`, `western_union`).
- Otros errores: `400 missing_field` (falta `from` o `to`), `400 invalid_format`
  (`amount` no numérico, ≤ 0 o > 1e12; monedas no soportadas o iguales),
  `402 feature_not_in_plan` (`via` gateado), `404 resource_not_found` (`via` inexistente).
- Si conviertes muchos montos por minuto, trae `/v1/fx/rates` una vez y multiplica tú.

## POST /v1/fx/bulk/convert

Hasta 50 montos con **una** tasa, 1 unidad de cuota. **Solo plan Escala**
(`402 feature_not_in_plan`, `details.feature: "bulk_convert"` en los demás). Límite
adicional de 300 llamadas por hora: excederlo → `429 rate_limit_exceeded` **sin**
`X-RateLimit-Scope` y con `Retry-After: 3600` (no reintentes antes).

Body (JSON):

| Campo | Req. | Notas |
|---|---|---|
| `from` | sí | `USD` o `VES` |
| `to` | sí | `VES` o `USD`, distinto de `from` |
| `amounts` | sí | `number[]`, de 1 a 50 elementos, cada uno > 0 y ≤ 1e12 |
| `market` | no | default `reference`. Usa un market con base USD y, para VES→USD, nunca una remesa: **aquí la API no lo valida** (con `eur_reference` aplica la tasa EUR sin error) |

```json
{
  "rate": 1009.6971, "market": "parallel", "type": "parallel",
  "updated_at": "2026-10-14T21:01:08Z",
  "results": [
    { "amount": 100, "result": 100969.71 },
    { "amount": 250, "result": 252424.28 },
    { "amount": 500, "result": 504848.55 }
  ],
  "total_in": 850, "total_out": 858242.54
}
```

`results[i]` corresponde a `amounts[i]`. Headers: `X-RateLimit-Cost: 1`,
`X-Bulk-Operations: <n>`, `X-Bulk-RateLimit-Limit` y `X-Bulk-RateLimit-Remaining`.
Errores: más de 50 montos → `400 invalid_format` (`field: "amounts"`,
`details: {max, got}`); lista vacía → `400 missing_field`; un monto ≤ 0 o > 1e12 →
`400 invalid_format`; JSON inválido → `400 invalid_format`; `market` gateado → `402`;
market sin cotización válida → `503`. **Los campos desconocidos del body se ignoran en
silencio**: un `via` se descarta y se usa `reference`; `items` sin `amounts` → `400
missing_field`. No existe `items` ni `via` en este endpoint: si ves ejemplos así, están
desactualizados.

## GET /v1/fx/spread

Brecha entre BCV (`reference`) y otro market. Todos los planes.

| Param | Default | Valores |
|---|---|---|
| `against` | `parallel` | `parallel`, cualquier P2P (`binance`, `bybit`, …) u otro market de tu plan; no `reference` |
| `base` | `USD` | solo `USD` |

```json
{
  "reference": { "market": "reference", "value": 877.9023, "updated_at": "2026-10-14T04:00:00Z" },
  "compared":  { "market": "binance",   "value": 1011.55,  "updated_at": "2026-10-15T03:30:10Z" },
  "spread": { "absolute": 133.6477, "percentage": 15.22, "direction": "higher" },
  "fetched_at": "2026-10-15T03:31:30Z"
}
```

`direction`: `higher` | `lower` | `equal`. Errores: `400 invalid_against` (market
inexistente, `reference`, con base EUR **o ausente del snapshot en ese momento**, p. ej.
un P2P que no está cotizando), `400 invalid_base`, `402 feature_not_in_plan` (market
gateado), `422 reference_unavailable` / `422 compared_unavailable` (la tasa está pero
sin un valor válido).

## GET /v1/fx/index

Cotizave Index: VES por 1 USD ponderado BCV 30 % + paralelo 20 % + mediana P2P 50 %.
Todos los planes. Sin parámetros. También viene embebido en `/v1/fx/rates` (`index`).

```json
{
  "value": 971.0851, "version": "v1", "as_of": "2026-10-15T03:31:30Z",
  "weights": { "bcv": 0.30, "paralelo": 0.20, "p2p": 0.50 },
  "components": { "bcv": 877.9023, "paralelo": 1009.6971, "p2p": 1011.55 },
  "p2p_median": 1011.55, "p2p_count": 7,
  "flags": {},
  "methodology_url": "https://cotizave.com/docs/cotizave-index"
}
```

`flags` (todos opcionales): `bcv_stale` (BCV > 132 h sin renovarse; su peso se
redistribuye y `weights` cambia), `degraded` (< 4 exchanges P2P), `missing_sources`,
`outliers_excluded`. Lee los `weights` efectivos, no asumas 30/20/50.

## GET /v1/fx/rates/:market/history

Histórico de un market. Todos los planes; **la profundidad depende del plan** (ver la
columna "Histórico" en [errors-and-limits.md](errors-and-limits.md#planes-y-cuotas)).

`:market`: cualquier market del catálogo (`reference`, `eur_reference`, `parallel`,
los P2P…). Los gateados piden su feature (`402`). Con `?date=` y sin registros →
`404`; en modo colección, un rango sin datos (o un market inexistente) responde `200`
con `count: 0` y `points: []`: no asumas que hay datos.

| Param | Modo | Notas |
|---|---|---|
| `date` | punto | `YYYY-MM-DD` (UTC). Devuelve **1 objeto**: el último registro capturado **en o antes** de esa fecha. No puede ser futura. |
| `from`, `to` | colección | `YYYY-MM-DD`, inclusivos. Por defecto: desde lo más antiguo que permite tu plan hasta hoy. Un `to` futuro se recorta a hoy. |
| `granularity` | colección | `daily` (default, un cierre por día) o `raw` (cada captura, máx. 5.000 puntos: se conservan los **más recientes**, `truncated: true` y el `from` de la respuesta pasa al primer punto devuelto). |

Sin parámetros → colección con toda tu ventana de retención.

```json
{ "market": "reference", "date": "2026-10-04", "rate": 870.12,
  "updated_at": "2026-10-02T04:00:00Z", "captured_at": "2026-10-03T20:35:12Z" }
```

```json
{
  "market": "binance", "from": "2026-10-01", "to": "2026-10-07",
  "granularity": "daily", "count": 7,
  "points": [
    { "date": "2026-10-01", "rate": 995.20, "updated_at": "…", "captured_at": "…" }
  ]
}
```

Para BCV, el `rate` de un día es la tasa que estaba publicada al capturarse: revisa
su `updated_at` (fecha valor) antes de asumir que rige ese mismo día. En el ejemplo, el
domingo 4 rige la tasa con fecha valor del viernes 2. `date` se interpreta en UTC,
mientras que la fecha valor del BCV es del calendario de Caracas (UTC−4).

Errores: `400 invalid_format` (fecha mal formada o futura, `from > to`, granularity
inválida), `403 history_out_of_retention` (más vieja que lo que permite tu plan;
`details.max_days`), `404 resource_not_found` (sin registros en o antes de esa fecha),
`503 service_unavailable` (histórico no disponible temporalmente), `504 query_timeout`
(rango demasiado pesado: acótalo).
Los datos de los últimos días pueden ajustarse: cachea a largo plazo solo las fechas
con más de 3 días de antigüedad y revalida lo que incluya los últimos 3 días (TTL
≤ 1 h).

## GET /v1/fx/route

Mejor mercado ejecutable para un monto USD↔VES + alternativas ordenadas. **Solo plan
Escala**: en los demás → `402 feature_not_in_plan` con `details.feature: "route"`
(Profesional tampoco lo incluye).

| Param | Req. | Default | Notas |
|---|---|---|---|
| `from`, `to` | sí | — | `USD`/`VES` |
| `amount` | sí | — | > 0 y ≤ 1e12 |
| `direction` | no | `send` | `send` = maximizar el monto de destino; `receive` = ordenar por el menor monto de destino |
| `max_staleness` | no | `0` | segundos; `0` = sin filtro |

```json
{
  "from": { "currency": "USD", "amount": 1000 },
  "direction": "send",
  "best": { "market": "mexc", "type": "p2p", "rate": 1015.10, "amount": 1015100.00,
            "updated_at": "2026-10-15T03:30:10Z", "staleness_sec": 80 },
  "alternatives": [ { "market": "binance", "type": "p2p", "rate": 1011.55, "amount": 1011550.00,
                      "updated_at": "2026-10-15T03:30:10Z", "staleness_sec": 80 } ],
  "skipped": [ { "market": "reference", "reason": "not_executable" } ],
  "fetched_at": "2026-10-15T03:31:30Z"
}
```

`skipped[].reason`: `not_executable` (referencias del BCV y casas de cambio no son un
mercado), `currency_mismatch` (`eur_reference`), `feature_not_in_plan`,
`one_way_market` (remesas en VES→USD), `no_quote`, `stale` (superó `max_staleness`).
`skipped` se omite cuando está vacío.
Si ningún market califica → `503 service_unavailable`. En CSV responde `406` (dos
colecciones); usa JSON o XML.

## GET /v1/fx/bcv/banks

Compra/venta USD por institución, tal como lo publica el BCV, 1 vez al día. Todos los
planes. Sin parámetros.

```json
{
  "indicator_date": "2026-10-13",
  "bank_rates": [
    { "bank": "Banesco", "buy": 875.10, "sell": 880.25 },
    { "bank": "N58 Banco Digital", "buy": 876.00, "sell": 879.90 },
    { "bank": "Otras Instituciones", "buy": 874.80, "sell": 881.00 }
  ],
  "captured_at": "2026-10-14T12:15:03Z"
}
```

- La lista de bancos **varía de un día a otro** (el BCV rota entidades): no asumas una
  lista fija ni normalices nombres (`bank` llega tal como lo publica el BCV).
- `404 bcv_snapshot_unavailable` si la publicación del día todavía no está disponible.

## GET /v1/fx/bcv/currencies

Tasas oficiales BCV de EUR, CNY, TRY y RUB (VES por unidad). USD no viene aquí (está
en `/v1/fx/rates/reference`). Misma publicación diaria que `/bcv/banks`. Todos los planes.

```json
{
  "reference_value_date": "2026-10-14",
  "reference_value_date_text": "Martes, 14 Octubre 2026",
  "rates": { "EUR": 982.7589, "CNY": 123.21, "TRY": 21.03, "RUB": 10.87 },
  "captured_at": "2026-10-14T12:15:03Z"
}
```

Para contabilidad usa `reference_value_date` (fecha valor), no `captured_at`.

---

## Fuera de esta referencia

Existen otras utilidades de Venezuela (catálogo de bancos, validación de RIF y de
cuenta bancaria, feriados y días hábiles) que **no** forman parte de la referencia
pública de la API y pueden no estar habilitadas para tu cuenta (responden
`403 endpoint_disabled`). No las uses sin confirmar antes en
https://cotizave.com/docs o con support@cotizave.com.
