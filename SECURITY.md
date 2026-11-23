# Seguridad y privacidad

## Reportar un problema

Los problemas de seguridad pueden comunicarse de forma privada a `David650991@gmail.com`. No publiques credenciales, datos personales, registros de producción ni instrucciones de explotación en una incidencia pública.

## Alcance

El repositorio genera un sitio estático, pero el panel de estadísticas consulta una API pública de Cloudflare Workers respaldada por Cloudflare D1. El sitio no procesa contraseñas ni formularios de identidad. Los proyectos enlazados mantienen alcances y políticas independientes.

Los archivos públicos contienen datos de contacto destinados al currículum. Nunca deben añadirse llaves de API, tokens, secretos, expedientes, documentos personales ni información sensible de terceros.

## Estadísticas y minimización de datos

- Producción utiliza `ANALYTICAS_ESCRITURA` habilitada conforme a la autorización expresa del responsable del proyecto.
- El transporte reconoce localhost y el origen oficial de GitHub Pages. Cada pestaña nueva bloquea los POST hasta una decisión explícita. Global Privacy Control bloquea siempre la medición y DNT permanece respetado hasta una autorización voluntaria.
- DNT es una señal heredada y GPC una señal vigente y distinta. La autorización local nunca invalida GPC ni depende del navegador, sistema operativo o procedencia del enlace.
- El UUID, el tiempo activo confirmado, un posible acumulado pendiente y la decisión del sitio se conservan por separado solo en `sessionStorage` por pestaña. Una recarga reconcilia primero el pendiente mediante la actualización monotónica del Worker; no se guardan cookies ni `localStorage`.
- Continuar sin medición o revocar elimina la sesión estadística local y detiene eventos nuevos. Si `sessionStorage` está bloqueado, el currículum sigue disponible y la medición permanece desactivada.
- D1 no almacena nombres, correos, teléfonos ni direcciones IP en las tablas del proyecto.
- Los identificadores son seudónimos, no una garantía de anonimización absoluta. La infraestructura de Cloudflare puede procesar metadatos de red conforme a sus propios términos.

## Controles del Worker

Las escrituras exigen un origen permitido, JSON válido, tamaño limitado, tipos y acciones admitidos, una sesión previa, UUID con formato válido, límite de clics por sesión y un rate limiter configurado. Los eventos repetidos usan `event_id` idempotente y el tiempo activo solo puede aumentar dentro de límites definidos.

El limitador usa dos ámbitos: uno general por centro de datos de Cloudflare y otro para inicios o eventos de una sesión. No utiliza la IP como clave. El UUID de sesión es controlado por el cliente y puede rotarse, por lo que tampoco funciona como identidad ni como defensa suficiente por sí mismo.

Estos controles reducen abuso y duplicados, pero no eliminan bots ni garantizan que cada sesión corresponda a una persona distinta. `Origin` y CORS son controles del navegador, no mecanismos de autenticación. Las rutas de lectura son públicas por diseño.

## Operación segura

No ejecutes migraciones ni pruebas destructivas contra D1 remota. Una base nueva usa `infra/cloudflare/d1-schema.sql`; las migraciones numeradas son únicamente para esquemas históricos. La activación de escritura, un despliegue del Worker o una migración remota requieren revisión y autorización independientes.
