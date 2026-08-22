# Currículum y portafolio de David Vidal Ramírez

Sitio profesional en español que reúne mi perfil, formación, experiencia y siete proyectos de software. El contenido se administra en YAML y un generador en Python/Jinja lo convierte en un sitio estático ligero para GitHub Pages.

## Objetivo

Presentar de forma coherente mi transición desde áreas operativas y comerciales hacia el desarrollo de software, con evidencia verificable de trabajo en aplicaciones web, automatización, tiempo real, autenticación, visión computacional y despliegue cloud.

## Proyectos documentados

1. Generador de Expedientes de Entrevista — aplicación institucional privada.
2. La Luz y La Esperanza Que Necesito — sitio institucional en producción.
3. Auth Practice — laboratorio experimental de autenticación multifactor.
4. [GRID-Chat](https://grid-chat-lknf.onrender.com/) — prototipo funcional de comunicación en tiempo real.
5. VisionLab — laboratorio de visión computacional en navegador.
6. Currículum y portafolio automatizado — este repositorio.
7. David Vidal IT Tuxtepec Server — demostrador Node.js sobre ARM64.

Las tarjetas diferencian explícitamente productos en producción, proyectos privados, prototipos y laboratorios. No se presentan experimentos como sistemas terminados.

## Arquitectura

```text
config/             Contenido profesional y recursos fuente
src/jinja/          Plantillas HTML semánticas
src/css/            Módulos visuales unidos durante la compilación
src/js/             Navegación progresiva y accesible
portfolio/          Carga, validación, recursos y generación pública
tests/              Pruebas del contenido y la publicación
main.py             Generador estático
dist/               Resultado local; no se versiona
```

El sitio publicado no necesita servidor, base de datos ni framework del lado cliente. Durante la compilación, los módulos CSS se unen en un solo archivo para mantener el código ordenado sin aumentar las solicitudes del navegador. Solo se copian recursos incluidos expresamente en el manifiesto público; las imágenes de proyectos cargan de forma diferida y el mapa interactivo espera una acción del visitante.

La compilación también genera `cv.html` y un PDF profesional de tres páginas con texto seleccionable, estructura lineal y nombres explícitos de tecnologías para facilitar su lectura por sistemas ATS. El PDF conserva los 17 periodos laborales, resume las competencias centrales en la primera página y organiza las tecnologías por nivel de experiencia en la tercera.

El historial laboral usa nombres y fechas tomados de una constancia IMSS emitida el 15 de marzo de 2025. El documento fuente no se versiona y sus identificadores, salarios, registros patronales y sellos no se publican.

## Requisitos y ejecución

- Python 3.10 o posterior compatible
- Poetry

```bash
poetry install
poetry run pytest
poetry run ruff check .
poetry run python main.py
```

El resultado se genera en `dist/`. Para revisarlo localmente:

```bash
python -m http.server 8000 --directory dist
```

## Actualizar contenido

- Identidad, enlaces y metadatos: `config/profile.yml`
- Perfil y capacidades: `config/about.yml`
- Formación y experiencia: `config/resume.yml`
- Proyectos y estados: `config/projects.yml`
- Tecnologías utilizadas: `config/technologies.yml`
- Certificaciones seleccionadas: `config/certifications.yml`
- Sistema central de iconografía: `config/iconography.yml`
- Contacto: `config/contact.yml`
- Navegación: `config/navbar.yml`

Antes de publicar, hay que ejecutar las pruebas. Estas comprueban que existan los siete proyectos, que los datos académicos esenciales estén presentes y que el artefacto no arrastre imágenes o dependencias externas innecesarias.

## Publicación

El flujo de GitHub Actions valida código y pruebas en cada `push` o `pull request` dirigido a `main`. En eventos publicables genera `dist/` y despliega únicamente ese directorio en GitHub Pages.

## Imágenes

La fotografía profesional, las representaciones conceptuales y la captura institucional se almacenan con nombres semánticos. Las ilustraciones conceptuales están identificadas como tales y no se presentan como capturas reales. GRID-Chat incorpora además su logotipo original como distintivo de marca.

## Responsividad y archivos públicos

El diseño se prueba desde 280 hasta 1440 píxeles, con puntos de ruptura para móviles estrechos, teléfonos, tabletas y escritorio. La navegación mantiene desplazamiento táctil y los controles sociales conservan logotipo y nombre.

Durante cada build se generan `robots.txt`, `sitemap.xml`, `site.webmanifest`, `humans.txt`, `404.html`, `cv.html`, `LICENSE.txt` y el PDF descargable. `robots.txt` es el nombre estándar; no se mantiene una copia redundante llamada `robot.txt`.

La selección, organización y licencia de los iconos se documentan en `docs/ICONOGRAFIA-Y-LICENCIAS.md`.

## Autor y contacto

Creado, diseñado, desarrollado y mantenido por **David Vidal Ramírez**.

- Correo profesional: [David650991@gmail.com](mailto:David650991@gmail.com)
- Correo institucional: [L25350801@tuxtepec.tecnm.mx](mailto:L25350801@tuxtepec.tecnm.mx)
- GitHub: [David650991](https://github.com/David650991)
- LinkedIn: [David Vidal Ramírez](https://www.linkedin.com/in/david-vidal-ramirez-3ba01b147/)

## Iconografía y rendimiento

Las marcas tecnológicas se almacenan como SVG locales procedentes de Simple Icons y los conceptos funcionales utilizan Lucide. La resolución se centraliza en `config/iconography.yml` y los componentes reutilizables se encuentran en `src/jinja/components/`. El sitio no depende de CDN para mostrar iconos.

## Licencia

El código propio se distribuye bajo la licencia MIT incluida en [LICENSE](LICENSE). Los datos personales, fotografías, textos curriculares y marcas de terceros no se conceden como material reutilizable. La autoría, procedencia y límites de reutilización se detallan en [NOTICE.md](NOTICE.md), y la cobertura del contenido profesional se documenta en [docs/VERIFICACION-CONTENIDO.md](docs/VERIFICACION-CONTENIDO.md).
