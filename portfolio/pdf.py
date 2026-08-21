"""Generación de un CV PDF A4, seleccionable y compatible con ATS."""

import struct
import zlib
from pathlib import Path
from textwrap import wrap
from typing import Any

PAGE_WIDTH, PAGE_HEIGHT = 595, 842
LEFT, RIGHT = 42, 42
PRIMARY = "0.145 0.388 0.922"
PRIMARY_DARK = "0.059 0.231 0.376"
TEXT = "0.075 0.086 0.110"
MUTED = "0.310 0.349 0.416"
LINE = "0.800 0.855 0.925"
WATERMARK = "0.855 0.918 0.980"
WATERMARK_NODE = "0.220 0.740 0.973"


def _escape(text: str) -> bytes:
    safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return safe.encode("cp1252", errors="replace")


class PdfPage:
    """Compone una página mediante primitivas PDF y texto WinAnsi."""

    def __init__(self, number: int, title: str, subtitle: str) -> None:
        self.number = number
        self.section_number = 0
        self.commands: list[bytes] = []
        self.y = 700
        self._neural_watermark()
        self._line(28, 48, 28, 756, "0.902 0.843 0.914", .55)
        self._text("CV // 2026", PAGE_WIDTH - 91, 806, 7, bold=True, color=PRIMARY, technical=True)
        if number == 1:
            self.commands.append(b"q 62 0 0 69 42 742 cm /Im1 Do Q")
            self.commands.append(f"q {PRIMARY} RG 1.2 w 42 742 62 69 re S Q".encode())
            self.commands.append(f"q {PRIMARY_DARK} RG .45 w 38 738 70 77 re S Q".encode())
            title_x = LEFT + 78
        else:
            self._rectangle(LEFT, 753, 46, 46, PRIMARY)
            self._text(f"{number:02d}", LEFT + 13, 769, 13, bold=True, color="1 1 1")
            title_x = LEFT + 62
        self._text(title, title_x, 791, 21, bold=True, color=TEXT)
        self._text(subtitle, title_x, 768, 8, bold=True, color=PRIMARY_DARK, technical=True)
        self._line(LEFT, 728, LEFT + 68, 728, PRIMARY, 1.6)
        self._line(LEFT + 72, 728, PAGE_WIDTH - RIGHT, 728, LINE, .55)

    def _text(
        self, text: str, x: float, y: float, size: int, *, bold: bool = False,
        color: str = TEXT, technical: bool = False,
    ) -> None:
        font = (4 if bold else 3) if technical else (2 if bold else 1)
        self.commands.extend((
            b"BT",
            f"{color} rg /F{font} {size} Tf 1 0 0 1 {x:.1f} {y:.1f} Tm".encode(),
            b"(" + _escape(text) + b") Tj",
            b"ET",
        ))

    def _center_text(
        self, text: str, y: float, size: int, *, bold: bool = False,
        color: str = TEXT, technical: bool = False,
    ) -> None:
        average_width = .54 if technical else .5
        estimated_width = len(text) * size * average_width
        self._text(
            text, (PAGE_WIDTH - estimated_width) / 2, y, size,
            bold=bold, color=color, technical=technical,
        )

    def _line(self, x1: float, y1: float, x2: float, y2: float, color: str, width: float) -> None:
        self.commands.append(f"q {color} RG {width} w {x1} {y1} m {x2} {y2} l S Q".encode())

    def _rectangle(self, x: float, y: float, width: float, height: float, color: str) -> None:
        self.commands.append(f"q {color} rg {x} {y} {width} {height} re f Q".encode())

    def _circle(self, x: float, y: float, radius: float, color: str, *, fill: bool = True) -> None:
        factor = radius * .5522848
        operation = "f" if fill else "S"
        mode = "rg" if fill else "RG"
        self.commands.append(
            f"q {color} {mode} {x + radius:.2f} {y:.2f} m "
            f"{x + radius:.2f} {y + factor:.2f} {x + factor:.2f} {y + radius:.2f} {x:.2f} {y + radius:.2f} c "
            f"{x - factor:.2f} {y + radius:.2f} {x - radius:.2f} {y + factor:.2f} {x - radius:.2f} {y:.2f} c "
            f"{x - radius:.2f} {y - factor:.2f} {x - factor:.2f} {y - radius:.2f} {x:.2f} {y - radius:.2f} c "
            f"{x + factor:.2f} {y - radius:.2f} {x + radius:.2f} {y - factor:.2f} {x + radius:.2f} {y:.2f} c {operation} Q".encode()
        )

    def _neural_watermark(self) -> None:
        nodes = ((407, 61), (449, 91), (492, 58), (526, 111), (558, 76), (475, 142), (548, 157))
        links = ((0, 1), (0, 2), (1, 2), (1, 5), (2, 3), (2, 4), (3, 4), (3, 5), (3, 6), (5, 6))
        for first, second in links:
            x1, y1 = nodes[first]
            x2, y2 = nodes[second]
            self._line(x1, y1, x2, y2, WATERMARK, .65)
        for index, (x, y) in enumerate(nodes):
            self._circle(x, y, 2.4 if index in (1, 3, 5) else 1.7, WATERMARK_NODE, fill=False)
            self._circle(x, y, .8, WATERMARK_NODE)

    def space(self, points: int = 6) -> None:
        self.y -= points

    def heading(self, text: str) -> None:
        self.section_number += 1
        self.space(5)
        self._text(f"{self.section_number:02d} /", LEFT, self.y, 8, bold=True, color=PRIMARY, technical=True)
        self._text(text.upper(), LEFT + 35, self.y, 9, bold=True, color=PRIMARY_DARK)
        self._line(LEFT, self.y - 6, LEFT + 30, self.y - 6, PRIMARY, 1.2)
        self._line(LEFT + 35, self.y - 6, PAGE_WIDTH - RIGHT, self.y - 6, LINE, .45)
        self.y -= 19

    def role(self, title: str, meta: str) -> None:
        self._line(LEFT, self.y + 3, LEFT, self.y - 18, PRIMARY, 1.4)
        self._text(title, LEFT + 10, self.y, 9, bold=True)
        self._text(meta, LEFT + 10, self.y - 13, 8, color=MUTED)
        self.y -= 27

    def paragraph(self, text: str, *, size: int = 8, color: str = MUTED, indent: int = 0, width: int | None = None, after: int = 7) -> None:
        available = PAGE_WIDTH - LEFT - RIGHT - indent
        line_width = width or max(50, int(available / size * 1.75))
        for line in wrap(text, width=line_width, break_long_words=False, break_on_hyphens=False):
            self._text(line, LEFT + indent, self.y, size, color=color)
            self.y -= size + 4
        self.y -= after

    def bullet(self, text: str) -> None:
        lines = wrap(text, width=101, break_long_words=False, break_on_hyphens=False)
        for index, line in enumerate(lines):
            if index == 0:
                self._text("•", LEFT + 5, self.y, 8, bold=True, color=PRIMARY_DARK)
            self._text(line, LEFT + 17, self.y, 8, color=MUTED)
            self.y -= 11
        self.y -= 2

    def compact_item(
        self, title: str, description: str, detail: str | None = None,
        *, detail_after: int = 5,
    ) -> None:
        self._line(LEFT, self.y + 3, LEFT, self.y - 10, PRIMARY, 1.2)
        self._text(title, LEFT + 9, self.y, 8, bold=True)
        self.y -= 12
        self.paragraph(description, size=8, indent=9, after=2)
        if detail:
            self.paragraph(detail, size=7, color=MUTED, indent=9, after=detail_after)

    def history_item(self, employer: str, period: str, location: str, role: str | None = None) -> None:
        """Añade un registro laboral compacto sin inventar un cargo."""
        self._line(LEFT, self.y + 2, LEFT, self.y - 7, PRIMARY, 1.1)
        self._text(employer, LEFT + 8, self.y, 7, bold=True)
        self.y -= 10
        detail = f"{period} · {location}"
        if role:
            detail += f" · {role}"
        self.paragraph(detail, size=6, color=MUTED, indent=8, after=2)

    def finish(self) -> bytes:
        self._line(LEFT, 38, PAGE_WIDTH - RIGHT, 38, LINE, .6)
        self._center_text(
            "David Vidal Ramírez · Currículum profesional", 24, 7,
            bold=True, color=MUTED,
        )
        self._text(f"{self.number:02d} / 03", PAGE_WIDTH - 78, 24, 7, bold=True, color=PRIMARY, technical=True)
        if self.y < 44:
            raise ValueError(f"El contenido del CV desborda la página {self.number}")
        return b"\n".join(self.commands)


def _build_first_page(context: dict[str, Any]) -> bytes:
    profile = context["profile"]["USER"]
    resume = context["resume"]
    about = context["about"]
    page = PdfPage(1, profile["name"], "Desarrollador de Software · Python · JavaScript · Aplicaciones Web")
    page.paragraph(f"{profile['location']}  |  {profile['phone_display']}", size=8, color=TEXT, after=1)
    page.paragraph(
        f"{profile['email']}  |  {profile['institutional_email']}", size=8, color=MUTED, after=7,
    )
    page.heading("Perfil profesional")
    page.paragraph(about["PRESENTATION"]["lead"] + " " + " ".join(about["PRESENTATION"]["paragraphs"]), size=8)
    page.heading("Objetivo profesional")
    page.paragraph(resume["OBJECTIVE"]["text"], size=8)
    page.heading("Experiencia reciente")
    for item in resume["EXPERIENCE"]["items"]:
        page.role(item["position"], f"{item['organization']} · {item['period']}")
        for bullet in item["bullets"]:
            page.bullet(bullet)
        page.space(3)
    page.heading("Formación académica")
    for item in resume["EDUCATION"]["items"]:
        page.compact_item(item["institution"], f"{item['period']} · {item['description']}", item["detail"])
    return page.finish()


def _build_second_page(context: dict[str, Any]) -> bytes:
    resume = context["resume"]
    certifications = context["certifications"]
    page = PdfPage(2, "Trayectoria y formación", "Periodos registrados · Certificaciones seleccionadas")
    page.heading("Historial laboral registrado ante el IMSS")
    for item in resume["EARLIER_EXPERIENCE"]["records"]:
        page.history_item(item["employer"], item["period"], item["location"], item.get("role"))
    page.heading("Certificaciones seleccionadas")
    for item in certifications["FEATURED"][:2]:
        page.compact_item(
            f"{item['title']} · {item['date']}", item["institution"], item["credential"],
            detail_after=3,
        )
    return page.finish()


def _build_third_page(context: dict[str, Any]) -> bytes:
    projects = sorted(context["projects"]["PROJECTS"], key=lambda item: item["priority"])
    profile = context["profile"]
    resume = context["resume"]
    about = context["about"]
    page = PdfPage(3, "Proyectos y tecnologías", "Evidencia técnica · Estado verificable · Herramientas aplicadas")
    page.heading("Proyectos")
    for item in projects:
        page.compact_item(
            f"{item['title']} · {item['status']}", item["summary"],
            "Tecnologías: " + ", ".join(item["stack"][:8]),
        )
    page.heading("Tecnologías por nivel de experiencia")
    for group in context["technologies"]["LEVELS"]:
        names = ", ".join(item["name"] for item in group["items"])
        page.paragraph(f"{group['level']}: {names}", size=8, color=TEXT, after=4)
    page.heading("Fortalezas e idiomas")
    page.paragraph(" · ".join(about["STRENGTHS"]["items"]), size=8, color=TEXT, after=4)
    languages = " · ".join(f"{item['language']}: {item['level']}" for item in resume["LANGUAGES"]["items"])
    page.paragraph(languages, size=8, color=TEXT)
    page.heading("Enlaces profesionales")
    page.paragraph(profile["SITE"]["url"], size=8, color=PRIMARY_DARK, after=1)
    page.paragraph(" · ".join(f"{item['label']}: {item['url']}" for item in profile["SOCIAL"]), size=7, after=1)
    return page.finish()


def _png_rgb_xobject(path: Path) -> bytes:
    """Convierte un PNG RGBA de 8 bits en una imagen RGB Flate para PDF."""
    source = path.read_bytes()
    if not source.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("La fotografía del CV debe ser un archivo PNG válido")
    position = 8
    width = height = color_type = 0
    compressed = bytearray()
    while position < len(source):
        length = struct.unpack(">I", source[position:position + 4])[0]
        kind = source[position + 4:position + 8]
        data = source[position + 8:position + 8 + length]
        position += length + 12
        if kind == b"IHDR":
            width, height, depth, color_type = struct.unpack(">IIBB", data[:10])
            if depth != 8 or color_type not in (2, 6):
                raise ValueError("La fotografía requiere PNG RGB o RGBA de 8 bits")
        elif kind == b"IDAT":
            compressed.extend(data)
        elif kind == b"IEND":
            break
    channels = 4 if color_type == 6 else 3
    stride = width * channels
    decoded = zlib.decompress(bytes(compressed))
    rows: list[bytearray] = []
    offset = 0
    previous = bytearray(stride)
    for _ in range(height):
        filter_type = decoded[offset]
        offset += 1
        raw = decoded[offset:offset + stride]
        offset += stride
        row = bytearray(stride)
        for index, value in enumerate(raw):
            left = row[index - channels] if index >= channels else 0
            above = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_type == 0:
                predictor = 0
            elif filter_type == 1:
                predictor = left
            elif filter_type == 2:
                predictor = above
            elif filter_type == 3:
                predictor = (left + above) // 2
            elif filter_type == 4:
                estimate = left + above - upper_left
                distances = (abs(estimate - left), abs(estimate - above), abs(estimate - upper_left))
                predictor = (left, above, upper_left)[distances.index(min(distances))]
            else:
                raise ValueError("Filtro PNG no compatible")
            row[index] = (value + predictor) & 255
        rows.append(row)
        previous = row
    rgb = bytearray()
    for row in rows:
        for index in range(0, len(row), channels):
            if channels == 3:
                rgb.extend(row[index:index + 3])
                continue
            red, green, blue, alpha = row[index:index + 4]
            rgb.extend((
                (red * alpha + 255 * (255 - alpha)) // 255,
                (green * alpha + 255 * (255 - alpha)) // 255,
                (blue * alpha + 255 * (255 - alpha)) // 255,
            ))
    image = zlib.compress(bytes(rgb), 9)
    return (
        f"<< /Type /XObject /Subtype /Image /Width {width} /Height {height} "
        f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length {len(image)} >>\n"
    ).encode() + b"stream\n" + image + b"\nendstream"


def create_cv_pdf(context: dict[str, Any], destination: Path) -> None:
    """Escribe un PDF de tres páginas sin dependencias binarias externas."""
    streams = [_build_first_page(context), _build_second_page(context), _build_third_page(context)]
    avatar = destination.parent / context["profile"]["USER"]["avatar"].removeprefix("assets/")
    objects: list[bytes] = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [5 0 R 7 0 R 9 0 R] /Count 3 >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 12 0 R /F4 13 0 R >> /XObject << /Im1 11 0 R >> >> /Contents 6 0 R >>",
        b"<< /Length " + str(len(streams[0])).encode() + b" >>\nstream\n" + streams[0] + b"\nendstream",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 12 0 R /F4 13 0 R >> /XObject << /Im1 11 0 R >> >> /Contents 8 0 R >>",
        b"<< /Length " + str(len(streams[1])).encode() + b" >>\nstream\n" + streams[1] + b"\nendstream",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 12 0 R /F4 13 0 R >> /XObject << /Im1 11 0 R >> >> /Contents 10 0 R >>",
        b"<< /Length " + str(len(streams[2])).encode() + b" >>\nstream\n" + streams[2] + b"\nendstream",
        _png_rgb_xobject(avatar),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>",
        b"<< /Title (Curriculum profesional - David Vidal Ramirez) /Author (David Vidal Ramirez) /Creator (David Vidal Ramirez) /Subject (Desarrollo de software, proyectos y experiencia profesional) /Keywords (Python, JavaScript, Flask, aplicaciones web, automatizacion) >>",
    ]
    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{number} 0 obj\n".encode() + obj + b"\nendobj\n")
    xref = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R /Info 14 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(pdf)
