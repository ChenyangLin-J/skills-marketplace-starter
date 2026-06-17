from __future__ import annotations

from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
import typer
from rich import print as rprint

from . import config as cfg_mod
from . import credentials
from . import __version__


def _base_url() -> str:
    return cfg_mod.load_config().get(
        "api_base_url",
        cfg_mod.DEFAULT_API_BASE_URL,
    ).rstrip("/")


def _client(timeout: float = 30.0) -> httpx.Client:
    base = _base_url()
    headers = {
        "User-Agent": f"agent-skills/{__version__}",
    }
    token = credentials.get_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    # Keep localhost development predictable even when shell proxy variables exist.
    return httpx.Client(
        base_url=base,
        timeout=timeout,
        trust_env=False,
        headers=headers,
    )


def _slug_path(slug: str) -> str:
    return quote(slug, safe="")


def _handle_error(resp: httpx.Response) -> None:
    if resp.is_success:
        return
    try:
        body = resp.json()
    except Exception:
        body = {}
    err = body.get("error") or "http_error"
    msg = body.get("message") or resp.text or f"HTTP {resp.status_code}"
    rprint(f"[red]✗ API 错误[/red] \\[{err}] {msg}")
    if resp.status_code == 401:
        rprint("  [dim]需要登录时请运行 [cyan]agent-skills login[/cyan] 后重试。[/dim]")
    elif resp.status_code == 403:
        rprint("  [dim]你当前账号没有权限；如果你认为应该有权限，请联系 Skill 管理者。[/dim]")
    details = body.get("details")
    if details:
        for k, v in details.items():
            rprint(f"  · [yellow]{k}[/yellow]: {v}")
    raise typer.Exit(code=1)


def _request(method: str, path: str, **kwargs: Any) -> httpx.Response:
    try:
        with _client() as c:
            resp = c.request(method, path, **kwargs)
    except httpx.ConnectError as e:
        rprint(
            f"[red]✗ 连不上 marketplace[/red]: {_base_url()}\n"
            f"  [dim]{e}[/dim]\n"
            f"  请确认 Web 已启动，或用 [cyan]agent-skills config set api_base_url <url>[/cyan] 改地址"
        )
        raise typer.Exit(code=1) from None
    except httpx.HTTPError as e:
        rprint(f"[red]✗ 网络错误[/red]: {e}")
        raise typer.Exit(code=1) from None
    _handle_error(resp)
    return resp


def list_skills(
    q: str | None = None,
    category: str | None = None,
    sort: str = "installs",
    limit: int = 50,
    offset: int = 0,
    fulltext: bool = False,
    include_archived: bool = False,
) -> dict[str, Any]:
    params: dict[str, Any] = {"sort": sort, "limit": limit, "offset": offset}
    if q:
        params["q"] = q
    if category:
        params["category"] = category
    if fulltext:
        params["full"] = "1"
    if include_archived:
        params["include_archived"] = "1"
    return _request("GET", "/api/skills", params=params).json()


def get_skill(slug: str) -> dict[str, Any]:
    return _request("GET", f"/api/skills/{_slug_path(slug)}").json()


def get_skill_versions(slug: str) -> dict[str, Any]:
    return _request("GET", f"/api/skills/{_slug_path(slug)}/versions").json()


def try_get_skill(slug: str) -> dict[str, Any] | None:
    """像 get_skill 但 skill 不存在时返回 None 而不是退出。"""
    try:
        with _client() as c:
            resp = c.request("GET", f"/api/skills/{_slug_path(slug)}")
    except httpx.ConnectError as e:
        rprint(
            f"[red]✗ 连不上 marketplace[/red]: {_base_url()}\n"
            f"  [dim]{e}[/dim]\n"
            f"  请确认 Web 已启动，或用 [cyan]agent-skills config set api_base_url <url>[/cyan] 改地址"
        )
        raise typer.Exit(code=1) from None
    except httpx.HTTPError as e:
        rprint(f"[red]✗ 网络错误[/red]: {e}")
        raise typer.Exit(code=1) from None
    if resp.status_code == 404:
        return None
    _handle_error(resp)
    return resp.json()


def download(slug: str) -> bytes:
    return _request("GET", f"/api/skills/{_slug_path(slug)}/download").content


def archive_skill(slug: str) -> dict[str, Any]:
    return _request("DELETE", f"/api/skills/{_slug_path(slug)}").json()


def restore_skill(slug: str) -> dict[str, Any]:
    return _request("POST", f"/api/skills/{_slug_path(slug)}/restore").json()


def get_access(slug: str) -> dict[str, Any]:
    return _request("GET", f"/api/skills/{_slug_path(slug)}/access").json()


def update_access(
    slug: str,
    *,
    install_access: str | None = None,
    visibility: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if install_access:
        payload["install_access"] = install_access
    if visibility:
        payload["visibility"] = visibility
    return _request("PATCH", f"/api/skills/{_slug_path(slug)}/access", json=payload).json()


def grant_access(slug: str, handle: str) -> dict[str, Any]:
    return _request(
        "POST",
        f"/api/skills/{_slug_path(slug)}/access/grants",
        json={"handle": handle},
    ).json()


def revoke_access(slug: str, handle: str) -> dict[str, Any]:
    return _request(
        "DELETE",
        f"/api/skills/{_slug_path(slug)}/access/grants",
        json={"handle": handle},
    ).json()


def create_feedback(
    slug: str,
    *,
    kind: str,
    message: str,
    context: str | None = None,
    agent: str | None = None,
    version: str | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "kind": kind,
        "message": message,
        "source": "cli",
        "cli_version": __version__,
    }
    if context:
        payload["context"] = context
    if agent:
        payload["agent"] = agent
    if version:
        payload["version"] = version
    return _request(
        "POST",
        f"/api/skills/{_slug_path(slug)}/feedback",
        json=payload,
    ).json()


def list_feedback(skill: str | None = None, limit: int = 50) -> dict[str, Any]:
    params: dict[str, Any] = {"limit": limit}
    if skill:
        params["skill"] = skill
    return _request("GET", "/api/feedback", params=params).json()


def start_cli_login() -> dict[str, Any]:
    return _request("POST", "/api/auth/cli/start").json()


def poll_cli_login(device_code: str) -> dict[str, Any]:
    return _request(
        "POST",
        "/api/auth/cli/poll",
        json={"device_code": device_code},
    ).json()


def cli_me() -> dict[str, Any]:
    return _request("GET", "/api/auth/cli/me").json()


def require_login() -> dict[str, Any]:
    if not credentials.get_token():
        rprint("[red]✗ 需要先登录[/red]: 运行 [cyan]agent-skills login[/cyan]")
        raise typer.Exit(code=1)
    return cli_me().get("user") or {}


def cli_logout() -> dict[str, Any]:
    return _request("DELETE", "/api/auth/cli/logout").json()


def cli_release() -> dict[str, Any]:
    return _request("GET", "/api/cli/releases/latest").json()


def try_cli_release(timeout: float = 30.0) -> dict[str, Any] | None:
    try:
        with _client(timeout=timeout) as c:
            resp = c.request("GET", "/api/cli/releases/latest")
    except httpx.HTTPError:
        return None
    if not resp.is_success:
        return None
    try:
        return resp.json()
    except Exception:
        return None


def download_url(url: str) -> bytes:
    try:
        with httpx.Client(
            timeout=60.0,
            trust_env=False,
            headers={
                "User-Agent": f"agent-skills/{__version__}",
            },
        ) as c:
            resp = c.get(url)
    except httpx.HTTPError as e:
        rprint(f"[red]✗ 下载失败[/red]: {e}")
        raise typer.Exit(code=1) from None
    _handle_error(resp)
    return resp.content


def install_event(slug: str, agent: str, version: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"agent": agent, "source": "cli"}
    if version:
        payload["version"] = version
    return _request("POST", f"/api/skills/{_slug_path(slug)}/install", json=payload).json()


def publish(
    zip_path: Path,
    category: str,
    tags: str | None = None,
    example: str | None = None,
) -> dict[str, Any]:
    data: dict[str, Any] = {"category": category}
    if tags:
        data["tags"] = tags
    if example:
        data["example"] = example
    with zip_path.open("rb") as f:
        files = {"file": (zip_path.name, f, "application/zip")}
        return _request("POST", "/api/skills", data=data, files=files).json()


def publish_version(slug: str, zip_path: Path, version: str | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if version:
        data["version"] = version
    with zip_path.open("rb") as f:
        files = {"file": (zip_path.name, f, "application/zip")}
        return _request(
            "POST",
            f"/api/skills/{_slug_path(slug)}/versions",
            data=data,
            files=files,
        ).json()


def health() -> dict[str, Any]:
    return _request("GET", "/api/health").json()
