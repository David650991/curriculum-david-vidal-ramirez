import json
from pathlib import Path

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
    for project in projects:
        assert project["architecture"]
        assert project["aspects"]
        assert project["categories"]


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
    assert 'rel="preload"' in html
    assert "Descargar CV" in html
    assert 'type="module"' in html
    assert "15 de junio de 1991" not in html
    for sensitive_label in ("NSS:", "CURP:", "Registro Patronal", "Salario Base"):
        assert sensitive_label not in html

    manifest = json.loads((output / "site.webmanifest").read_text(encoding="utf-8"))
    assert manifest["lang"] == "es-MX"
    assert manifest["theme_color"] == "#751182"

    published_images = {
        path.relative_to(output / "assets").as_posix()
        for path in (output / "assets").rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    }
    assert {
        "avatars/Foto_Infantil_David_Vidal_Ramirez.png",
        "logo.png",
        "projects/project-1.jpg",
    } == published_images
    published_icons = list((output / "assets/icons").rglob("*.svg"))
    assert len(published_icons) >= 35
    assert sum(path.stat().st_size for path in published_icons) < 60_000
    assert "assets/icons/brands/whatsapp.svg" in html
    assert "assets/icons/functional/mail.svg" in html
    assert html.count('class="ecosystem-card"') == 8
    assert 'class="logo-grid"' not in html
    context = Portfolio(root=project_root).context()
    pdf = output / "assets" / "cv-david-vidal-ramirez.pdf"
    assert pdf.read_bytes().startswith(b"%PDF-1.4")
    assert pdf.stat().st_size > 5_000
    pdf_content = pdf.read_bytes()
    assert b"/Count 3" in pdf_content
    for group in context["resume"]["EARLIER_EXPERIENCE"]["groups"]:
        assert group["title"].encode("cp1252") in pdf_content
    expected_javascript = {
        "script.js",
        "modules/navigation.js",
        "modules/neural-network.js",
        "modules/pointer-glow.js",
        "modules/project-filters.js",
    }
    published_javascript = {
        path.relative_to(output / "assets/js").as_posix()
        for path in (output / "assets/js").rglob("*.js")
    }
    assert published_javascript == expected_javascript
    responsive_css = (project_root / "src/css/responsive.css").read_text(encoding="utf-8")
    for breakpoint in ("1180px", "1020px", "840px", "760px", "600px", "480px", "360px"):
        assert f"max-width: {breakpoint}" in responsive_css
