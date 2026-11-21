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

El panel público es de lectura. `visitor-analytics.js` identifica acciones y `visitor-session.js` estima actividad, pero `visitor-transport.js` solo envía eventos cuando el sitio se ejecuta en `localhost` o `127.0.0.1`. La configuración de producción mantiene `ANALYTICAS_ESCRITURA = "deshabilitada"`.

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

El esquema no incluye nombres, correos, teléfonos ni direcciones IP. Cada sesión usa un UUID seudónimo creado en memoria, sin cookies ni almacenamiento persistente. DNT y Global Privacy Control bloquean el transporte local.

La seudonimización no equivale a anonimización absoluta. Cloudflare puede recibir metadatos de red por operar la infraestructura. Los límites de origen, frecuencia, tamaño, sesión y eventos reducen abuso, pero no eliminan tráfico automatizado ni permiten deducir personas únicas.

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

La fecha de despliegue del frontend no es el inicio de medición. Ese inicio solo puede registrarse cuando se autorice la escritura, se despliegue la configuración correspondiente y se confirme el primer evento real. Mientras `recording` sea `false`, el sistema está publicado para lectura y validación, no para recopilación.
