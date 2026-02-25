"""HTTP routes for API and frontend assets."""

import logging
from datetime import datetime

from flask import Blueprint, Response, jsonify, request, send_from_directory

from acta.config import BASE_DIR
from acta.services.export_service import ExportService
from acta.services.incident_service import IncidentService

logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__, url_prefix="/api")
frontend_bp = Blueprint("frontend", __name__)
FRONTEND_DIR = BASE_DIR / "frontend"


@api_bp.get("/incidents")
def list_incidents():
    """Return all entries."""
    try:
        items = IncidentService.list_incidents()
        logger.info("GET /api/incidents -> %s items", len(items))
        return jsonify({"items": items})
    except Exception:
        logger.exception("Unhandled error in GET /api/incidents")
        return jsonify({"error": "Failed to load entries."}), 500


@api_bp.post("/incidents")
def create_incident():
    """Create a new entry from JSON payload."""
    try:
        payload = request.get_json(silent=True) or {}
        result, error = IncidentService.create_incident(payload)
        if error:
            logger.warning("POST /api/incidents validation error: %s", error)
            return jsonify({"error": error}), 400
        logger.info("POST /api/incidents -> created id=%s", result["id"])
        return jsonify(result), 201
    except Exception:
        logger.exception("Unhandled error in POST /api/incidents")
        return jsonify({"error": "Failed to create entry."}), 500


@api_bp.get("/export")
def export_incidents():
    """Export entries in configured format."""
    try:
        fmt = request.args.get("format", "md")
        payload, mime, ext = ExportService.export_entries(fmt)
        if payload is None:
            return jsonify({"error": "Unsupported export format. Use md, pdf, xls, or json."}), 400

        filename = f"entries_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{ext}"
        return Response(
            payload,
            mimetype=mime,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception:
        logger.exception("Unhandled error in GET /api/export")
        return jsonify({"error": "Failed to export entries."}), 500


@frontend_bp.get("/")
def index():
    """Serve frontend application index."""
    logger.debug("Serving frontend index")
    return send_from_directory(FRONTEND_DIR, "index.html")


@frontend_bp.get("/<path:path>")
def frontend_files(path):
    """Serve frontend static assets."""
    logger.debug("Serving frontend asset: %s", path)
    return send_from_directory(FRONTEND_DIR, path)
