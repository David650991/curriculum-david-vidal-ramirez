"""Carga y validación del contenido escrito en YAML."""

from pathlib import Path
from typing import Any

import yaml

CONFIG_FILES = ("profile", "about", "resume", "projects", "technologies", "iconography", "career", "contact", "navbar")


def load_yaml(config_dir: Path, name: str) -> dict[str, Any]:
    path = config_dir / f"{name}.yml"
    with path.open("r", encoding="utf-8") as file:
        data = yaml.safe_load(file)
    if not isinstance(data, dict):
        raise ValueError(f"{path} debe contener un objeto YAML.")
    return data


def load_content(config_dir: Path) -> dict[str, Any]:
    content = {name: load_yaml(config_dir, name) for name in CONFIG_FILES}
    projects = content["projects"].get("PROJECTS", [])
    if len(projects) != 7:
        raise ValueError("El portafolio debe documentar exactamente los siete proyectos actuales.")
    if len({project["slug"] for project in projects}) != len(projects):
        raise ValueError("Cada proyecto debe tener un identificador único.")
    return content
