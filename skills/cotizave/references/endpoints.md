# Referencia de endpoints

Base URL `https://api.cotizave.com`. Todos requieren `X-API-Key: $COTIZAVE_API_KEY`.
Las respuestas de ejemplo están recortadas; los números son ilustrativos.

Reglas comunes:

- Parámetros de query desconocidos → `400 unknown_parameter` (el `field` nombra el
  parámetro y el `message` lista los aceptados).
- `?format=csv|xml` (o header `Accept: text/csv` / `application/xml`) funciona en
  todos estos endpoints desde el plan Esencial. Ver
  [errors-and-limits.md](errors-and-limits.md#formatos-csv-y-xml).
- Los valores son `number` JSON (double). Redondea al mostrar.
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
[/v1/fx/bcv/currencies](#get-v1fxbcvcurrencies) ·
[/v1/banks](#get-v1banks) ·
[/v1/banks/:code](#get-v1bankscode)

---

## GET /v1/fx/rates

Snapshot completo: todas las tasas que tu plan incluye + Cotizave Index. Es el
endpoint principal. **No acepta parámetros** (salvo `format`).

```bash
curl https://api.cotizave.com/v1/fx/rates -H "X-API-Key: $COTIZAVE_API_KEY"
```

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
    "value": 975.1234, "version": "v1", "as_of": "2026-10-15T03:31:30Z",
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
| `type` | `reference`, `parallel`, `p2p`; los markets de pago también pueden ser `remittance`, `cash`, `exchange_house`. Trata valores desconocidos sin romper. |
| `base` | `USD` o `EUR`. Puede faltar en respuestas antiguas: si falta, asume USD salvo en `eur_reference`. |
| `ask` / `bid` | Solo cuando la fuente los da (paralelo, P2P). Omitidos en `reference`. |
| `mid` | Siempre presente. Usa este. |
| `updated_at` | ISO 8601. En `reference`/`eur_reference` es la fecha valor a medianoche de Caracas, **no** la hora en que se leyó. |
| `effective_date` | `YYYY-MM-DD`, solo en `reference`/`eur_reference`. Fecha valor. |
| `stale_after_sec` | Opcional. Umbral de frescura propio del market, en segundos. |

- El orden de `rates[]` no está garantizado: busca por `market`.
- Los markets fuera de tu plan se omiten en silencio (aquí no hay 402).
- Un P2P sin cotización en ese momento puede no aparecer.

## GET /v1/fx/rates/:market

Una sola tasa. Mismo objeto que un elemento de `rates[]`. Sin parámetros de query.

```bash
curl https://api.cotizave.com/v1/fx/rates/reference -H "X-API-Key: $COTIZAVE_API_KEY"
```

```json
{ "market": "reference", "type": "reference", "base": "USD", "mid": 877.9023,
  "updated_at": "2026-10-14T04:00:00Z", "effective_date": "2026-10-14" }
```

Errores: `404 resource_not_found` (market inexistente o ausente del snapshot),
`402 feature_not_in_plan` (market gateado: `details.feature` = `remittance`,
`extended_markets` o `cash_markets`).

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

```bash
# Tasa oficial BCV (default)
curl "https://api.cotizave.com/v1/fx/convert?from=USD&to=VES&amount=100" \
  -H "X-API-Key: $COTIZAVE_API_KEY"
# Precio de mercado
curl "https://api.cotizave.com/v1/fx/convert?from=VES&to=USD&amount=200000&via=binance" \
  -H "X-API-Key: $COTIZAVE_API_KEY"
```

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
- `staleness_sec` = edad en segundos; `stale` = superó el umbral de su fuente.
- `400 invalid_format` con `field: "via"` si el market cotiza en otra moneda
  (p. ej. `eur_reference` con `from=USD`) o si pides VES→USD por `paypal`/`zelle`.
- Si conviertes muchos montos por minuto, trae `/v1/fx/rates` una vez y multiplica tú.

## POST /v1/fx/bulk/convert

Hasta 50 montos con **una** tasa, 1 unidad de cuota. **Solo plan Escala**
(`402 feature_not_in_plan`, `details.feature: "bulk_convert"` en los demás). Límite
adicional de 300 llamadas por hora (excederlo → `429`).

Body (JSON):

| Campo | Req. | Notas |
|---|---|---|
| `from` | sí | `USD` o `VES` |
| `to` | sí | `VES` o `USD`, distinto de `from` |
| `amounts` | sí | `number[]`, de 1 a 50 elementos, cada uno > 0 y ≤ 1e12 |
| `market` | no | default `reference` |

```bash
curl -X POST https://api.cotizave.com/v1/fx/bulk/convert \
  -H "X-API-Key: $COTIZAVE_API_KEY" -H "Content-Type: application/json" \
  -d '{"from":"USD","to":"VES","amounts":[100,250,500],"market":"parallel"}'
```

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
`X-Bulk-Operations: <n>`. Más de 50 montos → `400 invalid_format`, `field: "amounts"`.

> Nota: algunos snippets de la documentación web muestran un body con
> `items: [{from,to,amount}]` y `via`. La tabla de parámetros de esa misma página y
> el servidor usan `amounts` + `market`, que es lo que hay que enviar.

## GET /v1/fx/spread

Brecha entre BCV (`reference`) y otro market. Todos los planes.

| Param | Default | Valores |
|---|---|---|
| `against` | `parallel` | `parallel`, cualquier P2P (`binance`, `bybit`, …) u otro market de tu plan; no `reference` |
| `base` | `USD` | solo `USD` |

```bash
curl "https://api.cotizave.com/v1/fx/spread?against=binance" -H "X-API-Key: $COTIZAVE_API_KEY"
```

```json
{
  "reference": { "market": "reference", "value": 877.9023, "updated_at": "2026-10-14T04:00:00Z" },
  "compared":  { "market": "binance",   "value": 1011.55,  "updated_at": "2026-10-15T03:30:10Z" },
  "spread": { "absolute": 133.6477, "percentage": 15.22, "direction": "higher" },
  "fetched_at": "2026-10-15T03:31:30Z"
}
```

`direction`: `higher` | `lower` | `equal`. Errores: `400 invalid_against`,
`400 invalid_base`, `422 reference_unavailable`, `422 compared_unavailable`.

## GET /v1/fx/index

Cotizave Index: VES por 1 USD ponderado BCV 30 % + paralelo 20 % + mediana P2P 50 %.
Todos los planes. Sin parámetros. También viene embebido en `/v1/fx/rates` (`index`).

```json
{
  "value": 975.1234, "version": "v1", "as_of": "2026-10-15T03:31:30Z",
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

Histórico de un market. Todos los planes; **la profundidad depende del plan**: Gratis
14 días · Inicio 30 · Esencial 90 · Profesional 180 · Escala 365.

`:market`: `reference`, `parallel`, `binance`, `bybit`, `okx`, `bitget`, `mexc`,
`bingx`, `saldo`.

| Param | Modo | Notas |
|---|---|---|
| `date` | punto | `YYYY-MM-DD` (UTC). Devuelve **1 objeto**: el registro más cercano **en o antes** de esa fecha. No puede ser futura. |
| `from`, `to` | colección | `YYYY-MM-DD`, inclusivos. Por defecto: desde lo más antiguo que permite tu plan hasta hoy. |
| `granularity` | colección | `daily` (default, un cierre por día) o `raw` (cada captura, máx. 5.000 puntos → `truncated: true`). |

Sin parámetros → colección con toda tu ventana de retención.

```bash
curl "https://api.cotizave.com/v1/fx/rates/reference/history?date=2026-10-04" \
  -H "X-API-Key: $COTIZAVE_API_KEY"
curl "https://api.cotizave.com/v1/fx/rates/binance/history?from=2026-10-01&to=2026-10-07" \
  -H "X-API-Key: $COTIZAVE_API_KEY"
```

```json
{ "market": "reference", "date": "2026-10-04", "rate": 870.12,
  "updated_at": "2026-10-03T04:00:00Z", "captured_at": "2026-10-03T20:35:12Z" }
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

Errores: `400 invalid_format` (fecha mal formada o futura, `from > to`, granularity
inválida), `403 history_out_of_retention` (más vieja que lo que permite tu plan;
`details.max_days`), `404 resource_not_found` (sin registros en o antes de esa fecha).
Las fechas pasadas no cambian: cachéalas sin expiración.

## GET /v1/fx/route

Mejor mercado ejecutable para un monto USD↔VES + alternativas ordenadas. **Solo plan
Escala.**

| Param | Req. | Default | Notas |
|---|---|---|---|
| `from`, `to` | sí | — | `USD`/`VES` |
| `amount` | sí | — | > 0 |
| `direction` | no | `send` | `send` = maximizar VES recibidos; `receive` = pagar menos VES por USD |
| `max_staleness` | no | `0` | segundos; `0` = sin filtro |

```bash
curl "https://api.cotizave.com/v1/fx/route?from=USD&to=VES&amount=1000&direction=send&max_staleness=1800" \
  -H "X-API-Key: $COTIZAVE_API_KEY"
```

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

`skipped[].reason`: `not_executable` (el BCV no es un mercado), `currency_mismatch`
(`eur_reference`), `no_quote`, `stale`, `feature_not_in_plan`. En CSV responde `406`
(dos colecciones); usa JSON o XML.

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
  lista fija ni normalices nombres (`bank` es literal de la fuente).
- `404 bcv_snapshot_unavailable` si todavía no hay snapshot.

## GET /v1/fx/bcv/currencies

Tasas oficiales BCV de EUR, CNY, TRY y RUB (VES por unidad). USD no viene aquí (está
en `/v1/fx/rates/reference`). Mismo snapshot diario que `/bcv/banks`. Todos los planes.

```json
{
  "reference_value_date": "2026-10-14",
  "reference_value_date_text": "Martes, 14 Octubre 2026",
  "rates": { "EUR": 982.7589, "CNY": 123.21, "TRY": 21.03, "RUB": 10.87 },
  "captured_at": "2026-10-14T12:15:03Z"
}
```

Para contabilidad usa `reference_value_date` (fecha valor), no `captured_at`.

## GET /v1/banks

Catálogo de bancos venezolanos. Todos los planes. Param opcional `q` (filtra por
nombre, sin distinguir mayúsculas). Header de respuesta `X-Data-Source: normadata.io`.

```bash
curl "https://api.cotizave.com/v1/banks?q=banesco" -H "X-API-Key: $COTIZAVE_API_KEY"
```

```json
{ "banks": [ { "code": "0134", "name": "Banesco", "type": "private" } ], "total": 1 }
```

`type`: `public` | `private`.

Si `/v1/banks*` responde `403 endpoint_disabled`, las utilidades de Venezuela están
deshabilitadas temporalmente: no es un problema de tu key ni de tu plan; no
reintentes en bucle.

## GET /v1/banks/:code

Un banco por su código SUDEBAN de 4 dígitos (los primeros 4 de una cuenta de 20).

```json
{ "code": "0134", "name": "Banesco", "type": "private" }
```

Errores: `400 invalid_format` (no son 4 dígitos), `404 bank_not_found`.

---

## Fuera de esta referencia

Existen otras utilidades de Venezuela (validación de RIF y de cuenta bancaria,
feriados y días hábiles) que **no** forman parte de la referencia pública de la API y
pueden no estar habilitadas para tu cuenta (responden `403 endpoint_disabled`). No las
uses sin confirmar antes en https://cotizave.com/docs o con support@cotizave.com.
