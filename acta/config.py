"""Configuration values for the acta application."""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE_PATH = Path(os.environ.get("ACTA_DATA_FILE", BASE_DIR / "acta.jsonl"))


class Config:
    """Flask config object."""

    DATA_FILE = DATA_FILE_PATH.as_posix()
    JSON_SORT_KEYS = False
