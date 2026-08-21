# Verificación y trazabilidad del contenido profesional

Última auditoría local: 20 de agosto de 2026.

Este documento distingue datos confirmados, enlaces comprobados y límites de verificación. Su propósito es impedir que una recomendación narrativa se publique como hecho sin respaldo.

## Fuente de contenido

La fuente recibida describe la identidad profesional, formación, trayectoria, siete proyectos, tecnologías, límites técnicos, privacidad, SEO y estructura esperada del currículum. Los datos públicos se centralizan en los archivos YAML de `config/`; las plantillas de `src/jinja/` los convierten en el sitio y el generador produce HTML y PDF.

## Datos personales y académicos publicados

| Dato | Fuente canónica | Salida pública |
| --- | --- | --- |
| David Vidal Ramírez | `config/profile.yml` | Encabezado, metadatos, Schema.org, CV y PDF |
| Desarrollador de software | `config/profile.yml` | Encabezado, SEO y datos estructurados |
| Ingeniería en Sistemas Computacionales | `config/profile.yml`, `config/resume.yml` | Encabezado, perfil, trayectoria, CV y PDF |
| TecNM / Instituto Tecnológico de Tuxtepec | `config/resume.yml` | Formación, Schema.org, CV y PDF |
| 3.er semestre, modalidad en línea | `config/profile.yml`, `config/resume.yml` | Encabezado, perfil, métricas, trayectoria, CV y PDF |
| Tres Valles, Veracruz, México | `config/profile.yml`, `config/contact.yml` | Contacto, mapa, Schema.org, CV y PDF |
| Correos, teléfono y perfiles sociales | `config/profile.yml`, `config/contact.yml` | Contacto, enlaces y CV |

No se publica fecha de nacimiento, domicilio completo, CURP, RFC, NSS, matrícula aislada ni documentación personal.

## Historial laboral respaldado por IMSS

Se revisó la constancia de semanas cotizadas emitida por el IMSS el 15 de marzo de 2025. El documento contiene 17 periodos de alta y baja asociados a 16 patrones; Eulen México aparece en dos periodos distintos. Los nombres normalizados de los patrones, fechas y entidades federativas se publican en `config/resume.yml` y en la sección de trayectoria.

El reporte se utilizó solo para corregir nombres y fechas. No se copiaron al repositorio NSS, CURP, registro patronal, salario base de cotización, folio, sellos, domicilio del documento ni total de semanas. La actividad independiente de desarrollo desde 2024 se conserva separada porque no forma parte de las altas patronales contenidas en esa constancia.

## Proyectos documentados

| Proyecto | Estado publicado | Evidencia o límite |
| --- | --- | --- |
| Generador de Expedientes de Entrevista | Uso institucional privado | El autor confirmó `David650991/Generador-Expedientes-Podcast` como repositorio privado; la integración no puede inspeccionarlo y la demostración requiere autorización |
| La Luz y La Esperanza Que Necesito | Producción | Repositorio y sitio público comprobables |
| Auth Practice | Experimental | El autor confirmó `David650991/auth-practice` como repositorio privado; la integración recibe 404 y por ello el sitio no ofrece un enlace público |
| GRID-Chat | Prototipo funcional | Repositorio público comprobable y demostración enlazada |
| VisionLab | Laboratorio experimental | Repositorio público comprobable; sin demostración pública confirmada |
| Currículum y portafolio automatizado | Proyecto activo | Implementación, pruebas, CI/CD y repositorio actual |
| David Vidal IT Tuxtepec Server | Demostrador técnico | Repositorio público comprobable; alcance limitado explícitamente |

Las categorías “producción”, “privado”, “experimental”, “prototipo”, “laboratorio” y “demostrador” evitan presentar todos los repositorios como productos terminados.

## Afirmaciones deliberadamente limitadas

- No se emplean títulos como senior, experto, arquitecto, especialista en ciberseguridad, especialista DevOps o ingeniero de IA.
- Auth Practice no se presenta como proveedor de identidad ni sistema biométrico de producción.
- VisionLab no se presenta como identificación de personas ni evaluación psicológica.
- El sitio institucional no se presenta como expediente clínico ni plataforma médica.
- El demostrador Node.js no se presenta como clúster, plataforma de monitoreo ni infraestructura completa.
- Los niveles técnicos se expresan mediante contexto y evidencia, no porcentajes subjetivos.

## Certificaciones

Se revisaron los 18 certificados PDF y el documento con el perfil público proporcionados fuera del repositorio. La publicación selecciona seis credenciales pertinentes y resume las restantes por ruta formativa en `config/certifications.yml`; no copia certificados, folios ni archivos personales al repositorio. El enlace público de Google Skills se comprobó accesible. Los enlaces de verificación que no respondieron correctamente no se publican como evidencia.

## Controles automáticos

Las pruebas comprueban identidad, semestre, siete proyectos únicos, tecnologías mínimas, contenido sensible ausente, HTML en español, SEO, Schema.org, autoría, licencia pública, PDF, inventario de imágenes y publicación aislada en `dist/`.

Una prueba automatizada demuestra consistencia interna; no sustituye documentos académicos, constancias laborales, certificados ni la revisión humana de datos personales. Esos documentos deben conservarse fuera del repositorio público y presentarse únicamente cuando corresponda.
