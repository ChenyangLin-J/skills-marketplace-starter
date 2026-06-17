from __future__ import annotations

import tempfile
import zipfile
from pathlib import Path

EXCLUDE_DIRS = {".git", "__pycache__", "node_modules", ".venv", ".next"}
EXCLUDE_FILES = {".DS_Store"}
EXCLUDE_SUFFIXES = {".pyc"}


def _should_skip(path: Path) -> bool:
    parts = set(path.parts)
    if parts & EXCLUDE_DIRS:
        return True
    if path.name in EXCLUDE_FILES:
        return True
    if path.suffix in EXCLUDE_SUFFIXES:
        return True
    return False


def package_dir(src: Path) -> Path:
    src = src.resolve()
    if not src.is_dir():
        raise ValueError(f"不是目录: {src}")

    tmp = tempfile.NamedTemporaryFile(
        prefix=f"{src.name}-", suffix=".zip", delete=False
    )
    tmp.close()
    zip_path = Path(tmp.name)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in src.rglob("*"):
            if not file.is_file():
                continue
            rel = file.relative_to(src)
            if _should_skip(rel):
                continue
            zf.write(file, arcname=str(rel))
    return zip_path
