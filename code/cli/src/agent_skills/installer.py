from __future__ import annotations

import io
import shutil
import zipfile
from pathlib import Path

import typer
from rich import print as rprint
from rich.prompt import Confirm

from .agent_detect import get_target_dir


def install_zip(
    zip_bytes: bytes,
    agent: str,
    skill_name: str,
    *,
    yes: bool = False,
    dest: Path | None = None,
) -> Path:
    if dest is None:
        target_root = get_target_dir(agent)
        target_root.mkdir(parents=True, exist_ok=True)
        dest = target_root / skill_name
    else:
        dest = dest.expanduser()
        dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists():
        if not yes and not Confirm.ask(
            f"[yellow]Target already exists[/yellow]: {dest}\nOverwrite?",
            default=False,
        ):
            rprint("[yellow]Install cancelled[/yellow]")
            raise typer.Exit(code=0)
        shutil.rmtree(dest)

    dest.mkdir(parents=True)
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for member in zf.namelist():
                # Prevent zip slip
                resolved = (dest / member).resolve()
                if not str(resolved).startswith(str(dest.resolve())):
                    raise RuntimeError(f"Unsafe zip path: {member}")
            zf.extractall(dest)
    except Exception:
        shutil.rmtree(dest, ignore_errors=True)
        raise

    return dest
