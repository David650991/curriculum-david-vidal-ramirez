# Estadísticas públicas del currículum

Esta guía describe la arquitectura estadística del portafolio de David Vidal Ramírez, sus límites de privacidad y la forma segura de probar una base nueva. No autoriza la activación de producción.

## Arquitectura

```text
GitHub Pages
  └─ visitor-dashboard.js
       ├─ GET /stats-d1
       └─ GET /history-d1
              │
              ▼
        Cloudflare Worker
              │
              ▼
         Cloudflare D1
```

El panel público es de lectura. `visitor-analytics.js` identifica acciones y `visitor-session.js` estima actividad. `visitor-transport.js` mantiene localhost para pruebas y reconoce el origen oficial de GitHub Pages. La configuración autorizada utiliza `PUBLIC_RECORDING_ENABLED = true` y `ANALYTICAS_ESCRITURA = "habilitada"`.

Cada pestaña nueva muestra una pantalla previa antes de habilitar interacciones con el currículum. Aceptar guarda una autorización temporal y solo la recarga posterior puede iniciar la sesión estadística; continuar sin medición no genera identificadores ni eventos. DNT y Global Privacy Control son señales diferentes: DNT es una preferencia heredada y GPC una señal vigente relacionada con venta o compartición de datos. GPC mantiene la medición deshabilitada sin excepción y DNT se respeta hasta la autorización explícita.

## Compatibilidad del transporte

La ruta principal utiliza `fetch` con `keepalive` y `application/json` porque necesita distinguir una aceptación real del Worker de un error HTTP. Si la solicitud falla por un error de red y `navigator.sendBeacon` está disponible, se intenta encolar exactamente el mismo JSON como `text/plain`, un tipo simple que no exige preflight CORS. El Worker admite ambos tipos, pero aplica las mismas validaciones de origen, tamaño, estructura, UUID, sesión y acción. El UUID de sesión y el `event_id` no cambian, por lo que los inicios, la actividad acumulada y los clics continúan siendo idempotentes en D1. Beacon no entrega una respuesta: un envío encolado nunca incrementa directamente el panel ni se presenta como aceptado.

La versión del Worker que admite `text/plain` debe revisarse y desplegarse antes de publicar el frontend correspondiente. Si no se respeta ese orden, la ruta principal con `fetch` continúa funcionando, pero el respaldo Beacon recibirá `415` hasta actualizar el Worker.

Los UUID se generan con `crypto.randomUUID()` cuando existe. En navegadores con Web Crypto pero sin ese método se genera un UUID v4 mediante `crypto.getRandomValues()`. Sin Web Crypto, JavaScript, `fetch` o conectividad permitida no se registra la sesión.

Los mecanismos utilizados pertenecen a la plataforma web y no dependen del sistema operativo. Se espera funcionamiento en versiones modernas de Chrome, Edge, Firefox, Safari, Chrome para Android y Samsung Internet que implementen Web Crypto, Fetch, CORS, eventos DOM y almacenamiento de sesión. Los navegadores integrados en aplicaciones pueden restringir almacenamiento, navegación externa o red. Si `sessionStorage` no está disponible, la pantalla permite consultar el CV sin medición; no se intenta conservar una autorización en memoria ni se garantiza el envío si el contenedor impide JavaScript o las solicitudes.

La pantalla previa explica que se contabilizan una sesión seudónima, tiempo activo aproximado y categorías de clics. Aceptar guarda `granted` únicamente en `sessionStorage` y recarga el ciclo estadístico; continuar sin medición guarda `denied` sin generar visitas. Revocar cambia la decisión a `denied`, elimina el UUID y el tiempo local y detiene eventos nuevos. La decisión desaparece al cerrar la pestaña, no usa cookies ni `localStorage` y no modifica preferencias globales del navegador. Si el almacenamiento temporal está bloqueado, el currículum se libera sin medición y la interfaz informa la limitación.

## Contrato de lectura

`GET /stats-d1` devuelve uno de dos estados válidos:

- `sin_registros` con `stats: null`: la base no tiene filas agregadas y el frontend representa los diez indicadores en cero;
- `datos_disponibles` con un objeto `stats`: el frontend valida y muestra los valores recibidos sin sustituirlos.

Una respuesta HTTP incorrecta, JSON inválido o contador negativo produce un estado de error. No se convierte en cero porque eso ocultaría una falla de servicio.

`GET /history-d1` devuelve hasta 90 días en UTC. Un arreglo vacío es un estado válido y se explica como ausencia de registros históricos. El frontend no fabrica días ni barras para rellenar la gráfica.

## Significado de los indicadores

- **Visitas:** sesiones aceptadas, no personas únicas.
- **Clics relevantes:** activaciones de enlaces seleccionados; no confirman acciones externas completadas.
- **Tiempo activo medio:** promedio aproximado calculado a partir de visibilidad e interacción.
- **En línea:** sesiones con actividad reciente; una persona puede mantener varias.
- **Acciones:** descarga del CV, WhatsApp, correo, teléfono, navegación interna y enlaces de proyectos.

## Privacidad y límites

El esquema no incluye nombres, correos, teléfonos ni direcciones IP. Cada sesión usa un UUID seudónimo que, después de ser aceptado por el Worker, se conserva únicamente en `sessionStorage` por pestaña. El estado local distingue `confirmedActiveMs`, ya confirmado, de `pendingActiveMs`, el último acumulado medido cuya respuesta pudo quedar interrumpida. Una recarga reenvía primero el pendiente con la misma actualización monotónica y solo después fija la base para sumar actividad nueva. Las escrituras tardías fusionan máximos y no pueden reducir ni borrar un valor más reciente. Al cerrar la pestaña se descarta el estado; no se usan cookies ni `localStorage`. Con o sin DNT, el transporte requiere la decisión temporal descrita anteriormente. GPC siempre lo bloquea. Si `sessionStorage` no está disponible, el CV continúa accesible sin activar el transporte.

La seudonimización no equivale a anonimización absoluta. Cloudflare puede recibir metadatos de red por operar la infraestructura. Los límites de origen, frecuencia, tamaño, sesión y eventos reducen abuso, pero no eliminan tráfico automatizado ni permiten deducir personas únicas.

### Control de frecuencia preparado

El Worker usa el mismo binding gratuito de rate limiting con claves de alcances distintos:

- `events:edge:<colo>` limita el volumen general por centro de datos de Cloudflare;
- `events:start:<colo>` separa los inicios de sesión;
- `events:session:<uuid>` limita eventos posteriores dentro de una sesión aceptada.

No se utiliza una dirección IP como clave. El centro de datos agrupa numerosos visitantes y un atacante todavía puede afectar a otros usuarios de la misma región. El UUID es enviado por el cliente y puede rotarse. Estas limitaciones se compensan parcialmente con sesión previa, máximo de clics, idempotencia, validación de tiempo y agregados D1, pero no desaparecen.

El encabezado `Origin` y CORS restringen navegadores compatibles; no autentican al emisor y pueden ser reproducidos por clientes no controlados.

## Inicializar una D1 nueva en laboratorio

La fuente actual es `infra/cloudflare/d1-schema.sql`. Contiene las tres tablas, sus índices y estos disparadores:

- `trg_analytics_sessions_insert`;
- `trg_analytics_events_insert`;
- `trg_analytics_sessions_active_ms`.

Para comprobar el esquema sin tocar Cloudflare ni archivos persistentes:

```bash
poetry run pytest -q tests/test_cloudflare_d1_schema.py
```

La prueba usa SQLite en memoria, verifica que una base nueva esté vacía, confirma los tres disparadores y comprueba acumulación, idempotencia y las seis acciones permitidas.

Si se usa Wrangler, debe ser exclusivamente con `--local` y una configuración de laboratorio revisada. No se incluye aquí un comando remoto para evitar que el procedimiento se copie accidentalmente contra producción.

## Migraciones históricas

Los archivos `d1-migration-01-daily-clicks.sql`, `d1-migration-02-event-actions.sql` y `d1-migration-03-automatic-aggregates.sql` actualizan versiones anteriores del esquema. No deben ejecutarse sobre una base creada con `d1-schema.sql`, porque el esquema actual ya contiene sus columnas, restricciones y disparadores.

Antes de cualquier migración remota futura se necesita respaldo, revisión del estado real, ventana operativa y autorización expresa. Las pruebas locales nunca se copian a producción.

## Verificación pública de solo lectura

Las rutas públicas son:

- `GET /health`;
- `GET /stats`;
- `GET /stats-d1`;
- `GET /history-d1`.

La fecha de despliegue del frontend no es por sí sola el inicio de medición. Ese inicio se registra cuando D1 confirma el primer evento público legítimo. Mientras `recording` sea `false`, el sistema está publicado para lectura y validación, no para recopilación.

## Procedimiento de activación

Este procedimiento exige autorización expresa:

1. Confirmar nuevamente que D1 conserva sus acumulados y crear un respaldo operativo.
2. Repetir las pruebas locales del Worker, transporte y esquema.
3. Autorizar y desplegar primero el Worker con `ANALYTICAS_ESCRITURA` habilitada.
4. Verificar salud, CORS, limitación y una sesión controlada sin borrar datos.
5. Autorizar después `PUBLIC_RECORDING_ENABLED` en el frontend y publicar GitHub Pages.
6. Registrar la fecha del primer evento aceptado como inicio efectivo de medición.

## Reversión propuesta

1. Deshabilitar y desplegar primero `ANALYTICAS_ESCRITURA` en el Worker para detener nuevas escrituras.
2. Restaurar `PUBLIC_RECORDING_ENABLED` a `false` y publicar el frontend.
3. Conservar todas las filas y acumulados existentes para análisis y auditoría.
4. Investigar la causa antes de una nueva activación.

La reversión nunca incluye `DELETE`, `TRUNCATE`, reinicio de contadores ni sustitución de la base D1.
