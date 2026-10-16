# Fixtures del contrato

Ejemplos del contrato de Cotizave, para probar una
integración en **cualquier** lenguaje sin llamar a la API real. Cada archivo es:

```json
{ "status": 200, "headers": { "...": "..." }, "body": { } }
```

`raw` reemplaza a `body` cuando la respuesta no es JSON válido. Sírvelas desde un
servidor HTTP falso (o el mock de tu framework) y apunta el cliente a él con una key de
prueba como `ctz_live_test`.

| Fixture | Qué debe hacer el cliente |
|---|---|
| `rates.200.json` | Parsear; buscar por `market`; `eur_reference` tiene base EUR |
| `rate-reference.200.json` | Parsear una tasa; `ask`/`bid` ausentes no son `0` |
| `rate-eur-reference-no-base.200.json` | Sin `base`: el helper de moneda base devuelve `EUR` |
| `convert.200.json` | Leer `to.amount`, `effective_date` y `stale` |
| `bulk-convert.200.json` | `results[i]` corresponde a `amounts[i]` |
| `history-point.200.json`, `history-collection.200.json` | Modo punto (objeto) y colección (`points[]`) |
| `malformed.200.json` | Un `2xx` con JSON roto es un error, no "sin datos" |
| `redirect-302.json` | No seguir la redirección; la key no llega a otro host |
| `error-400-unknown-parameter.json` | Error tipado con `code` y `field`; sin reintento |
| `error-401-invalid-api-key.json` | Sin reintento; la key no aparece en el error |
| `error-402-feature-not-in-plan.json` | Sin reintento; exponer `details.feature` |
| `error-429-burst.json` | Reintentar tras `X-RateLimit-Retry-After-Ms` (40 ms), acotado |
| `error-429-burst-scope-in-body.json` | Sin header de scope: tomarlo de `details.kind` y reintentar |
| `error-429-monthly.json` | **No** reintentar; exponer `X-RateLimit-Reset` |
| `error-429-no-scope.json` | No reintentar; exponer `Retry-After` (3600) |
| `error-500-internal.json` | Reintento acotado con backoff + jitter |
| `error-503-service-unavailable.json` | Reintentar tras `Retry-After` (1 s), acotado |
| `error-503-retry-after-long.json` | `Retry-After` (120 s) mayor que la espera máxima: fallar sin dormir |

Los números son ilustrativos. Casos que no necesitan fixture: una key con salto de
línea final se limpia; una con caracteres inválidos no se envía; un error de red en el
`POST` de bulk no se reintenta.

La verificación contra el backend fue declarada por la revisión anterior, pero no
se adjuntaron capturas ni un identificador del contrato. No constituyen una prueba
de conformidad del servicio actual. Están versionadas junto a la skill; los números
son ilustrativos y todos los tests deben ejecutarse contra transporte local.

La [revisión documental del contrato](../../references/contract-evidence.md)
identifica fuentes, alcance comprobado y discrepancias.


## Secuencias para probar fallback y recuperación

Usa reloj controlado y transporte local. La política de fallback pertenece a la
aplicación: estas secuencias no añaden campos ni endpoints a Cotizave.

| Secuencia | Resultado esperado |
|---|---|
| `rates.200.json` → `error-503-service-unavailable.json`, con respaldo dentro de tolerancia para mostrar | Reintentos dentro del presupuesto y luego último dato bueno identificado, conservando market, moneda y fechas |
| La misma secuencia, avanzando el reloj más allá de la tolerancia | Indisponibilidad; no devolver cero ni presentar el respaldo como actual |
| `error-503-service-unavailable.json` con cache vacío | Error recuperable y ninguna tasa inventada |
| `rates.200.json` → `malformed.200.json` | Error de protocolo; no sobrescribir el último dato bueno con contenido inválido |
| `rates.200.json` → `error-429-monthly.json` → otra consulta antes del reset | No enviar otra petición upstream; usar respaldo solo si la política lo permite |
| Fallo → `rates.200.json`, cuando esté permitido consultar de nuevo | Validar respuesta, actualizar cache y salir del estado degradado si el dato cumple vigencia |
| Respuestas 200 sucesivas con el mismo `updated_at` antiguo | No renovar la tolerancia del dato por haberlo descargado otra vez |
| Respaldo sin vigencia acreditada al fijar un importe | No emitir la factura; preservar documentos previamente emitidos |

Fija el reloj respecto a las fechas de la fixture, no a la fecha real del test.
Prueba también la frontera exacta del límite acordado y una cancelación: no debe
iniciar nuevas consultas ni convertir la operación cancelada en un éxito con cache.
Estas son pruebas a implementar y ejecutar en el cliente consumidor, no resultados
ya comprobados por este paquete.
