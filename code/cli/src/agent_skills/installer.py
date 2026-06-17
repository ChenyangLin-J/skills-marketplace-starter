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
            f"[yellow]目标已存在[/yellow]: {dest}\n是否覆盖?",
            default=False,
        ):
            rprint("[yellow]已取消安装[/yellow]")
            raise typer.Exit(code=0)
        shutil.rmtree(dest)

    dest.mkdir(parents=True)
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            for member in zf.namelist():
                # 防 zip slip
                resolved = (dest / member).resolve()
                if not str(resolved).startswith(str(dest.resolve())):
                    raise RuntimeError(f"非法 zip 路径: {member}")
            zf.extractall(dest)
    except Exception:
        shutil.rmtree(dest, ignore_errors=True)
        raise

    return dest
