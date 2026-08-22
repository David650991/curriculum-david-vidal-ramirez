"""Preparación de los recursos que sí forman parte del sitio público."""

import shutil
from pathlib import Path

PUBLIC_IMAGES = (
    ("src/assets/images/profile/david-vidal-ramirez.png", "assets/images/profile/david-vidal-ramirez.png"),
    (
        "src/assets/images/branding/project-logos/grid-chat-logo.png",
        "assets/images/branding/project-logos/grid-chat-logo.png",
    ),
    (
        "src/assets/images/projects/generador-expedientes-entrevista-conceptual.jpg",
        "assets/images/projects/generador-expedientes-entrevista-conceptual.jpg",
    ),
    (
        "src/assets/images/projects/auth-practice-seguridad-conceptual.jpg",
        "assets/images/projects/auth-practice-seguridad-conceptual.jpg",
    ),
    (
        "src/assets/images/projects/visionlab-vision-computacional-conceptual.jpg",
        "assets/images/projects/visionlab-vision-computacional-conceptual.jpg",
    ),
    (
        "src/assets/images/projects/grid-chat-tiempo-real-conceptual.jpg",
        "assets/images/projects/grid-chat-tiempo-real-conceptual.jpg",
    ),
    (
        "src/assets/images/projects/david-vidal-it-server-arm64-conceptual.jpg",
        "assets/images/projects/david-vidal-it-server-arm64-conceptual.jpg",
    ),
    (
        "src/assets/images/projects/curriculum-portafolio-ci-cd-conceptual.jpg",
        "assets/images/projects/curriculum-portafolio-ci-cd-conceptual.jpg",
    ),
    (
        "src/assets/images/projects/centro-rehabilitacion-la-luz-esperanza.jpg",
        "assets/images/projects/centro-rehabilitacion-la-luz-esperanza.jpg",
    ),
    ("src/assets/images/branding/app-icon.png", "assets/images/branding/app-icon.png"),
)

STYLE_MODULES = (
    "base.css", "navigation.css", "profile.css", "projects.css",
    "certifications.css", "resume-contact.css", "responsive.css",
)


def copy_public_assets(root: Path, output: Path) -> None:
    for source, destination in PUBLIC_IMAGES:
        target = output / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / source, target)

    css_target = output / "assets/css/style.css"
    css_target.parent.mkdir(parents=True, exist_ok=True)
    css = "\n".join(
        (root / "src/css" / module).read_text(encoding="utf-8").strip()
        for module in STYLE_MODULES
    )
    css_target.write_text(f"{css}\n", encoding="utf-8")

    js_source = root / "src/js"
    js_target = output / "assets/js"
    shutil.copytree(js_source, js_target, dirs_exist_ok=True)

    icon_source = root / "src/assets/icons"
    icon_target = output / "assets/icons"
    shutil.copytree(
        icon_source,
        icon_target,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns("*.md"),
    )
    shutil.copy2(root / "LICENSE", output / "LICENSE.txt")
