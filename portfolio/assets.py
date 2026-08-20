"""Preparación de los recursos que sí forman parte del sitio público."""

import shutil
from pathlib import Path

PUBLIC_IMAGES = (
    ("config/assets/avatars/Foto_Infantil_David_Vidal_Ramirez.png", "assets/avatars/Foto_Infantil_David_Vidal_Ramirez.png"),
    ("config/assets/projects/project-1.jpg", "assets/projects/project-1.jpg"),
    ("src/images/logo.png", "assets/logo.png"),
)

STYLE_MODULES = (
    "base.css", "navigation.css", "profile.css", "projects.css",
    "resume-contact.css", "responsive.css",
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

    js_target = output / "assets/js/script.js"
    js_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / "src/js/script.js", js_target)
