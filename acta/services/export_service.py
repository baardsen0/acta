"""Export service for rendering entries in multiple output formats."""

import math
import textwrap
from datetime import datetime

from acta.repositories.incident_repository import IncidentRepository
from acta.services.incident_service import IncidentService


class ExportService:
    """Build exports for entry data."""

    EXPORT_COLUMNS = [
        ("id", "ID"),
        ("what", "What"),
        ("when_at", "When"),
        ("where", "Where"),
        ("who", "Who"),
        ("created_at", "Created At"),
        ("created_by", "Created By"),
    ]

    @staticmethod
    def _export_rows():
        """Return export rows with stable column order."""
        items = IncidentService.list_incidents()
        return ExportService.EXPORT_COLUMNS, items

    @staticmethod
    def _normalize_value(value):
        """Normalize field value for export."""
        return str(value if value is not None else "").strip()

    @staticmethod
    def _to_markdown(columns, items):
        """Build readable markdown export content with per-entry sections."""
        generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        rows = [
            "# acta Export",
            "",
            f"- Generated (UTC): {generated}",
            f"- Total entries: {len(items)}",
            "",
        ]

        if not items:
            rows.append("_No entries found._")
            return ("\n".join(rows) + "\n").encode("utf-8")

        for index, item in enumerate(items, start=1):
            entry_title = ExportService._normalize_value(item.get("what", "")) or "Untitled entry"
            rows.append(f"## {index}. {entry_title}")
            rows.append("")
            for key, label in columns:
                value = ExportService._normalize_value(item.get(key, ""))
                safe = value.replace("\n", " ").replace("\r", " ")
                rows.append(f"- **{label}:** {safe}")
            rows.append("")
            rows.append("---")
            rows.append("")
        return ("\n".join(rows) + "\n").encode("utf-8")

    @staticmethod
    def _to_xls(columns, items):
        """Build styled HTML table content suitable for opening as .xls."""
        generated = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        header_cells = "".join(f"<th>{label}</th>" for _, label in columns)

        body_rows = []
        for item in items:
            cells = []
            for key, _ in columns:
                value = ExportService._normalize_value(item.get(key, ""))
                safe = (
                    value.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace('"', "&quot;")
                )
                cells.append(f"<td>{safe}</td>")
            body_rows.append("<tr>" + "".join(cells) + "</tr>")

        html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Arial, sans-serif; }}
    h1 {{ margin: 0 0 8px; }}
    .meta {{ margin: 0 0 12px; color: #444; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }}
    th {{ background: #f0f4f8; }}
    tr:nth-child(even) td {{ background: #fafcff; }}
  </style>
</head>
<body>
  <h1>acta Export</h1>
  <p class="meta">Generated (UTC): {generated}<br>Total entries: {len(items)}</p>
  <table>
    <thead><tr>{header_cells}</tr></thead>
    <tbody>
      {''.join(body_rows)}
    </tbody>
  </table>
</body>
</html>
"""
        return html.encode("utf-8")

    @staticmethod
    def _pdf_escape(text):
        """Escape a text segment for PDF text operators."""
        return str(text).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    @staticmethod
    def _to_pdf(columns, items):
        """Build a readable text-based PDF export."""
        lines = []
        lines.append("acta Export")
        lines.append(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        lines.append(f"Total entries: {len(items)}")
        lines.append("")
        for index, item in enumerate(items, start=1):
            lines.append(f"Entry {index}")
            lines.append("-" * 80)
            for key, label in columns:
                value = ExportService._normalize_value(item.get(key, ""))
                wrapped = textwrap.wrap(value, width=88) or [""]
                lines.append(f"{label}: {wrapped[0]}")
                for continuation in wrapped[1:]:
                    lines.append(f"  {continuation}")
            lines.append("")

        if not lines:
            lines = ["No entries"]

        lines_per_page = 45
        page_count = max(1, math.ceil(len(lines) / lines_per_page))
        objects = {}

        font_id = 3 + (page_count * 2)
        kids = []

        for idx in range(page_count):
            page_id = 3 + (idx * 2)
            content_id = page_id + 1
            kids.append(f"{page_id} 0 R")

            chunk = lines[idx * lines_per_page : (idx + 1) * lines_per_page]
            content_lines = ["BT", "/F1 10 Tf", "12 TL", "40 760 Td"]
            for line_index, line in enumerate(chunk):
                esc = ExportService._pdf_escape(line)
                if line_index == 0:
                    content_lines.append(f"({esc}) Tj")
                else:
                    content_lines.append("0 -12 Td")
                    content_lines.append(f"({esc}) Tj")
            content_lines.append("ET")

            stream = "\n".join(content_lines).encode("utf-8")
            content_obj = (
                f"<< /Length {len(stream)} >>\n".encode("utf-8")
                + b"stream\n"
                + stream
                + b"\nendstream"
            )
            page_obj = (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 {font_id} 0 R >> >> /Contents {content_id} 0 R >>"
            ).encode("utf-8")

            objects[page_id] = page_obj
            objects[content_id] = content_obj

        objects[1] = b"<< /Type /Catalog /Pages 2 0 R >>"
        objects[2] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {page_count} >>".encode("utf-8")
        objects[font_id] = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"

        max_obj_id = max(objects.keys())
        output = b"%PDF-1.4\n"
        offsets = [0] * (max_obj_id + 1)

        for obj_id in range(1, max_obj_id + 1):
            data = objects[obj_id]
            offsets[obj_id] = len(output)
            output += f"{obj_id} 0 obj\n".encode("utf-8")
            output += data + b"\n"
            output += b"endobj\n"

        xref_start = len(output)
        output += f"xref\n0 {max_obj_id + 1}\n".encode("utf-8")
        output += b"0000000000 65535 f \n"
        for obj_id in range(1, max_obj_id + 1):
            output += f"{offsets[obj_id]:010} 00000 n \n".encode("utf-8")

        output += f"trailer\n<< /Size {max_obj_id + 1} /Root 1 0 R >>\n".encode("utf-8")
        output += f"startxref\n{xref_start}\n%%EOF\n".encode("utf-8")
        return output

    @staticmethod
    def export_entries(fmt):
        """Export entries in md, xls, pdf, or raw jsonl format."""
        normalized = str(fmt or "md").strip().lower()
        columns, items = ExportService._export_rows()

        if normalized == "md":
            content = ExportService._to_markdown(columns, items)
            return content, "text/markdown; charset=utf-8", "md"
        if normalized == "xls":
            content = ExportService._to_xls(columns, items)
            return content, "application/vnd.ms-excel", "xls"
        if normalized == "pdf":
            content = ExportService._to_pdf(columns, items)
            return content, "application/pdf", "pdf"
        if normalized == "json":
            content = IncidentRepository.read_raw_file_bytes()
            return content, "application/x-ndjson; charset=utf-8", "jsonl"

        return None, None, None
