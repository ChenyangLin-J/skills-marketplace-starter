from __future__ import annotations

from pathlib import Path
from typing import Any

import tomli
import tomli_w

from .config import CONFIG_DIR

INSTALLED_PATH = CONFIG_DIR / "installed.toml"


def load_installed() -> list[dict[str, Any]]:
    if not INSTALLED_PATH.exists():
        return []
    with INSTALLED_PATH.open("rb") as f:
        data = tomli.load(f)
    skills = data.get("skills", [])
    if not isinstance(skills, list):
        return []
    return [it for it in skills if isinstance(it, dict)]


def save_installed(skills: list[dict[str, Any]]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with INSTALLED_PATH.open("wb") as f:
        tomli_w.dump({"skills": skills}, f)


def record_install(
    *,
    slug: str,
    name: str,
    version: str,
    agent: str,
    path: Path,
    installed_at: int,
) -> None:
    skills = load_installed()
    next_row = {
        "slug": slug,
        "name": name,
        "version": version,
        "agent": agent,
        "path": str(path),
        "installed_at": installed_at,
    }

    replaced = False
    for idx, row in enumerate(skills):
        if row.get("slug") == slug and row.get("agent") == agent:
            skills[idx] = next_row
            replaced = True
            break
    if not replaced:
        skills.append(next_row)

    save_installed(skills)


def remove_installs(
    *,
    slug: str,
    agents: set[str] | None = None,
) -> list[dict[str, Any]]:
    skills = load_installed()
    kept: list[dict[str, Any]] = []
    removed: list[dict[str, Any]] = []

    for row in skills:
        same_slug = row.get("slug") == slug
        same_agent = agents is None or str(row.get("agent") or "") in agents
        if same_slug and same_agent:
            removed.append(row)
        else:
            kept.append(row)

    if removed:
        save_installed(kept)

    return removed
