# Evaluación independiente de consumo de Cotizave

Implementación experimental de política de cliente Node, no cliente oficial. Se usaron SKILL.md, endpoints.md (rates), caching-and-freshness.md, errors-and-limits.md, integration-patterns.md y assets/fixtures/README.md. No se consultaron evals ni respuestas esperadas de evaluación. No hubo llamadas de red, acceso a credenciales ni cambios en el repositorio.

## Decisiones

- GET /v1/fx/rates único para varios mercados, cache de snapshot validado y TTL de refresco predeterminado 1800 segundos. El fallback conserva market, base, VES, fuente, fecha valor y metadatos temporales. Estado y error son campos locales de aplicación.
- Paralelo nunca reemplaza BCV. Si solo está paralelo, mostrar paralelo es válido para una solicitud explícita; solicitar BCV devuelve indisponibilidad, incluida facturación.
- El cache conserva el último snapshot bueno ante 503 o JSON inválido. Recuperación validada lo reemplaza y retira el estado degradado según vigencia. Un snapshot nuevo válido puede omitir un market: se informa su ausencia, no se conserva silenciosamente un market que pudo salir del plan.
- Tolerancia de respaldo configurable por market, expresada aquí como tiempo desde la última validación exitosa. No se inventa una tolerancia de producción: sin configuración se rechaza el respaldo. TTL no equivale a frescura. Para mercados no BCV también se comprueba updated_at y stale_after_sec o umbral conocido. Para BCV se inyecta attestBCV, que debe acreditar vigencia según calendario de Caracas y política real; su valor predeterminado es falso, sin deducir caducidad de updated_at.
- Para fijar factura se exige market reference y acreditación vigente; se devuelve una cotización con mid/effective_date, nunca se recalculan documentos anteriores. El consumidor existente conserva la responsabilidad de precisión decimal, cálculo, redondeo y persistencia atómica. Esta evaluación no implementa un motor de facturación ni demuestra precisión monetaria al persistir.
- Bloqueo mensual por cuenta en cache hasta reset; reset inválido suspende indefinidamente para revisión. Scope ausente respeta Retry-After y no reintenta; burst y 5xx tienen hasta tres intentos con espera acotada y plazo total. Señal de cuota vía observe, sin cuerpos de error ni secretos. 400/401/402/403 no quedan ocultos por fallback.
- Cancelación en cache hit, transporte y backoff se propaga. Consumidores concurrentes comparten refresco; cancelar uno no cancela otro. Al salir el último consumidor se aborta el refresco y se libera coordinación. Plazos dependen del reloj/scheduler inyectado.

## Ejecución

Runtime: Node v26.4.0.
Comando: node --test /private/tmp/cotizave-fallback-eval-20261015/client.test.mjs
Resultado: 14 tests aprobados, 0 fallos, 0 cancelados, 0 omitidos. Salida conservada en test-results.txt.

## Límites comprobables

Solo se evaluó una instancia del cliente con transporte local inyectado, no HTTP real. El transporte existente debe gestionar X-API-Key, configuración segura, TLS, no redirects, límite de bytes, parseo numérico preciso cuando corresponda y cierre de recursos; no se acreditaron esas propiedades aquí. El cliente pasa redirect:error, pero el mock no demuestra su implementación. No se usan ni solicitan credenciales.

El reloj de prueba está fijado relativo a fixtures. La acreditación de BCV en tests es una regla artificial de edad de validación de 1000 ms, diseñada para comprobar admisión/rechazo, no una regla real de fecha valor. La vigencia de feriados/fines de semana requiere la política del backend. No se acreditó que los valores ilustrativos sigan vigentes contra el servicio real.

Tolerancia de display medida desde validación no limita por sí sola la edad absoluta del dato upstream; para un producto que admita respaldo se debe acordar también esa tolerancia de origen cuando sea necesaria. Esta política se documenta explícitamente y no representa aprobación de datos ilimitadamente antiguos para facturar.

La coordinación single-flight es local a una factory; aunque se inyecte cache compartido entre factories, no coordina múltiples procesos. A 1800 s un endpoint consume alrededor de 1440 solicitudes/30 días por refrescador más fallos y otros endpoints, por lo que debe evaluarse el presupuesto agregado real y reserva de cuota. No se comprobó multi-proceso, monotonicidad ante ajustes del reloj, SSRF, uso real de logs o un servicio de alertas.

La validación de fecha comprueba forma y parseabilidad, no reconstrucción exhaustiva de fechas calendáricas inválidas normalizadas por JS. La salida usa Number para cotizaciones, no promueve Number para fijar importes. No hay persistencia de facturas ni prueba de migraciones.
