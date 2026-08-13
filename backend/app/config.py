import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Search for .env file in parent directories
base_dir = Path(__file__).resolve().parent.parent
dotenv_path = base_dir / ".env"
if not dotenv_path.exists():
    dotenv_path = base_dir.parent / ".env"

if dotenv_path.exists():
    load_dotenv(dotenv_path)

class Settings(BaseModel):
    cognodb_uri: str = os.getenv("COGNODB_URI", "bolt+s://demo.databases.cognodb.cloud")
    cognodb_user: str = os.getenv("COGNODB_USER", "cognodb")
    cognodb_password: str = os.getenv("COGNODB_PASSWORD", "demo_password")
    environment: str = os.getenv("ENVIRONMENT", "development")
    app_title: str = "AML Graph Intelligence Console API"
    app_version: str = "1.0.0"

settings = Settings()
