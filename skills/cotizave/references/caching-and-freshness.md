# Cache y frescura

## Cómo se produce el dato

Cotizave recalcula su snapshot de tasas **cada ~5 minutos**. Pedirlo más seguido
devuelve el mismo snapshot y gasta cuota. Pero cada fuente publica a su propio ritmo:

| Market | Cuándo cambia de verdad | Umbral de `stale` |
|---|---|---|
| `reference`, `eur_reference` (BCV) | Días hábiles, en la tarde (~16:30 hora de Caracas), con **fecha valor** del siguiente día hábil | 132 h |
| `parallel` | Hasta 3 veces por día hábil (≈ 9 am, 1 pm, 5 pm); fines de semana y feriados ≈ 1 vez (9 am) | 26 h |
| P2P (`binance`, `bybit`, `okx`, `bitget`, `mexc`, `bingx`, `saldo`) | Continuamente; Cotizave los toma cada ~5 min | 30 min |
| `paypal`, `zelle` | Varias veces al día | 6 h |
| `cash`, `cucuta` | Varias veces al día | 3 h |
| `/v1/fx/bcv/banks`, `/v1/fx/bcv/currencies` | 1 vez al día | — (mira `captured_at`) |

Cuando una tasa trae `stale_after_sec`, ese es el umbral que aplica a ese market y
manda sobre esta tabla.

## Leer la frescura correctamente

- **`effective_date`** (solo BCV): `YYYY-MM-DD`, la fecha valor — el día desde el que
  rige la tasa, en el calendario de Caracas. La tasa publicada el viernes rige desde
  el lunes; la del jueves rige viernes, sábado y domingo. En feriados largos
  (Carnaval, Semana Santa) la misma tasa puede regir hasta 5 días: **es correcto, no
  es un dato viejo**.
- **`updated_at`**: en P2P/paralelo es el instante del dato. En BCV es la medianoche de
  Caracas de la fecha valor (`2026-10-14T04:00:00Z` = 14 de octubre 00:00 VET), así
  que restarlo contra "ahora" no mide nada útil.
- **`stale` + `staleness_sec`** (en `/v1/fx/convert`): la API ya comparó la edad contra
  el umbral de la fuente. Usa `stale` en vez de inventar tu propio umbral.
- **`flags.bcv_stale`** (en el Index): el BCV lleva > 132 h sin renovarse; su peso se
  redistribuye.
- **Diferencia con bcv.org.ve**: la web del BCV muestra la tasa *próxima* desde que la
  publica; la API sirve la *vigente*. Durante parte de la semana los números
  difieren. Explícalo al usuario con `effective_date` ("Tasa BCV vigente desde el
  14/10").

Para facturación: guarda `rate` **y** `effective_date` con el documento. Para
reconstruir una tasa pasada usa `/v1/fx/rates/reference/history?date=YYYY-MM-DD`
(devuelve la vigente en o antes de esa fecha).

## TTL recomendados

| Uso | Qué cachear | TTL |
|---|---|---|
| Mostrar tasas en una web/app | respuesta de `/v1/fx/rates` | 5 min (Esencial+) · 30–60 min (Gratis/Inicio) |
| Solo BCV (facturación, precios oficiales) | `/v1/fx/rates/reference` | 30–60 min |
| Precio en Bs de un catálogo | `/v1/fx/rates` una vez → multiplicar localmente | igual que arriba |
| Bot / widget "¿a cómo está el dólar?" | `/v1/fx/rates` | 5–15 min |
| Tasas por banco / divisas BCV | `/v1/fx/bcv/*` | 1–6 h |
| Histórico de días pasados | `/history?date=` | sin expiración |

Ajusta el TTL a tu cuota: 1.500 requests/mes (Gratis) ≈ una llamada cada 30 min para
un solo endpoint.

## Patrones

- **Cache compartido** (un key-value store, tu base de datos, el KV de tu proveedor o
  el data cache de tu framework) cuando hay varias instancias o funciones serverless:
  un cache en memoria por proceso multiplica las llamadas.
- **Single-flight**: si el cache venció y llegan 50 requests a la vez, que solo uno
  llame a Cotizave y los demás esperen ese resultado.
- **Stale-if-error**: guarda el último valor bueno sin expiración dura; si Cotizave
  responde `5xx`, `429 monthly` o la red falla, sírvelo marcado con su
  `updated_at`/`effective_date`.
- **Frontend**: el navegador llama a TU backend (que tiene la key y el cache), nunca a
  `api.cotizave.com` con la key.
- **Cron en vez de request-driven** cuando la cuota es justa: un job refresca el cache
  cada N minutos y las páginas solo leen el cache.
- No hagas polling de `/v1/fx/convert` para mostrar "tasas": trae `/v1/fx/rates`.
