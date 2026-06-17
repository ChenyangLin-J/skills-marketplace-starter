from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

CONFIG_DIR = Path.home() / ".agent-skills"
_credentials_path = os.environ.get("AGENT_SKILLS_CREDENTIALS_PATH")
CREDENTIALS_PATH = Path(_credentials_path or CONFIG_DIR / "credentials.json").expanduser()


def load_credentials() -> dict[str, Any] | None:
    if not CREDENTIALS_PATH.exists():
        return None
    try:
        return json.loads(CREDENTIALS_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def get_token() -> str | None:
    data = load_credentials() or {}
    token = data.get("token")
    return str(token).strip() if token else None


def save_credentials(token: str, expires_at: int, user: dict[str, Any]) -> None:
    CREDENTIALS_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "token": token,
        "expires_at": expires_at,
        "user": {
            "open_id": user.get("open_id"),
            "handle": user.get("handle"),
            "name": user.get("name"),
            "email": user.get("email"),
        },
    }
    CREDENTIALS_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    try:
        CREDENTIALS_PATH.chmod(0o600)
    except OSError:
        pass


def delete_credentials() -> None:
    try:
        CREDENTIALS_PATH.unlink()
    except FileNotFoundError:
        pass
