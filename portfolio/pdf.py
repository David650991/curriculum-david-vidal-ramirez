"""Generación del CV en PDF tamaño carta a partir de la plantilla HTML/CSS e ilustración vectorial."""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import tempfile
import zlib
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parents[1]
PAGE_WIDTH, PAGE_HEIGHT = 612, 792
_PDF_CACHE: dict[str, bytes] = {}


def find_browser_executable() -> Path:
    """Localiza un binario de Chrome o Chromium compatible en Windows o Linux CI."""
    env_candidates = (
        os.environ.get("CHROME_BIN"),
        os.environ.get("CHROMIUM_BIN"),
        os.environ.get("GOOGLE_CHROME_SHIM"),
    )
    for candidate in env_candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)

    for binary_name in (
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "chrome",
    ):
        found = shutil.which(binary_name)
        if found:
            return Path(found)

    platform_paths = (
        Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
        Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
        Path.home() / "AppData/Local/Google/Chrome/Application/chrome.exe",
        Path("/usr/bin/google-chrome"),
        Path("/usr/bin/google-chrome-stable"),
        Path("/usr/bin/chromium"),
        Path("/usr/bin/chromium-browser"),
    )
    for path in platform_paths:
        if path.is_file():
            return path

    raise RuntimeError(
        "No se encontró Google Chrome o Chromium para exportar el CV a PDF."
    )


def render_cv_html(context: dict[str, Any], *, asset_prefix: str = "") -> str:
    """Renderiza el documento HTML imprimible del currículum completo."""
    env = Environment(
        loader=FileSystemLoader(str(ROOT / "src" / "jinja")),
        autoescape=select_autoescape(("html", "xml", "j2")),
    )
    template = env.get_template("cv.j2")
    render_context = {**context, "asset_prefix": asset_prefix}
    return template.render(**render_context)


def _inject_pdf_metadata(pdf_bytes: bytes) -> bytes:
    """Actualiza el diccionario /Info y recalcula la tabla xref conservando validez PDF 1.4."""
    match_obj1 = re.search(rb"1 0 obj\r?\n<<(.*?)>>\r?\nendobj", pdf_bytes, re.S)
    match_xref = re.search(
        rb"xref\r?\n0\s+(\d+)\r?\n((?:\d{10}\s+\d{5}\s+[nf]\s*\r?\n)+)"
        rb"trailer\r?\n(.*?)startxref\r?\n(\d+)\r?\n%%EOF",
        pdf_bytes,
        re.S,
    )
    if not match_obj1 or not match_xref:
        return pdf_bytes

    title_match = re.search(rb"/Title\s+<[0-9A-Fa-f]+>", match_obj1.group(1))
    title_entry = (
        title_match.group(0)
        if title_match
        else b"/Title (Curriculum profesional - David Vidal Ramirez)"
    )
    new_obj1 = (
        b"1 0 obj\n<<"
        + title_entry
        + b"\n/Author (David Vidal Ramirez)"
        + b"\n/Creator (David Vidal Ramirez)"
        + b"\n/Subject (Curriculum profesional - Desarrollo de software, proyectos y experiencia)"
        + b"\n/Producer (Skia/PDF)>>\nendobj"
    )
    old_start, old_end = match_obj1.span()
    delta = len(new_obj1) - (old_end - old_start)

    xref_start = match_xref.start()
    obj_count = match_xref.group(1)
    entries_raw = match_xref.group(2).splitlines()
    trailer_body = match_xref.group(3)

    updated_entries: list[bytes] = []
    for line in entries_raw:
        parts = line.strip().split()
        if len(parts) != 3:
            continue
        offset_val, gen_val, flag_val = int(parts[0]), parts[1], parts[2]
        if flag_val == b"n" and offset_val > old_start:
            offset_val += delta
        updated_entries.append(f"{offset_val:010d} ".encode() + gen_val + b" " + flag_val + b" \n")

    new_xref_offset = xref_start + delta
    new_xref_block = (
        b"xref\n0 "
        + obj_count
        + b"\n"
        + b"".join(updated_entries)
        + b"trailer\n"
        + trailer_body
        + b"startxref\n"
        + str(new_xref_offset).encode()
        + b"\n%%EOF\n"
    )
    return (
        pdf_bytes[:old_start]
        + new_obj1
        + pdf_bytes[old_end:xref_start]
        + new_xref_block
    )


def _decompress_stream(obj_str: str) -> bytes:
    """Extrae y descomprime el contenido de un objeto stream PDF."""
    stream_start = re.search(r"stream\r?\n", obj_str)
    length_match = re.search(r"/Length\s+(\d+)\b", obj_str)
    if not stream_start or not length_match:
        return b""
    length = int(length_match.group(1))
    raw = obj_str[stream_start.end() : stream_start.end() + length].encode("latin1")
    if "/FlateDecode" in obj_str:
        return zlib.decompress(raw)
    return raw


def _parse_pdf_objects(pdf_bytes: bytes) -> dict[int, str]:
    """Separa objetos PDF respetando la longitud de sus flujos binarios."""
    objects: dict[int, str] = {}
    for match in re.finditer(rb"(\d+)\s+0\s+obj\r?\n", pdf_bytes):
        obj_num = int(match.group(1))
        body_start = match.end()
        first_end = pdf_bytes.find(b"endobj", body_start)
        if first_end < 0:
            continue

        header = pdf_bytes[body_start : min(first_end, body_start + 4096)]
        stream_match = re.search(rb"stream\r?\n", header)
        length_match = re.search(rb"/Length\s+(\d+)\b", header)
        if stream_match and length_match:
            stream_end = body_start + stream_match.end() + int(length_match.group(1))
            object_end = pdf_bytes.find(b"endobj", stream_end)
        else:
            object_end = first_end
        if object_end < 0:
            continue
        objects[obj_num] = pdf_bytes[body_start:object_end].decode("latin1")
    return objects


def extract_pdf_pages_text(pdf_bytes: bytes) -> list[str]:
    """Extrae el texto Unicode de cada página física del PDF mediante tablas ToUnicode CMap."""
    objects = _parse_pdf_objects(pdf_bytes)

    cmaps: dict[int, dict[int, str]] = {}
    for obj_num, body in objects.items():
        raw = _decompress_stream(body)
        if b"begincmap" not in raw:
            continue
        cmap_str = raw.decode("latin1")
        mapping: dict[int, str] = {}
        for block in re.findall(r"beginbfchar(.*?)endbfchar", cmap_str, re.S):
            for match in re.finditer(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
                code = int(match.group(1), 16)
                char = bytes.fromhex(match.group(2)).decode("utf-16-be", errors="ignore")
                mapping[code] = char
        for block in re.findall(r"beginbfrange(.*?)endbfrange", cmap_str, re.S):
            for match in re.finditer(
                r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block
            ):
                start = int(match.group(1), 16)
                end = int(match.group(2), 16)
                dst = int(match.group(3), 16)
                for code in range(start, end + 1):
                    mapping[code] = chr(dst + (code - start))
            for match in re.finditer(
                r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*\[(.*?)\]", block, re.S
            ):
                start = int(match.group(1), 16)
                end = int(match.group(2), 16)
                values = re.findall(r"<([0-9A-Fa-f]+)>", match.group(3))
                for offset, value in enumerate(values[: end - start + 1]):
                    mapping[start + offset] = bytes.fromhex(value).decode(
                        "utf-16-be", errors="ignore"
                    )
        cmaps[obj_num] = mapping

    font_to_cmap: dict[int, dict[int, str]] = {}
    for obj_num, body in objects.items():
        match = re.search(r"/ToUnicode\s+(\d+)\s+0\s+R", body)
        if match:
            font_to_cmap[obj_num] = cmaps.get(int(match.group(1)), {})

    pages_text: list[str] = []
    page_objects = [
        body
        for _, body in sorted(objects.items())
        if re.search(r"/Type\s*/Page\b", body)
    ]
    for page_body in page_objects:
        fonts = {
            match.group(1): font_to_cmap.get(int(match.group(2)), {})
            for match in re.finditer(r"/(F\d+)\s+(\d+)\s+0\s+R", page_body)
        }
        content_match = re.search(r"/Contents\s+(\d+)\s+0\s+R", page_body)
        if not content_match:
            pages_text.append("")
            continue
        stream_str = _decompress_stream(objects[int(content_match.group(1))]).decode("latin1")
        current_cmap: dict[int, str] = {}
        chunks: list[str] = []
        for token in re.finditer(
            r"/(F\d+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>|\(([^)]*)\)|ET", stream_str
        ):
            if token.group(1):
                current_cmap = fonts.get(token.group(1), {})
            elif token.group(2):
                hex_str = token.group(2)
                chars = [
                    current_cmap.get(int(hex_str[i : i + 4], 16), "")
                    for i in range(0, len(hex_str), 4)
                ]
                chunks.append("".join(chars))
            elif token.group(3) is not None:
                chunks.append(token.group(3))
            else:
                chunks.append("\n")
        pages_text.append("".join(chunks))

    return pages_text


def create_cv_pdf(context: dict[str, Any], destination: Path) -> None:
    """Exporta el currículum completo en PDF tamaño carta mediante Chrome/Chromium headless."""
    asset_prefix = (ROOT / "src").as_uri() + "/"
    html_document = render_cv_html(context, asset_prefix=asset_prefix)
    cache_key = hashlib.sha256(html_document.encode("utf-8")).hexdigest()

    destination.parent.mkdir(parents=True, exist_ok=True)
    if cache_key in _PDF_CACHE:
        destination.write_bytes(_PDF_CACHE[cache_key])
        return

    browser = find_browser_executable()
    with tempfile.TemporaryDirectory(
        prefix="cv-pdf-", ignore_cleanup_errors=True
    ) as temp_dir:
        temp_path = Path(temp_dir)
        html_path = temp_path / "cv.html"
        raw_pdf_path = temp_path / "cv-raw.pdf"
        html_path.write_text(html_document, encoding="utf-8")

        subprocess.run(
            [
                str(browser),
                "--headless=new",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--no-pdf-header-footer",
                f"--print-to-pdf={raw_pdf_path}",
                html_path.as_uri(),
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
            timeout=60,
        )
        pdf_bytes = _inject_pdf_metadata(raw_pdf_path.read_bytes())
        _PDF_CACHE[cache_key] = pdf_bytes
        destination.write_bytes(pdf_bytes)
