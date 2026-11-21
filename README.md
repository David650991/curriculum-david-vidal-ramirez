# Currículum y portafolio de David Vidal Ramírez

Este repositorio contiene mi currículum profesional y portafolio de software. Reúne mi perfil, formación, trayectoria y diez proyectos con alcances diferenciados: productos en uso, proyectos privados, prototipos, laboratorios y demostradores técnicos.

El sitio separa el contenido de la presentación. Los datos profesionales se mantienen en YAML; Python los valida y Jinja2 genera el HTML que se publica en GitHub Pages. El mismo proceso produce un CV en PDF con texto seleccionable y enlaces navegables.

Soy **David Vidal Ramírez**, creador, diseñador, desarrollador y responsable del mantenimiento del proyecto.

## Objetivo profesional

El portafolio presenta mi transición desde áreas operativas y comerciales hacia el desarrollo de software. Cada ficha explica el problema, la solución, mi aportación, el alcance actual y las tecnologías utilizadas, sin presentar experimentos como productos terminados.

## Proyectos documentados

1. Generador de Expedientes de Entrevista — aplicación institucional privada.
2. Auth Practice — laboratorio experimental de autenticación multifactor.
3. [GRID-Chat](https://grid-chat-lknf.onrender.com/) — prototipo funcional de comunicación en tiempo real.
4. VisionLab — laboratorio de visión computacional en navegador.
5. La Luz y La Esperanza Que Necesito — sitio institucional en producción.
6. Currículum y portafolio automatizado — este repositorio.
7. David Vidal IT Tuxtepec Server — demostrador Node.js sobre ARM64.
8. VUMARI STUDIOS — sitio modular y herramientas locales de subtítulos.
9. Asistente Python — aplicación local de conocimiento supervisado con Flask y SQLite.
10. Generador de Expedientes de Personas Usuarias y Consejeros — prototipo modular de documentación institucional.

## Tecnologías y generación

- Python, Jinja2, PyYAML y Poetry para cargar, validar y generar el sitio.
- HTML5, CSS3 y JavaScript modular para la interfaz pública.
- pytest y Ruff para pruebas y calidad de código.
- GitHub Actions y GitHub Pages para integración y publicación.
- Cloudflare Workers y Cloudflare D1 para la lectura pública de estadísticas agregadas.

La compilación genera `index.html`, `404.html`, `cv.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, `humans.txt`, `LICENSE.txt` y `dist/assets/cv-david-vidal-ramirez.pdf`. Los módulos CSS se consolidan en un único archivo; los iconos y las fuentes se sirven localmente; las imágenes de proyectos usan carga diferida y el mapa espera una acción del visitante.

## Arquitectura del repositorio

```text
config/              Contenido profesional y configuración visual
docs/                Verificación, licencias y documentación técnica
infra/cloudflare/    Worker, esquema D1 y migraciones históricas
infra/firebase/      Reglas del origen estadístico anterior
portfolio/           Carga, validación, build y archivos públicos
src/jinja/           Plantillas HTML semánticas
src/css/             Estilos modulares y adaptación responsive
src/js/              Navegación, accesibilidad y estadísticas
tests/               Pruebas de publicación, PDF, D1 y frontend
main.py              Punto de entrada del generador
dist/                Resultado local generado; no se versiona
```

## Estadísticas públicas

El frontend estático consulta un servicio de lectura en Cloudflare Workers respaldado por Cloudflare D1. Por ello, el sitio publicado sigue siendo estático, pero su panel de actividad consume una API externa.

El panel puede mostrar:

- sesiones registradas como visitas;
- clics relevantes y su distribución por acción;
- tiempo activo medio aproximado;
- sesiones con actividad reciente como estimación de usuarios en línea;
- historial agregado de hasta 90 días en UTC.

Una visita representa una sesión aceptada, no una persona única. Una misma persona puede abrir varias sesiones. Un clic indica que se activó un enlace seleccionado, pero no demuestra que una descarga, llamada, correo o conversación externa se haya completado. El tiempo activo se estima con visibilidad e interacción del navegador y no equivale al tiempo total de lectura.

Cuando la API confirma `status: "sin_registros"` y `stats: null`, el panel muestra los diez indicadores en cero. Una falla HTTP, de red o de validación conserva un estado de error; no se transforma en ceros. El historial vacío se presenta con un mensaje explícito y no se rellena con datos simulados.

### Estado de producción

La configuración de producción utiliza `ANALYTICAS_ESCRITURA = "habilitada"` y el navegador público envía eventos al endpoint `/events`. Localhost continúa disponible para pruebas aisladas. DNT y Global Privacy Control se comprueban antes de generar un identificador de sesión o realizar una solicitud.

El Worker aplica un límite general por centro de datos de Cloudflare y un segundo ámbito que separa inicios de sesión de eventos posteriores. No utiliza direcciones IP como clave. Los eventos de una sesión comparten un ámbito seudónimo, pero el UUID procede del cliente y puede rotarse; por ello, este control se combina con sesión previa, idempotencia y límites en D1. `Origin`, CORS y el limitador reducen abuso, pero no autentican visitantes ni eliminan completamente los bots.

La fecha efectiva de inicio de medición debe registrarse cuando D1 confirme el primer evento público legítimo; la publicación por sí sola no demuestra que exista una visita.

Los identificadores de sesión son UUID seudónimos creados en memoria. El código no los guarda en cookies ni almacenamiento persistente y el esquema no contiene nombres, correos, teléfonos ni direcciones IP. Esto reduce la información tratada, pero no constituye anonimización absoluta: Cloudflare puede procesar metadatos de red como parte de su infraestructura.

La arquitectura, los límites y el procedimiento local para una base nueva se documentan en [Estadísticas públicas](docs/ESTADISTICAS-PUBLICAS.md).

## D1: esquema actual y migraciones

`infra/cloudflare/d1-schema.sql` es la fuente para inicializar una base nueva. Incluye tablas, índices y tres disparadores que acumulan sesiones, clics y tiempo activo.

Los archivos `d1-migration-01-*`, `d1-migration-02-*` y `d1-migration-03-*` conservan el camino histórico para bases antiguas. No deben aplicarse sobre una base creada con el esquema actual ni ejecutarse automáticamente durante el build.

Los datos locales de laboratorio son independientes de producción y nunca deben copiarse a D1 remota.

## Requisitos y ejecución local

- Python 3.10 o posterior compatible.
- Poetry.
- Node.js para las pruebas del contrato JavaScript.
- Chrome o Chromium para generar el PDF.

```bash
poetry install
poetry run ruff check .
poetry run pytest -q
node --test tests/test_*.mjs
poetry run python main.py
```

Para revisar el resultado:

```bash
python -m http.server 8000 --directory dist
```

La sintaxis de los módulos modificados puede comprobarse con:

```bash
node --check src/js/modules/visitor-dashboard.js
node --check src/js/modules/visitor-analytics.js
node --check src/js/modules/visitor-session.js
node --check src/js/modules/visitor-transport.js
```

## Contenido y evidencias

La identidad y el contenido curricular viven en `config/`. El historial laboral usa nombres y fechas de una constancia IMSS emitida el 15 de marzo de 2025; el documento fuente y sus identificadores sensibles no se versionan. La selección de certificaciones tampoco incorpora folios ni PDF personales al repositorio.

Las representaciones conceptuales de proyectos se identifican como tales. La fotografía profesional, los textos curriculares y los datos personales no se relicencian bajo MIT.

## Publicación

GitHub Actions ejecuta Ruff, pytest, la prueba JavaScript y el build en cada `push` o `pull request` dirigido a `main`. GitHub Pages recibe únicamente `dist/` en eventos publicables; una Pull Request valida el proyecto, pero no publica ni fusiona cambios automáticamente.

## Documentación relacionada

- [Estadísticas públicas](docs/ESTADISTICAS-PUBLICAS.md)
- [Verificación del contenido](docs/VERIFICACION-CONTENIDO.md)
- [Iconografía y licencias](docs/ICONOGRAFIA-Y-LICENCIAS.md)
- [Seguridad y privacidad](SECURITY.md)
- [Autoría y procedencia](NOTICE.md)
- [Guía de actualización](CONTRIBUTING.md)

## Autor y contacto

Creado, diseñado, desarrollado y mantenido por **David Vidal Ramírez**.

- Correo profesional: [David650991@gmail.com](mailto:David650991@gmail.com)
- Correo institucional: [L25350801@tuxtepec.tecnm.mx](mailto:L25350801@tuxtepec.tecnm.mx)
- GitHub: [David650991](https://github.com/David650991)
- LinkedIn: [David Vidal Ramírez](https://www.linkedin.com/in/david-vidal-ramirez-3ba01b147/)

## Licencia

El código propio se distribuye bajo la licencia MIT incluida en [LICENSE](LICENSE). Los datos personales, fotografías, textos curriculares y marcas de terceros quedan fuera de esa concesión. Los detalles se encuentran en [NOTICE.md](NOTICE.md).
