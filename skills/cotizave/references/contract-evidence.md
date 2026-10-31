# Evidencia del contrato

Registro histórico de API `/v1` para la skill `0.2.0`; no describe la cobertura ni
los permisos actuales de V2. Para una integración nueva consulta [el contrato V2](api-v2.md)
y [la cobertura publicada](https://docs.cotizave.com/api/v2/coverage.md).

La revisión pública del 2026-10-15 está identificada en
el [registro de fuentes](../assets/contract-review.json). La revisión del backend
local del 2026-10-16 conserva revisión de código, hashes de entradas y resultados en
el [registro de verificación](../assets/backend-contract-review.json).

## Contraste resuelto con el código del proveedor

| Tema | Resultado |
|---|---|
| Frescura | BCV 132 h; paralelo 26 h; P2P 30 min; remesas 6 h; efectivo 3 h; casas de cambio 26 h. Un umbral específico del market prevalece; Western Union usa 26 h |
| Ausencia de una fuente | Se puede conservar el último dato con su fecha original; no hay una exclusión general a los diez minutos. Marcar `stale` y retirar un market son decisiones distintas |
| Fecha BCV | La fecha valor es `effective_date`. Una ruta de obtención deriva esa fecha de medianoche de Caracas, pero el consumidor no debe exigir una hora fija para validar `updated_at` |
| Cuota | El cómputo excluye 401, 402, 403, 429 y 5xx; los demás estados pasan por la regla de cómputo |
| Bulk | Límite adicional de 300 llamadas por hora; su 429 no usa scope mensual/burst |

Pasaron 43 tests y subtests de frescura, conservación de timestamps, fecha valor y
contabilización, en tres paquetes del backend, usando dobles y servicios locales.
El tope bulk y el cómputo específico de 406/422 se confirmaron por inspección de
código, no mediante nuevas pruebas de esos casos. No se modificó el backend.

## Documentación pública

Se consultaron [tasas](https://cotizave.com/docs/api/endpoints/get-rates),
[tasa individual](https://cotizave.com/docs/api/endpoints/get-rate-by-market),
[cuotas](https://cotizave.com/docs/api/rate-limits),
[planes](https://cotizave.com/precios) y
[facturación](https://cotizave.com/docs/guides/electronic-invoicing-bcv).

Se corrigió localmente la fuente de la web para retirar la exclusión universal a
los diez minutos, alinear los ejemplos BCV con fecha valor y exigir vigencia al
facturar con respaldo. Esos cambios necesitan su publicación independiente: esta
revisión no acredita que la web desplegada ya los incluya.

## Límites de la evidencia

Se verificó el código local identificado, no el despliegue de producción. Los
hashes de las páginas identifican lo consultado, no son snapshots completos. Los
tests no consumieron cuota ni usaron credenciales de Cotizave. Las fixtures siguen
siendo sintéticas; sus importes y fechas no representan valores actuales ni son
capturas del backend. Otros detalles de endpoints quedan fuera de esta revisión.
