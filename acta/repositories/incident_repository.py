"""Repository layer for entry persistence in JSONL format."""

import json
import logging
from pathlib import Path

from acta.config import DATA_FILE_PATH

logger = logging.getLogger(__name__)


class IncidentRepository:
    """Read/write access to entry records stored in JSONL."""

    @staticmethod
    def _ensure_file():
        """Ensure the JSONL file exists before read/write operations."""
        data_file = Path(DATA_FILE_PATH)
        if not data_file.exists():
            data_file.touch()
            logger.info("Created data file: %s", data_file)
        return data_file

    @staticmethod
    def _read_all_rows():
        """Read and parse all JSONL rows, ignoring malformed lines."""
        data_file = IncidentRepository._ensure_file()
        rows = []

        with data_file.open("r", encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                stripped = line.strip()
                if not stripped:
                    continue
                try:
                    rows.append(json.loads(stripped))
                except json.JSONDecodeError:
                    logger.warning("Malformed JSONL line detected at line=%s", line_number)

        return rows

    @staticmethod
    def create(what, when_at, where_location, who, created_at, created_by):
        """Append a new entry row and return its generated id."""
        try:
            rows = IncidentRepository._read_all_rows()
            next_id = 1
            if rows:
                next_id = max(int(row.get("id", 0)) for row in rows) + 1

            item = {
                "id": next_id,
                "what": what,
                "when_at": when_at,
                "where_location": where_location,
                "who": who,
                "created_at": created_at,
                "created_by": created_by,
            }

            data_file = IncidentRepository._ensure_file()
            with data_file.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(item, ensure_ascii=True) + "\n")

            logger.info("Created entry id=%s", next_id)
            return next_id
        except Exception:
            logger.exception("Failed to create entry row")
            raise

    @staticmethod
    def list_all():
        """Return all entries ordered by created_at descending."""
        try:
            rows = IncidentRepository._read_all_rows()
            rows.sort(key=lambda row: row.get("created_at", ""), reverse=True)
            logger.debug("Fetched %s entries", len(rows))
            return rows
        except Exception:
            logger.exception("Failed to list entries")
            raise

    @staticmethod
    def read_raw_file_bytes():
        """Return raw JSONL file bytes exactly as stored on disk."""
        try:
            data_file = IncidentRepository._ensure_file()
            return data_file.read_bytes()
        except Exception:
            logger.exception("Failed to read raw JSONL bytes")
            raise
