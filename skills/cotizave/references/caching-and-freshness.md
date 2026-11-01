# Cache y frescura

> The route-specific examples below describe V1 Venezuela. For new V2 integrations, use [V2 routes](api-v2.md) and adapt country, rate ID, permissions and source freshness. Do not carry V1 plan TTLs or market defaults into another country.

## Cada cuánto cambia el dato

Las tasas que devuelve la API cambian, como mucho, cada pocos minutos: pedirlas más
seguido devuelve lo mismo y gasta cuota. Para saber si cambió, compara `fetched_at`
(o el `updated_at` de cada tasa) con lo que ya tienes. Además, cada mercado tiene su
propio ritmo:

| Market | Cuándo cambia de verdad | Umbral de `stale` |
|---|---|---|
| `reference`, `eur_reference` (BCV) | Días hábiles, con **fecha valor** del siguiente día hábil | 132 h |
| `parallel` | Varias veces por día hábil; menos en fines de semana y feriados | 26 h |
| P2P (`binance`, `bybit`, `okx`, …) | Continuamente; en la API, como mucho cada pocos minutos | 30 min |
| Remesas (`paypal`, `zelle`) | Varía por market | 6 h |
| `western_union` | Días hábiles | 26 h (umbral específico del market) |
| Efectivo (`cash`, `cucuta`) | Varía por market | 3 h |
| Casas de cambio (`type: "exchange_house"`) | Días hábiles | 26 h |
| Cualquier otro | — | usa `stale` de `/convert` (o `stale_after_sec` si viene) |
| `/v1/fx/bcv/banks`, `/v1/fx/bcv/currencies` | 1 vez al día | — (mira `captured_at`) |

Cuando una tasa trae `stale_after_sec`, ese es el umbral que aplica a ese market y
manda sobre esta tabla.
Marcar una tasa como `stale` y retirarla del snapshot son decisiones distintas:
no supongas que desaparece al cruzar ese umbral. Comprueba la frescura al consumirla.

## Leer la frescura correctamente

- **`effective_date`** (solo BCV): `YYYY-MM-DD`, la fecha valor — el día desde el que
  rige la tasa, en el calendario de Caracas. La tasa publicada el viernes rige desde
  el lunes; la del jueves rige viernes, sábado y domingo. En feriados largos la
  misma tasa puede regir varios días: **es correcto, no es un dato viejo**.
- **`updated_at`**: es el instante informado para el dato. No exijas una hora
  fija para validar BCV. Para determinar
  desde qué día rige BCV usa `effective_date`; la edad de descarga o actualización
  por sí sola no acredita la vigencia de una factura.
- **`stale` + `staleness_sec`** (en `/v1/fx/convert`): la API ya comparó la edad contra
  el umbral de ese market al responder. No conserves `stale: false` indefinidamente
  al cachear: evalúa vigencia al usar el dato con ese umbral y el tiempo transcurrido,
  respetando la semántica de fecha valor del BCV. TTL y vigencia son decisiones distintas.
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

El TTL correcto depende de la cuota de tu plan, no solo de la cadencia del dato. Con
un cache compartido y **un** endpoint, un TTL de *N* segundos gasta unos
2.592.000 / *N* requests al mes (30 días): 300 s ≈ 8.640, 1800 s ≈ 1.440,
3600 s ≈ 720. Compáralo con la cuota de tu plan en
[errors-and-limits.md](errors-and-limits.md#planes-y-cuotas) y multiplica por cada
endpoint distinto que consultes.

| Plan | TTL para `/v1/fx/rates` (1 endpoint) |
|---|---|
| Free, Basic | 1800–3600 s |
| Growth o superior | desde 300 s |
| No lo sabes | **1800 s** (default seguro) |

| Uso | Qué cachear | TTL |
|---|---|---|
| Mostrar tasas en una web, app o bot | respuesta de `/v1/fx/rates` | el de tu plan (tabla de arriba) |
| Solo BCV (facturación, precios oficiales) | `/v1/fx/rates/reference` | 1800–3600 s (lo que cambia es qué tasa *rige*) |
| Precio en Bs de un catálogo | `/v1/fx/rates` una vez → multiplicar localmente | el de tu plan |
| Tasas por banco / divisas BCV | `/v1/fx/bcv/*` | 1–6 h (1 publicación diaria) |
| Histórico de fechas con **más de 3 días** de antigüedad | `/history?date=` o rangos que terminen antes | largo plazo (días o sin expiración) |
| Histórico que incluye **los últimos 3 días** | `/history` con fechas recientes o sin `to` | ≤ 1 h: los datos de los últimos días pueden ajustarse |

## Patrones

- **Coordinación según necesidad**: con varias instancias calcula el consumo agregado.
  Usa un refrescador único o cache compartido si la cuota o la coherencia lo requieren;
  memoria por proceso puede bastar con poco tráfico y presupuesto suficiente.
  Aísla claves y bloqueos por cuenta, origen y parámetros de la consulta.
- **Single-flight** cuando haya concurrencia sobre la misma clave: coordina un refresco,
  acota la espera y libera la coordinación ante fallo o cancelación. Un lock local no
  coordina varias réplicas.
- **Stale-if-error**: aplica la [política de fallback](#política-de-fallback);
  retener un dato no autoriza a usarlo indefinidamente.
- **Frontend**: el navegador llama a TU backend (que tiene la key y el cache), nunca a
  `api.cotizave.com` con la key.
- **Cron en vez de request-driven** cuando la cuota es justa: un job refresca el cache
  cada N minutos y las páginas solo leen el cache.
- No hagas polling de `/v1/fx/convert` para mostrar "tasas": trae `/v1/fx/rates`.


## Política de fallback

Para usos recurrentes u operativos, recomienda al usuario acordar qué ocurre ante
una caída, timeout o cuota agotada. Revisa primero la política del proyecto. Si falta,
propón la opción más simple compatible con el uso y comunica qué decisión queda
pendiente; no bloquees una corrección ajena para diseñar un sistema nuevo.

| Situación | Respuesta de la integración |
|---|---|
| Mostrar una tasa y hay último dato válido dentro de la tolerancia acordada | Servirlo como dato de respaldo, con fuente, market, fecha y estado de actualización visible |
| Cache vacío, dato inválido o fuera de tolerancia | Mostrar indisponibilidad; nunca sustituir por cero, un número inventado o un valor indefinidamente antiguo |
| Fijar un importe | Exigir vigencia acreditada según el negocio; si no puede acreditarse, detener esa operación con un error recuperable |
| Cuota mensual agotada | Aplicar la misma política de datos sin seguir llamando antes del reset; un fallback no elimina el bloqueo de cuota |
| Credenciales, permisos o configuración incorrectos | Comunicar el problema operativo; no ocultarlo detrás de un respaldo que aparenta funcionamiento normal |

La tolerancia depende del market y del uso; no impongas un máximo único. Guarda
el dato con su procedencia y metadatos temporales y reevalúalo al consumirlo. TTL de
refresco, retención y vigencia son conceptos distintos. Los campos que tu aplicación
use para indicar respaldo son propios: no los atribuyas al contrato de Cotizave.

Una consulta exitosa no rejuvenece la cotización: para P2P/paralelo calcula la
antigüedad del respaldo desde el instante del dato (`updated_at`), no desde su
descarga o inserción en cache. Recibir repetidamente el mismo dato antiguo no
renueva su tolerancia. En BCV usa una política explícita basada en fecha valor y
calendario; si falta, no deduzcas admisibilidad de haber recibido un 200 reciente.

El respaldo conserva el mismo market, moneda, dirección y significado de la
cotización solicitada. No sustituyas silenciosamente BCV por paralelo ni uses una
tasa de otro market porque siga disponible. Si no hay un dato compatible y admisible,
informa indisponibilidad.

**Recuperación:** cuando sea lícito volver a consultar, valida la nueva respuesta
antes de reemplazar el último dato bueno. Un error o un cuerpo inválido no borran
ese respaldo. Retira el estado degradado al recuperar datos válidos para ese uso,
sin recalcular facturas ya emitidas. No conviertas una cancelación del consumidor
en éxito usando cache ni prolongues su plazo con nuevas consultas.

Una recomendación breve al entregar la integración puede ser: «Si Cotizave no está
disponible, podemos mostrar la última tasa con su fecha dentro del límite acordado;
si no hay una tasa admisible, mostraremos indisponibilidad. Para fijar importes,
exigiremos vigencia».
