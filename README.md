# Currículum y portafolio de David Vidal Ramírez

Sitio profesional en español que reúne mi perfil, formación, experiencia y siete proyectos de software. El contenido se administra en YAML y un generador en Python/Jinja lo convierte en un sitio estático ligero para GitHub Pages.

## Objetivo

Presentar de forma coherente mi transición desde áreas operativas y comerciales hacia el desarrollo de software, con evidencia verificable de trabajo en aplicaciones web, automatización, tiempo real, autenticación, visión computacional y despliegue cloud.

## Proyectos documentados

1. Generador de Expedientes de Entrevista — aplicación institucional privada.
2. La Luz y La Esperanza Que Necesito — sitio institucional en producción.
3. Auth Practice — laboratorio experimental de autenticación multifactor.
4. GRID-Chat — prototipo funcional de comunicación en tiempo real.
5. VisionLab — laboratorio de visión computacional en navegador.
6. Currículum y portafolio automatizado — este repositorio.
7. David Vidal IT Tuxtepec Server — demostrador Node.js sobre ARM64.

Las tarjetas diferencian explícitamente productos en producción, proyectos privados, prototipos y laboratorios. No se presentan experimentos como sistemas terminados.

## Arquitectura

```text
config/             Contenido profesional y recursos fuente
src/jinja/          Plantillas HTML semánticas
src/css/            Estilos responsivos
src/js/             Navegación progresiva y accesible
tests/              Pruebas del contenido y la publicación
main.py             Generador estático
dist/               Resultado local; no se versiona
```

El sitio publicado no necesita servidor, base de datos ni framework del lado cliente. Carga CSS y JavaScript locales, publica únicamente tres imágenes necesarias y aplica carga diferida a la captura de proyecto.

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
- Contacto: `config/contact.yml`
- Navegación: `config/navbar.yml`

Antes de publicar, hay que ejecutar las pruebas. Estas comprueban que existan los siete proyectos, que los datos académicos esenciales estén presentes y que el artefacto no arrastre imágenes o dependencias externas innecesarias.

## Publicación

El flujo de GitHub Actions valida código y pruebas en cada `push` o `pull request` dirigido a `main`. En eventos publicables genera `dist/` y despliega únicamente ese directorio en GitHub Pages.

## Imágenes

La fotografía profesional actual es utilizable. El diseño emplea monogramas cuando no existe una captura representativa, de modo que ninguna imagen genérica se presenta como evidencia de un proyecto. Para enriquecer el portafolio pueden incorporarse después capturas reales, sin datos privados, de los proyectos que aún no las tienen.

## Autor y contacto

Desarrollado y mantenido por **David Vidal Ramírez**.

- Correo profesional: [David650991@gmail.com](mailto:David650991@gmail.com)
- Correo institucional: [L25350801@tuxtepec.tecnm.mx](mailto:L25350801@tuxtepec.tecnm.mx)
- GitHub: [David650991](https://github.com/David650991)
- LinkedIn: [David Vidal Ramírez](https://www.linkedin.com/in/david-vidal-ramirez-3ba01b147/)

## Licencia

El código se distribuye bajo la licencia MIT incluida en [LICENSE](LICENSE). Los datos personales, fotografías, textos curriculares y marcas de terceros no se conceden como material reutilizable.
