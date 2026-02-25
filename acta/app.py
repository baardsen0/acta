"""Flask app factory and lifecycle wiring."""

import logging

from flask import Flask

from acta.api.routes import api_bp, frontend_bp
from acta.config import Config

logger = logging.getLogger(__name__)


def create_app():
    """Create and configure the Flask application instance."""
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)

    app.register_blueprint(api_bp)
    app.register_blueprint(frontend_bp)
    logger.info("Registered API and frontend blueprints")

    return app
