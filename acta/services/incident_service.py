"""Service layer containing entry validation and normalization."""

import logging
from datetime import datetime

from acta.repositories.incident_repository import IncidentRepository

logger = logging.getLogger(__name__)


class IncidentService:
    """Business logic for entry operations."""

    REQUIRED_FIELDS = ("what", "when_at", "where", "who", "created_by")

    @staticmethod
    def normalize_who(raw_value):
        """Normalize `who` as a comma-separated list of cleaned names."""
        normalized = str(raw_value).replace("\r", "\n")
        parts = []
        for chunk in normalized.split("\n"):
            for name in chunk.split(","):
                clean = name.strip()
                if clean:
                    parts.append(clean)
        return ", ".join(parts)

    @staticmethod
    def validate(payload):
        """Validate required fields and normalize input payload in place."""
        missing = [field for field in IncidentService.REQUIRED_FIELDS if not payload.get(field)]
        if missing:
            logger.warning("Validation failed, missing fields: %s", ", ".join(missing))
            return False, f"Missing required field(s): {', '.join(missing)}"

        when_at = payload.get("when_at", "").strip()
        try:
            parsed = datetime.strptime(when_at, "%Y-%m-%d %H:%M:%S")
            payload["when_at"] = parsed.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                parsed = datetime.strptime(when_at, "%Y-%m-%d %H:%M")
                payload["when_at"] = parsed.strftime("%Y-%m-%d %H:%M:%S")
            except ValueError:
                logger.warning("Validation failed, invalid when_at: %s", when_at)
                return False, "Field 'when_at' must use 24-hour format: YYYY-MM-DD HH:MM"

        normalized_who = IncidentService.normalize_who(payload.get("who", ""))
        if not normalized_who:
            logger.warning("Validation failed, empty normalized who")
            return False, "Field 'who' must include at least one name."
        payload["who"] = normalized_who

        logger.debug("Payload validated successfully")
        return True, None

    @staticmethod
    def create_incident(payload):
        """Create an entry record and return API-safe representation."""
        ok, error = IncidentService.validate(payload)
        if not ok:
            return None, error

        now_iso = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        entry_id = IncidentRepository.create(
            what=payload["what"].strip(),
            when_at=payload["when_at"].strip(),
            where_location=payload["where"].strip(),
            who=payload["who"].strip(),
            created_at=now_iso,
            created_by=payload["created_by"].strip(),
        )

        logger.info("Entry created id=%s by=%s", entry_id, payload["created_by"].strip())
        return {
            "id": entry_id,
            "what": payload["what"].strip(),
            "when_at": payload["when_at"].strip(),
            "where": payload["where"].strip(),
            "who": payload["who"].strip(),
            "created_at": now_iso,
            "created_by": payload["created_by"].strip(),
        }, None

    @staticmethod
    def list_incidents():
        """Return entries with API field names."""
        items = IncidentRepository.list_all()
        for item in items:
            item["where"] = item.pop("where_location")
        logger.debug("Returning %s entries from service layer", len(items))
        return items
