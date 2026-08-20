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


def test_build_creates_a_clean_publication(project_root: Path, tmp_path: Path) -> None:
    output = Portfolio(root=project_root, output=tmp_path / "public").build()
    expected_files = {
        ".nojekyll",
        "404.html",
        "index.html",
        "robots.txt",
        "site.webmanifest",
        "sitemap.xml",
    }

    assert expected_files <= {path.name for path in output.iterdir()}
    html = (output / "index.html").read_text(encoding="utf-8")
    assert 'lang="es-MX"' in html
    assert "Generador de Expedientes de Entrevista" in html
    assert "Herramientas que ya he usado en proyectos" in html
    assert "David Vidal Ramírez" in html
    assert "fonts.googleapis.com" not in html
    assert "ionicons" not in html.lower()
    assert "< </ul>" not in html
    assert "&#34;@context&#34;" not in html
    assert '"@context":"https://schema.org"' in html

    manifest = json.loads((output / "site.webmanifest").read_text(encoding="utf-8"))
    assert manifest["lang"] == "es-MX"

    published_images = {
        path.relative_to(output / "assets").as_posix()
        for path in (output / "assets").rglob("*")
        if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
    }
    assert published_images == {
        "avatars/Foto_Infantil_David_Vidal_Ramirez.png",
        "logo.png",
        "projects/project-1.jpg",
    }
