"""Application entrypoint for the acta incident logger."""

import logging

from acta import create_app


def configure_logging():
    """Configure process-wide logging format and default level."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )


configure_logging()
logger = logging.getLogger(__name__)
app = create_app()


if __name__ == "__main__":
    logger.info("Starting acta web server on http://127.0.0.1:5003")
    app.run(host="127.0.0.1", port=5003, debug=True)
