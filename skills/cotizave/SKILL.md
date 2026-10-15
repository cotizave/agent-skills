---
name: cotizave
description: >-
  Integra la API de Cotizave (api.cotizave.com) para tasas de cambio de Venezuela:
  tasa BCV oficial (dólar oficial y euro BCV), dólar paralelo, Binance P2P y otros
  exchanges P2P (Bybit, OKX, Bitget, MEXC, BingX, Saldo), PayPal, Zelle, efectivo,
  convertir dólares a bolívares (USD/EUR a VES y viceversa), precio en Bs, histórico
  de tasas, brecha BCV vs paralelo, Cotizave Index, tasas BCV por banco y catálogo de
  bancos venezolanos (código SUDEBAN). Úsala cuando se mencione tasa BCV, dólar
  oficial, dólar paralelo, dólar hoy, bolívares, Bs, VES, Binance P2P, convertir a
  bolívares, facturar en bolívares, bancos Venezuela, Cotizave, ctz_live_ o
  COTIZAVE_API_KEY. English keywords: Venezuela exchange rate, VES, BCV rate,
  Venezuelan bolivar, USD to VES, parallel dollar.
metadata:
  author: cotizave
  version: "0.1.0"
---

# API de Cotizave — guía de integración para agentes

Cotizave es una API REST de tasas de cambio del bolívar venezolano (VES). Esta guía
te dice cómo integrarla **correctamente**: qué endpoint usar, qué parámetros existen
de verdad, cómo leer la frescura del dato y cómo manejar errores y límites.

- Base URL: `https://api.cotizave.com` — todas las rutas empiezan con `/v1/`.
- Docs oficiales: https://cotizave.com/docs
- Referencia completa de endpoints: [references/endpoints.md](references/endpoints.md)
- Errores, cuotas y 429: [references/errors-and-limits.md](references/errors-and-limits.md)
- Cache y frescura por mercado: [references/caching-and-freshness.md](references/caching-and-freshness.md)
- Clientes de ejemplo: [TypeScript](references/examples/typescript.md) ·
  [Python](references/examples/python.md) · [PHP](references/examples/php.md) ·
  [Go](references/examples/go.md)
- Verificar una key: [scripts/check-key.sh](scripts/check-key.sh)

## Principios (no negociables)

1. **No inventes.** Usa solo los endpoints, parámetros, campos y códigos de esta guía
   y sus referencias. La API **rechaza parámetros de query desconocidos con `400
   unknown_parameter`**: un parámetro inventado no se ignora, rompe la llamada.
2. **La key vive en el backend.** Léela de la variable de entorno `COTIZAVE_API_KEY`.
   Nunca la hardcodees, nunca la pongas en código de navegador o app móvil, en la URL
   ni en logs. Si la app es frontend puro, crea un endpoint propio en tu backend que
   llame a Cotizave y cachee la respuesta.
3. **Cachea.** El snapshot de tasas se recalcula cada ~5 minutos y la cuota es
   mensual. Llamar más seguido solo gasta cuota.
4. **Lee la frescura que trae la respuesta** (`updated_at`, `effective_date`,
   `stale`) en vez de suponerla.
5. **Los errores siempre son JSON**: `{ "code", "message", "field"?, "details"? }`.
   Ramifica por `code`, nunca por `message`.

## Autenticación

Header `X-API-Key` con una key `ctz_live_...` (47 caracteres). Se crea en
https://app.cotizave.com (sección API Keys) y se muestra una sola vez.

```bash
export COTIZAVE_API_KEY="ctz_live_..."   # en .env / gestor de secretos, nunca en el repo
curl https://api.cotizave.com/v1/fx/rates -H "X-API-Key: $COTIZAVE_API_KEY"
```

- Agrega `.env` al `.gitignore`. En ejemplos y tests usa placeholders (`ctz_live_...`).
- `401 invalid_api_key` = falta, mal copiada o inexistente; `401 key_revoked` = revocada;
  `403 account_inactive` = cuenta suspendida. Ninguno se arregla reintentando.

## ¿Qué endpoint uso?

| Necesito… | Endpoint | Plan |
|---|---|---|
| Todas las tasas (BCV, paralelo, P2P) + Cotizave Index en 1 llamada | `GET /v1/fx/rates` | Todos |
| Una sola tasa (p. ej. solo BCV) | `GET /v1/fx/rates/:market` | Todos (algunos markets gateados) |
| Convertir un monto USD/EUR ↔ VES | `GET /v1/fx/convert?from=&to=&amount=&via=` | Todos |
| Mostrar "precio en Bs" de muchos productos | `GET /v1/fx/rates` una vez + multiplicar en tu código | Todos |
| Convertir hasta 50 montos en 1 llamada | `POST /v1/fx/bulk/convert` | Escala |
| Brecha BCV vs paralelo o un P2P | `GET /v1/fx/spread?against=` | Todos |
| Una cifra ponderada (BCV 30 % + paralelo 20 % + mediana P2P 50 %) | `GET /v1/fx/index` | Todos |
| Tasa vigente en una fecha pasada / serie histórica | `GET /v1/fx/rates/:market/history` | Todos (profundidad según plan) |
| Mejor mercado para cambiar un monto | `GET /v1/fx/route` | Escala |
| Compra/venta USD por banco (tabla del BCV) | `GET /v1/fx/bcv/banks` | Todos |
| EUR, CNY, TRY, RUB oficiales del BCV | `GET /v1/fx/bcv/currencies` | Todos |
| Catálogo de bancos venezolanos (código SUDEBAN) | `GET /v1/banks`, `GET /v1/banks/:code` | Todos |

Planes (nombre comercial → id que devuelve la API en `details.current_plan`):
Gratis `free` · Inicio `lite` · Esencial `hobby` · Profesional `indie` · Escala `pro`.

### Markets

| `market` | Qué es | Plan |
|---|---|---|
| `reference` | BCV oficial USD/VES (**no es ejecutable**: nadie cambia a esa tasa) | Todos |
| `eur_reference` | BCV oficial **EUR/VES** (base EUR, no USD) | Todos |
| `parallel` | Dólar paralelo (mercado libre) | Todos |
| `binance`, `bybit`, `okx`, `bitget`, `mexc`, `bingx`, `saldo` | P2P USDT/VES (sin sufijo `_p2p`) | Todos |
| `paypal`, `zelle` | Canales de remesa, **solo USD → VES** | Esencial+ |
| `syklo`, `yadio`, `zoom`, `western_union` | Mercados extendidos | Profesional+ |
| `cash`, `cucuta` | Dólar en efectivo | Escala |

Un market que tu plan no incluye **no aparece** en `/v1/fx/rates` y, pedido por
nombre (`/rates/:market`, `via=`, `against=`), responde `402 feature_not_in_plan`.
Un P2P puede faltar si el exchange no está cotizando: busca por `market`, nunca por
posición en el array (el orden no está garantizado).

## Trampas frecuentes (léelas antes de escribir código)

- **`/v1/fx/convert` sin `via` usa la tasa OFICIAL del BCV** (`reference` para USD,
  `eur_reference` para EUR), no una de mercado. Para precio "de calle" pasa
  `via=parallel` o `via=binance` explícito.
- **Un lado de la conversión debe ser `VES`.** Soportado: USD↔VES y EUR↔VES.
  `USD→EUR` da `400 invalid_format`.
- **El parámetro es `via`.** `market` se acepta como alias en `/convert` (si vienen
  los dos, gana `via`). Cualquier otro nombre → `400 unknown_parameter`.
- **`eur_reference` cotiza en EUR.** Si iteras `rates[]` para hacer cuentas en
  dólares, filtra por `base === "USD"` (o excluye `eur_reference`). Usar
  `via=eur_reference` con `from=USD` da `400` (field `via`).
- **`paypal`/`zelle` solo sirven USD → VES**: pedirlos para VES → USD da `400`.
- **`effective_date` ≠ `updated_at`.** En `reference`/`eur_reference`, `effective_date`
  (`YYYY-MM-DD`, calendario de Caracas) es la **fecha valor**: el día desde el que
  rige la tasa. El BCV publica en días hábiles con vigencia para el siguiente día
  hábil, así que la tasa del viernes rige también sábado y domingo. **No restes
  `updated_at` contra "ahora" para decidir que el BCV está viejo.** Si facturas,
  guarda `effective_date` junto al monto. La web del BCV puede mostrar la *próxima*
  tasa; la API sirve la *vigente* hoy.
- **`stale` / `staleness_sec`** (en `/convert`): `stale: true` significa que el dato
  superó el umbral de **su propia fuente** (BCV 132 h, paralelo 26 h, P2P 30 min). Un
  BCV de 2 días un domingo NO es stale. Ver
  [caching-and-freshness.md](references/caching-and-freshness.md).
- **Un 402 no se reintenta.** `feature_not_in_plan` es un límite comercial;
  `details.feature` dice qué falta. No consume cuota.
- **Formatos CSV/XML** (`?format=csv|xml` o header `Accept`; gana el query) solo desde
  Esencial; en Gratis/Inicio → `402`. **Los errores siempre llegan en JSON**: revisa
  el status antes de parsear CSV. `/v1/fx/route` en CSV → `406 format_not_available`.
- **`/v1/fx/bulk/convert`** recibe `{"from","to","amounts":[...],"market"?}` (máx. 50
  montos, mismo market para todos). Ver la nota en
  [endpoints.md](references/endpoints.md#post-v1fxbulkconvert).
- **Redondea al mostrar** (2 decimales para Bs) y no compares montos con `===`.

## Rate limits y 429

Dos límites independientes. Cada respuesta trae `X-RateLimit-Limit`,
`X-RateLimit-Remaining` y `X-RateLimit-Reset` (cuota mensual). Un `429
rate_limit_exceeded` trae además `X-RateLimit-Scope`:

| `X-RateLimit-Scope` | Significa | Qué hacer |
|---|---|---|
| `burst` | Demasiado rápido (rps). La cuota mensual sigue intacta | Esperar `X-RateLimit-Retry-After-Ms` (preciso) o `Retry-After` (segundos, mínimo 1) + jitter, y reintentar |
| `monthly` | Cuota del ciclo agotada | **NO reintentar en bucle.** `Retry-After` puede ser de días o semanas (hasta `X-RateLimit-Reset`). Sirve el último valor cacheado, avisa a una persona y sugiere upgrade |

Cuotas por plan: Gratis 1.500/mes (2 rps, burst 5) · Inicio 3.500 (3/6) · Esencial
20.000 (3/8) · Profesional 60.000 (5/15) · Escala 150.000 (10/25). El ciclo se
reinicia el día de activación del plan, no el día 1. Cuentan `2xx`, `400` y `404`;
no cuentan `401/402/403/429/5xx`.

Haz las cuentas antes de elegir un intervalo de polling: 1.500/mes ≈ 50/día ≈ una
llamada cada ~30 min. Polling cada 5 min ≈ 8.640/mes. Detalle en
[errors-and-limits.md](references/errors-and-limits.md).

## Cache recomendado

| Dato | Cadencia real | TTL sugerido en tu cache |
|---|---|---|
| Snapshot (`/rates`, `/convert`, `/index`, `/spread`) | se recalcula cada ~5 min | ≥ 5 min (más si tu cuota es chica) |
| BCV `reference` / `eur_reference` | días hábiles, ~16:30 hora de Caracas, rige desde el siguiente día hábil | 30–60 min (lo que cambia es qué tasa *rige*, a medianoche de Caracas) |
| `parallel` | hasta 3 veces por día hábil (≈ 9 am/1 pm/5 pm), 1 vez los fines de semana | 30–60 min |
| P2P | ~5 min | 5 min |
| `/bcv/banks`, `/bcv/currencies` | 1 vez al día | horas |
| Histórico de fechas pasadas | inmutable | sin expiración |

- **Una llamada a `/v1/fx/rates` + cálculo local** es mejor que N llamadas a
  `/convert` cuando conviertes muchos montos.
- Ante `5xx` o red caída, reintenta con backoff exponencial + jitter y sirve el último
  valor bueno mostrando su `updated_at`.
- Con varias réplicas o funciones serverless, usa un cache compartido (no uno por
  proceso) para no multiplicar las llamadas.

## Formato de errores

```json
{ "code": "invalid_format", "message": "Amount must be a positive number up to 1e12.", "field": "amount" }
```

`message` es para desarrolladores (viene en inglés): no lo muestres tal cual al
usuario final. Códigos y la respuesta correcta a cada uno en
[errors-and-limits.md](references/errors-and-limits.md).

## Checklist antes de entregar una integración

- [ ] La key se lee de `COTIZAVE_API_KEY` y solo se usa del lado servidor.
- [ ] Los markets se buscan por `market`, no por índice; se tolera que falte uno.
- [ ] `via` explícito si el caso de uso NO es la tasa oficial del BCV.
- [ ] Para facturación se guarda `effective_date` (y la tasa) con cada documento.
- [ ] Hay cache compartido con TTL acorde a la cadencia y a la cuota del plan.
- [ ] 429 `burst` → espera y reintenta; 429 `monthly` → no reintenta, avisa.
- [ ] 402 → mensaje de upgrade, sin reintento. 5xx → backoff + último valor bueno.
- [ ] Se redondea al mostrar; no hay parámetros inventados.
