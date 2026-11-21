# Guía de actualización y contribución

Este es un portafolio personal. Las propuestas deben preservar la veracidad de la información, el idioma español, la accesibilidad y el rendimiento.

## Flujo mínimo

1. Modifica el contenido en `config/` o la presentación en `src/`.
2. No incluyas secretos, credenciales, datos de pacientes, expedientes ni identidades de prueba reales.
3. No atribuyas al autor tecnologías o resultados que no estén respaldados por los proyectos.
4. Mantén separadas las estadísticas de laboratorio y producción. Nunca copies datos locales a D1 remota ni actives `ANALYTICAS_ESCRITURA` como parte de una actualización ordinaria.
5. Si modificas el panel, conserva la diferencia entre una base vacía confirmada y una falla de red. Los datos inválidos no deben representarse como ceros.
6. Ejecuta `poetry run ruff check .`, `poetry run pytest -q`, `node --test tests/test_visitor_dashboard.mjs` y `poetry run python main.py`.
7. Comprueba con `node --check` cada módulo JavaScript modificado.
8. Revisa el resultado generado en `dist/`, incluido el PDF, antes de solicitar su publicación.

Las capturas de proyectos deben ocultar información privada y representar el producto real; no se aceptan imágenes genéricas presentadas como evidencia.

Los cambios en el Worker, el esquema D1 o sus migraciones requieren pruebas locales aisladas. No se prueban escrituras contra producción y las migraciones históricas no se aplican a una base nueva creada con `d1-schema.sql`.
