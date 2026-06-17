from __future__ import annotations

from pathlib import Path
from typing import Any

import tomli
import tomli_w

CONFIG_DIR = Path.home() / ".agent-skills"
CONFIG_PATH = CONFIG_DIR / "config.toml"
DEFAULT_API_BASE_URL = "http://localhost:3000"
OLD_DEFAULT_API_BASE_URLS: set[str] = set()

DEFAULT_CONFIG: dict[str, Any] = {
    "api_base_url": DEFAULT_API_BASE_URL,
    "default_agent": "ask",
    "auto_update": True,
    "last_cli_update_check": 0,
}


def _normalize_url(value: Any) -> str:
    return str(value or "").rstrip("/")


def _needs_default_api_migration(value: Any) -> bool:
    normalized = _normalize_url(value)
    return not normalized or normalized in OLD_DEFAULT_API_BASE_URLS


def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        save_config(DEFAULT_CONFIG.copy())
        return DEFAULT_CONFIG.copy()
    with CONFIG_PATH.open("rb") as f:
        data = tomli.load(f)
    merged = DEFAULT_CONFIG.copy()
    merged.update(data)
    if _needs_default_api_migration(data.get("api_base_url")):
        merged["api_base_url"] = DEFAULT_API_BASE_URL
        save_config(merged)
    return merged


def save_config(cfg: dict[str, Any]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with CONFIG_PATH.open("wb") as f:
        tomli_w.dump(cfg, f)


def get_value(key: str) -> Any:
    return load_config().get(key)


def set_value(key: str, value: str) -> None:
    cfg = load_config()
    cfg[key] = value
    save_config(cfg)
