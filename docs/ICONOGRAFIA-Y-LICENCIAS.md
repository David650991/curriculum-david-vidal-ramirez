# Iconografía y licencias

El catálogo visual canónico se administra en `config/iconography.yml`. Los SVG se conservan localmente en `src/assets/icons/` para mantener disponibilidad sin conexión, evitar dependencias de CDN y publicar sólo los recursos utilizados.

## Organización

- `technologies/`: marcas tecnológicas procedentes principalmente de Simple Icons.
- `brands/`: redes sociales y canales con identidad visual propia.
- `functional/`: acciones y conceptos generales procedentes de Lucide.

Las marcas conservan su proporción y, cuando ayuda a reconocerlas, su color oficial. Los estándares o conceptos sin marca —por ejemplo SQL, YAML, WebSocket, JWT o TOTP— se representan con texto o iconos funcionales; no se inventan logotipos.

## Selección y mantenimiento

La lista de tecnologías comprobadas vive en `config/technologies.yml`. Incorporar una nueva marca exige verificar su uso en el proyecto, licencia, fuente, nombre de archivo en minúsculas y texto alternativo. No se agregan imágenes obtenidas de resultados de búsqueda ni variantes redundantes.

Los SVG se guardan en la categoría correspondiente y su asociación semántica se añade una sola vez a `config/iconography.yml`. El generador excluye documentación interna del directorio publicado.

## Fuentes

- [Simple Icons](https://simpleicons.org/) — CC0 1.0.
- [Lucide](https://lucide.dev/) — licencia ISC.

Las marcas de terceros pertenecen a sus respectivos titulares y se utilizan únicamente con fines descriptivos.
