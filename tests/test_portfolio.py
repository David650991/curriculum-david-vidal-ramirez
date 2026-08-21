import json
import re
from html import unescape
from pathlib import Path
from urllib.parse import urlsplit

import pytest

from main import Portfolio


@pytest.fixture
def project_root() -> Path:
    return Path(__file__).parents[1]


def test_professional_content_is_complete(project_root: Path) -> None:
    context = Portfolio(root=project_root).context()
    projects = context["projects"]["PROJECTS"]

    assert len(projects) == 7
    assert len({project["slug"] for project in projects}) == 7
    assert context["profile"]["USER"]["institutional_email"] == "L25350801@tuxtepec.tecnm.mx"
    assert context["profile"]["SITE"]["creator"] == "David Vidal Ramírez"
    education = context["resume"]["EDUCATION"]["items"][0]
    assert education["period"] == "En curso · 3.er semestre"
    technology_names = {
        name
        for group in context["technologies"]["GROUPS"]
        for name in group["items"]
    }
    assert {"Python", "JavaScript", "Flask", "Cloudflare D1", "OpenCV"} <= technology_names
    assert {"Flask-Login", "Socket.IO", "Service Worker", "face_recognition", "Morgan"} <= technology_names
    assert len(context["iconography"]["ECOSYSTEMS"]) == 8
    employment_records = context["resume"]["EARLIER_EXPERIENCE"]["records"]
    assert len(employment_records) == 17
    assert len({record["employer"] for record in employment_records}) == 16
    assert sum(record["employer"] == "Eulen México" for record in employment_records) == 2
    assert employment_records[0]["period"] == "4 abr 2022 — 19 may 2022"
    assert employment_records[-1]["period"] == "1 dic 2009 — 23 abr 2010"
    for project in projects:
        assert project["architecture"]
        assert project["aspects"]
        assert project["categories"]
    auth_practice = next(project for project in projects if project["slug"] == "auth-practice")
    assert auth_practice["repository_url"] is None
    assert "no publicado" in auth_practice["note"].lower()


def test_build_creates_a_clean_publication(project_root: Path, tmp_path: Path) -> None:
    output = Portfolio(root=project_root, output=tmp_path / "public").build()
    expected_files = {
        ".nojekyll",
        "404.html",
        "index.html",
        "cv.html",
        "robots.txt",
        "site.webmanifest",
        "sitemap.xml",
        "humans.txt",
        "LICENSE.txt",
    }

    assert expected_files <= {path.name for path in output.iterdir()}
    html = (output / "index.html").read_text(encoding="utf-8")
    assert 'lang="es-MX"' in html
    assert "Generador de Expedientes de Entrevista" in html
    assert "Mapa de mi stack tecnológico" in html
    assert "Mi aportación" in html
    assert "Problema" in html
    assert "Solución" in html
    assert html.count('class="project-case"') == 7
    assert html.count('data-status=') == 7
    assert "Retos y alcance actual" in html
    assert "David Vidal Ramírez" in html
    assert "Diseñado, desarrollado y mantenido por David Vidal Ramírez" in html
    assert '<meta name="creator" content="David Vidal Ramírez">' in html
    assert "Nivel y evidencia por proyecto" in html
    assert "Inventario técnico completo" in html
    assert "Datos y persistencia" in html
    assert "Arquitecturas y conceptos trabajados" in html
    assert "Google Search Console" in html
    assert "Control optimista de concurrencia" in html
    assert "Repositorio no publicado actualmente" in html
    assert "github.com/David650991/auth-practice" not in html
    assert "fonts.googleapis.com" not in html
    assert "ionicons" not in html.lower()
    assert "< </ul>" not in html
    assert "&#34;@context&#34;" not in html
    assert '"@context":"https://schema.org"' in html
    for obsolete_label in (">About<", ">Resume<", ">Portfolio<", ">Blog<", ">Contact<"):
        assert obsolete_label not in html
    assert 'title="Mapa de Tres Valles, Veracruz"' in html
    assert 'data-map-source=' in html
    assert 'loading="lazy"' in html
    assert "openstreetmap.org/export/embed.html" in html
    assert "Cargar mapa interactivo" in html
    assert 'data-map-location' in html
    assert 'data-map-directions' in html
    assert 'data-map-zoom="17"' in html
    assert 'rel="preload"' in html
    assert "Descargar CV" in html
    assert 'type="module"' in html
    assert "15 de junio de 1991" not in html
    for sensitive_label in ("NSS:", "CURP:", "Registro Patronal", "Salario Base"):
        assert sensitive_label not in html

    manifest = json.loads((output / "site.webmanifest").read_text(encoding="utf-8"))
    assert manifest["lang"] == "es-MX"
    assert manifest["theme_color"] == "#0f3b60"
    humans = (output / "humans.txt").read_text(encoding="utf-8")
    assert "Nombre: David Vidal Ramírez" in humans
    assert "Rol: Creador, diseñador, desarrollador y mantenedor" in humans
    license_text = (output / "LICENSE.txt").read_text(encoding="utf-8")
    assert "Copyright (c) 2025-2026 David Vidal Ramírez" in license_text

    published_images = {
        path.relative_to(output / "assets").as_posix()
        for path in (output / "assets").rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    }
    assert {
        "images/profile/david-vidal-ramirez.png",
        "images/branding/app-icon.png",
        "images/projects/centro-rehabilitacion-la-luz-esperanza.jpg",
        "images/projects/generador-expedientes-entrevista-conceptual.jpg",
        "images/projects/auth-practice-seguridad-conceptual.jpg",
        "images/projects/visionlab-vision-computacional-conceptual.jpg",
        "images/projects/grid-chat-tiempo-real-conceptual.jpg",
        "images/projects/david-vidal-it-server-arm64-conceptual.jpg",
        "images/projects/curriculum-portafolio-ci-cd-conceptual.jpg",
        "icons/brands/microsoft-outlook.png",
        "icons/brands/google-maps.webp",
        "icons/brands/gmail.webp",
    } == published_images
    published_icons = list((output / "assets/icons").rglob("*.svg"))
    assert len(published_icons) >= 35
    assert sum(path.stat().st_size for path in published_icons) < 60_000
    assert not list((output / "assets/icons").rglob("*.md"))
    assert "assets/icons/brands/whatsapp.svg" in html
    assert "assets/icons/brands/gmail.webp" in html
    assert "assets/icons/brands/google-maps.webp" in html
    assert '<img class="image-icon profile-data-icon" src="assets/icons/brands/google-maps.webp"' in html
    assert '<img class="image-icon technology-icon tech-chip__icon" src="assets/icons/technologies/python.svg"' in html
    assert "assets/icons/technologies/javascript.svg" in html
    assert "assets/icons/technologies/python.svg" in html
    assert "assets/icons/technologies/opencv.svg" in html
    assert '<img class="image-icon social-link__icon" src="assets/icons/brands/gitlab.svg"' in html
    assert '<img class="image-icon technology-icon tech-chip__icon" src="assets/icons/technologies/firebase.svg"' in html
    assert '<img class="image-icon profile-role-logo" src="assets/icons/technologies/opencv.svg"' in html
    assert '<img class="image-icon action-icon" src="assets/icons/brands/gmail.webp"' in html
    assert "assets/icons/functional/mail.svg" in html
    assert html.count('class="ecosystem-card"') == 8
    assert 'class="logo-grid"' not in html
    assert "Representación conceptual anonimizada" in html
    context = Portfolio(root=project_root).context()
    pdf = output / "assets" / "cv-david-vidal-ramirez.pdf"
    assert pdf.read_bytes().startswith(b"%PDF-1.4")
    assert pdf.stat().st_size > 5_000
    pdf_content = pdf.read_bytes()
    assert b"/Count 3" in pdf_content
    assert b"/Author (David Vidal Ramirez)" in pdf_content
    assert b"/Creator (David Vidal Ramirez)" in pdf_content
    for record in context["resume"]["EARLIER_EXPERIENCE"]["records"]:
        assert record["employer"].encode("cp1252") in pdf_content
    for certificate in context["certifications"]["FEATURED"][:2]:
        assert certificate["title"].encode("cp1252") in pdf_content
    expected_javascript = {
        "script.js",
        "modules/navigation.js",
        "modules/map-controls.js",
        "modules/neural-network.js",
        "modules/pointer-glow.js",
        "modules/project-filters.js",
    }
    published_javascript = {
        path.relative_to(output / "assets/js").as_posix()
        for path in (output / "assets/js").rglob("*.js")
    }
    assert published_javascript == expected_javascript
    navigation_js = (output / "assets/js/modules/navigation.js").read_text(encoding="utf-8")
    assert "requestIdleCallback(loadMap" not in navigation_js
    assert "[data-map-load]" in navigation_js
    map_controls_js = (output / "assets/js/modules/map-controls.js").read_text(encoding="utf-8")
    assert "navigator.geolocation.getCurrentPosition" in map_controls_js
    assert "travelmode" in map_controls_js
    responsive_css = (project_root / "src/css/responsive.css").read_text(encoding="utf-8")
    for breakpoint in ("1180px", "1020px", "840px", "760px", "600px", "480px", "360px"):
        assert f"max-width: {breakpoint}" in responsive_css


def test_all_professional_content_is_published(project_root: Path, tmp_path: Path) -> None:
    portfolio = Portfolio(root=project_root, output=tmp_path / "public")
    context = portfolio.context()
    output = portfolio.build()
    rendered = unescape((output / "index.html").read_text(encoding="utf-8"))

    profile = context["profile"]
    for value in (
        profile["USER"]["name"],
        profile["USER"]["role"],
        profile["USER"]["academic_status"],
        profile["USER"]["email"],
        profile["USER"]["institutional_email"],
        profile["USER"]["phone_display"],
        profile["USER"]["location"],
    ):
        assert value in rendered

    about = context["about"]
    for value in (
        about["PRESENTATION"]["lead"],
        *about["PRESENTATION"]["paragraphs"],
        *about["STRENGTHS"]["items"],
    ):
        assert value in rendered
    for group in about["STACK"]["groups"]:
        assert group["title"] in rendered
        assert all(item in rendered for item in group["items"])
        assert all(item in context["iconography"]["TECHNOLOGIES"] for item in group["items"])

    resume = context["resume"]
    for item in resume["EDUCATION"]["items"]:
        assert all(str(value) in rendered for value in item.values())
    for item in resume["EXPERIENCE"]["items"]:
        assert item["period"] in rendered
        assert item["position"] in rendered
        assert item["organization"] in rendered
        assert all(bullet in rendered for bullet in item["bullets"])
    for item in resume["EARLIER_EXPERIENCE"]["records"]:
        assert all(value in rendered for value in item.values())

    for project in context["projects"]["PROJECTS"]:
        for field in ("title", "category", "status", "summary", "problem", "contribution", "operation", "scope", "aspects"):
            assert project[field] in rendered
        for field in ("highlights", "architecture", "stack"):
            assert all(value in rendered for value in project[field])
        if project.get("note"):
            assert project["note"] in rendered

    technologies = context["technologies"]
    for level in technologies["LEVELS"]:
        assert level["level"] in rendered
        assert level["description"] in rendered
        for item in level["items"]:
            assert item["name"] in rendered
            assert item["evidence"] in rendered
    for group in technologies["GROUPS"]:
        assert group["title"] in rendered
        assert all(item in rendered for item in group["items"])

    career = context["career"]
    assert all(item in rendered for item in career["INTERESTS"]["items"])
    assert all(item in rendered for item in career["DELIVERY"]["items"])
    assert all(item in rendered for item in career["CONCEPTS"]["items"])
    for item in career["DATABASES"]["items"]:
        assert item["name"] in rendered
        assert item["use"] in rendered

    certifications = context["certifications"]
    assert len(certifications["FEATURED"]) == 6
    assert sum(len(path["items"]) for path in certifications["PATHS"]) == 12
    for item in certifications["FEATURED"]:
        for value in item.values():
            if value is not None:
                assert str(value) in rendered
    for path in certifications["PATHS"]:
        assert path["title"] in rendered
        assert path["summary"] in rendered
        assert all(item in rendered for item in path["items"])
    assert certifications["PUBLIC_PROFILE"]["url"] in rendered
    assert rendered.count('class="certification-card"') == 6
    assert "Certificaciones/" not in rendered

    for match in re.finditer(r'(?:href|src)="([^"]+)"', rendered):
        reference = match.group(1)
        if reference.startswith(("http://", "https://", "mailto:", "tel:", "#")):
            continue
        local_path = urlsplit(reference).path
        assert (output / local_path).is_file(), f"Referencia local rota: {reference}"
