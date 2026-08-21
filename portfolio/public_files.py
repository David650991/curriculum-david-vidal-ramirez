"""Archivos técnicos de indexación e instalación del sitio."""

import json
from pathlib import Path
from typing import Any


def write_public_files(output: Path, site: dict[str, Any], user: dict[str, Any]) -> None:
    base_url = site["url"].rstrip("/")
    (output / ".nojekyll").write_text("", encoding="utf-8")
    (output / "robots.txt").write_text(
        f"User-agent: *\nAllow: /\n\nSitemap: {base_url}/sitemap.xml\n",
        encoding="utf-8",
    )
    (output / "sitemap.xml").write_text(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        "<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n"
        f"  <url><loc>{base_url}/</loc></url>\n"
        "</urlset>\n",
        encoding="utf-8",
    )
    manifest = {
        "name": site["name"], "short_name": "CV David Vidal",
        "description": site["description"], "lang": "es-MX",
        "start_url": "./", "scope": "./", "display": "standalone",
        "background_color": "#07111f", "theme_color": "#0f3b60",
        "icons": [{"src": "assets/images/branding/app-icon.png", "sizes": "96x96", "type": "image/png"}],
    }
    (output / "site.webmanifest").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output / "humans.txt").write_text(
        "/* AUTOR */\n"
        f"Nombre: {site['creator']}\n"
        "Rol: Creador, diseñador, desarrollador y mantenedor\n"
        f"Contacto: {user['email']}\n"
        f"Repositorio: {site['repository']}\n\n"
        "/* SITIO */\n"
        "Tecnologías: Python, Jinja2, YAML, HTML, CSS y JavaScript\n"
        f"Idioma: {site['language']}\n"
        f"Licencia: {site['license']}\n",
        encoding="utf-8",
    )
