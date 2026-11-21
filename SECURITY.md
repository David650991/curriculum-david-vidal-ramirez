# Seguridad y privacidad

## Reportar un problema

Los problemas de seguridad pueden comunicarse de forma privada a `David650991@gmail.com`. No publiques credenciales, datos personales, registros de producción ni instrucciones de explotación en una incidencia pública.

## Alcance

El repositorio genera un sitio estático, pero el panel de estadísticas consulta una API pública de Cloudflare Workers respaldada por Cloudflare D1. El sitio no procesa contraseñas ni formularios de identidad. Los proyectos enlazados mantienen alcances y políticas independientes.

Los archivos públicos contienen datos de contacto destinados al currículum. Nunca deben añadirse llaves de API, tokens, secretos, expedientes, documentos personales ni información sensible de terceros.

## Estadísticas y minimización de datos

- Producción utiliza `ANALYTICAS_ESCRITURA` habilitada conforme a la autorización expresa del responsable del proyecto.
- El transporte reconoce localhost y el origen oficial de GitHub Pages; los POST públicos se omiten cuando DNT o Global Privacy Control están activos.
- DNT (señal heredada y obsoleta) y Global Privacy Control (señal vigente y distinta) impiden crear el identificador de sesión y enviar eventos; no existe una excepción silenciosa por navegador o dispositivo.
- El UUID y el tiempo activo aceptados se conservan solo en `sessionStorage` por pestaña para evitar duplicar visitas al recargar; no se guardan en cookies ni `localStorage`. DNT y GPC bloquean el registro y eliminan esa sesión local.
- D1 no almacena nombres, correos, teléfonos ni direcciones IP en las tablas del proyecto.
- Los identificadores son seudónimos, no una garantía de anonimización absoluta. La infraestructura de Cloudflare puede procesar metadatos de red conforme a sus propios términos.

## Controles del Worker

Las escrituras exigen un origen permitido, JSON válido, tamaño limitado, tipos y acciones admitidos, una sesión previa, UUID con formato válido, límite de clics por sesión y un rate limiter configurado. Los eventos repetidos usan `event_id` idempotente y el tiempo activo solo puede aumentar dentro de límites definidos.

El limitador usa dos ámbitos: uno general por centro de datos de Cloudflare y otro para inicios o eventos de una sesión. No utiliza la IP como clave. El UUID de sesión es controlado por el cliente y puede rotarse, por lo que tampoco funciona como identidad ni como defensa suficiente por sí mismo.

Estos controles reducen abuso y duplicados, pero no eliminan bots ni garantizan que cada sesión corresponda a una persona distinta. `Origin` y CORS son controles del navegador, no mecanismos de autenticación. Las rutas de lectura son públicas por diseño.

## Operación segura

No ejecutes migraciones ni pruebas destructivas contra D1 remota. Una base nueva usa `infra/cloudflare/d1-schema.sql`; las migraciones numeradas son únicamente para esquemas históricos. La activación de escritura, un despliegue del Worker o una migración remota requieren revisión y autorización independientes.
