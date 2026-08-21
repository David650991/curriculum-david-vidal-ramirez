"""Orquestación de la compilación del portafolio."""

import json
import shutil
from datetime import date, datetime
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from .assets import copy_public_assets
from .content import load_content
from .pdf import create_cv_pdf
from .public_files import write_public_files


class Portfolio:
    """Genera el sitio estático a partir de contenido YAML validado."""

    def __init__(self, root: Path | str | None = None, output: Path | str = "dist"):
        self.root = Path(root or Path(__file__).parents[1]).resolve()
        self.output = (self.root / output).resolve()
        self.config_dir = self.root / "config"
        self.env = Environment(
            loader=FileSystemLoader(self.root / "src/jinja"),
            autoescape=select_autoescape(("html", "j2", "xml")),
            undefined=StrictUndefined,
            trim_blocks=True,
            lstrip_blocks=True,
        )
        self.env.filters["format_date"] = self.format_date
        self.env.filters["json"] = lambda value: json.dumps(
            value, ensure_ascii=False, separators=(",", ":")
        )

    @staticmethod
    def format_date(value: str) -> str:
        months = (
            "enero", "febrero", "marzo", "abril", "mayo", "junio",
            "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
        )
        parsed = datetime.strptime(value, "%Y-%m-%d")
        return f"{parsed.day} de {months[parsed.month - 1]} de {parsed.year}"

    def context(self) -> dict[str, Any]:
        context = load_content(self.config_dir)
        context["build"] = {"year": date.today().year}
        return context

    def render(self, template: str, destination: str, context: dict[str, Any]) -> None:
        target = self.output / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(self.env.get_template(template).render(context), encoding="utf-8")

    def build(self) -> Path:
        context = self.context()
        if self.output.exists():
            shutil.rmtree(self.output)
        self.output.mkdir(parents=True)
        copy_public_assets(self.root, self.output)
        self.render("index.j2", "index.html", context)
        self.render("404.j2", "404.html", context)
        self.render("cv.j2", "cv.html", context)
        create_cv_pdf(context, self.output / "assets" / "cv-david-vidal-ramirez.pdf")
        write_public_files(
            self.output,
            context["profile"]["SITE"],
            context["profile"]["USER"],
        )
        return self.output
