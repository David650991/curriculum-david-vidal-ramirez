# Tecnologías y guía para sus logotipos

La lista canónica vive en `config/technologies.yml`. Reúne las tecnologías comprobadas en los siete proyectos; no es una declaración de dominio experto.

## Logotipos que sí conviene incorporar

Para no convertir el portafolio en una pared de marcas, conviene mostrar sólo una selección principal:

- Python
- JavaScript
- HTML5
- CSS3
- Flask
- Node.js
- SQLite
- Cloudflare
- Firebase
- Git
- GitHub Actions
- OpenCV

Los logotipos deben descargarse en SVG desde el sitio oficial de cada tecnología o desde [Simple Icons](https://simpleicons.org/). Antes de añadirlos hay que comprobar su licencia, conservar su proporción y escribir un texto alternativo adecuado. No conviene descargar imágenes desde resultados de Google.

## Tecnologías sin logotipo necesario

SQL, YAML, Web Components, Canvas API, WebSocket, PWA, JWT, TOTP y rate limiting son estándares, conceptos o capacidades. Se entienden mejor como texto y no necesitan un emblema inventado.

## Regla para incorporarlos

Los SVG definitivos deberán guardarse en `config/assets/technologies/`. Después se añadirá su ruta en `config/technologies.yml` y el generador copiará únicamente los que aparezcan en la página. Hasta entonces, el sitio muestra nombres en texto para mantener una carga rápida y evitar imágenes provisionales.
