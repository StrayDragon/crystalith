from __future__ import annotations

import csv
import io

from .interfaces import ParserError
from .types import Chunk


class CSVParser:
    parser_type = "csv"
    supported_mime_types = {"text/csv"}
    supported_extensions = {".csv"}
    page_count: int | None = None

    max_rows_per_chunk = 50
    max_cell_chars = 200

    def parse(self, content: bytes) -> list[Chunk]:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ParserError("Unable to decode CSV content as UTF-8") from exc

        if not text.strip():
            return []

        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            return []

        raw_header = rows[0]
        header: list[str] = []
        for index, cell in enumerate(raw_header):
            name = (cell or "").strip()
            header.append(name if name else f"col{index + 1}")

        data_rows = rows[1:]
        if not data_rows:
            return []

        chunks: list[Chunk] = []
        for start in range(0, len(data_rows), self.max_rows_per_chunk):
            end = min(len(data_rows), start + self.max_rows_per_chunk)
            block = data_rows[start:end]

            table_lines = _to_markdown_table(header, block, max_cell_chars=self.max_cell_chars)
            metadata = {
                "csv_row_start": start + 1,
                "csv_row_end": end,
            }
            chunks.append(Chunk(text="\n".join(table_lines), metadata=metadata))

        return chunks


def _normalize_cell(value: str, *, max_cell_chars: int) -> str:
    normalized = (value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    normalized = normalized.replace("|", "\\|")
    normalized = normalized.replace("\n", " ")
    if len(normalized) > max_cell_chars:
        return normalized[: max(0, max_cell_chars - 1)] + "…"
    return normalized


def _to_markdown_table(header: list[str], rows: list[list[str]], *, max_cell_chars: int) -> list[str]:
    column_count = max(1, len(header))

    def normalize_row(row: list[str]) -> list[str]:
        cells: list[str] = []
        for index in range(column_count):
            raw = row[index] if index < len(row) else ""
            cells.append(_normalize_cell(raw, max_cell_chars=max_cell_chars))
        return cells

    header_cells = normalize_row(header)
    lines = [
        "| " + " | ".join(header_cells) + " |",
        "| " + " | ".join(["---"] * column_count) + " |",
    ]
    for row in rows:
        lines.append("| " + " | ".join(normalize_row(row)) + " |")
    return lines

