import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "lendandloop-demo-secret")
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL") or (
        "sqlite:///" + str((BASE_DIR / "lendandloop.db").resolve())
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", str((BASE_DIR / "backend" / "uploads").resolve()))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
