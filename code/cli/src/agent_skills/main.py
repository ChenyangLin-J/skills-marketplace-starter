from __future__ import annotations

import hashlib
import platform
import re
import shutil
import subprocess
import tempfile
import time
import webbrowser
from pathlib import Path
from typing import Annotated

import frontmatter
import typer
from rich import print as rprint
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.table import Table

from . import (
    __version__,
    agent_detect,
    api,
    config as cfg_mod,
    credentials,
    installer,
    packager,
    state,
)

app = typer.Typer(
    name="agent-skills",
    help="Skills Marketplace Starter CLI - publish, discover, install, and improve Agent Skills",
    no_args_is_help=True,
    add_completion=False,
)

config_app = typer.Typer(
    name="config",
    help="读写 ~/.agent-skills/config.toml",
    no_args_is_help=True,
)
app.add_typer(config_app, name="config")

self_app = typer.Typer(
    name="self",
    help="检查 / 更新 agent-skills CLI 本体",
    no_args_is_help=True,
)
app.add_typer(self_app, name="self")

CATEGORIES = ["business", "tool", "method", "cli"]
INSTALL_ACCESS_CHOICES = ["anonymous", "company", "restricted"]
VISIBILITY_CHOICES = ["listed", "unlisted", "restricted", "match_install_access"]
UPDATE_CHECK_INTERVAL_SECONDS = 24 * 60 * 60
AUTO_UPDATE_CHECK_TIMEOUT_SECONDS = 2.0
SKILL_NAME_RE = re.compile(r"^[a-z0-9-]{1,50}$")


def _version_callback(value: bool) -> None:
    if value:
        rprint(f"agent-skills [cyan]{__version__}[/cyan]")
        raise typer.Exit()


def _version_tuple(version: str | None) -> tuple[int, int, int]:
    parts = [int(x) for x in re.findall(r"\d+", version or "")[:3]]
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def _is_newer_version(latest: str | None, current: str | None) -> bool:
    return _version_tuple(latest) > _version_tuple(current)


def _maybe_check_for_cli_update() -> None:
    cfg = cfg_mod.load_config()
    if not cfg.get("auto_update", True):
        return

    now = int(time.time())
    last_check = int(cfg.get("last_cli_update_check") or 0)
    if now - last_check < UPDATE_CHECK_INTERVAL_SECONDS:
        return

    cfg_mod.set_value("last_cli_update_check", str(now))
    release = api.try_cli_release(timeout=AUTO_UPDATE_CHECK_TIMEOUT_SECONDS)
    if not release:
        return

    latest = str(release.get("version", ""))
    if _is_newer_version(latest, __version__):
        rprint(
            f"[dim]发现 agent-skills 新版本 v{latest}，运行 "
            f"[cyan]agent-skills self update[/cyan] 更新。[/dim]"
        )


@app.callback()
def _root(
    ctx: typer.Context,
    version: Annotated[
        bool,
        typer.Option("--version", "-v", callback=_version_callback, is_eager=True, help="显示版本"),
    ] = False,
) -> None:
    if ctx.invoked_subcommand not in {"self", "config"}:
        _maybe_check_for_cli_update()


def _validate_slug(slug: str) -> str:
    if not slug.startswith("@") or "/" not in slug:
        rprint(
            "[red]✗ slug must use @author/name format[/red], for example [cyan]@community/marketplace-guide[/cyan]"
        )
        raise typer.Exit(code=2)
    return slug


def _render_table(items: list[dict]) -> Table:
    table = Table(show_header=True, header_style="bold cyan", show_lines=False)
    table.add_column("Skill", style="cyan", no_wrap=True)
    table.add_column("作者", style="magenta")
    table.add_column("描述")
    table.add_column("装机", justify="right", style="green")
    table.add_column("赞", justify="right", style="yellow")
    for it in items:
        desc = it.get("description") or ""
        if len(desc) > 60:
            desc = desc[:57] + "..."
        row = [
            it.get("slug", ""),
            it.get("author", ""),
        ]
        row.extend([
            desc,
            str(it.get("install_count", 0)),
            str(it.get("like_count", 0)),
        ])
        table.add_row(*row)
    return table


def _render_mine_table(items: list[dict]) -> Table:
    table = Table(show_header=True, header_style="bold cyan", show_lines=False, expand=True)
    table.add_column("Skill", style="cyan", overflow="fold", max_width=42)
    table.add_column("作者", style="magenta", no_wrap=True, max_width=14)
    table.add_column("状态", no_wrap=True, max_width=8)
    table.add_column("版本", no_wrap=True, max_width=12)
    table.add_column("装机", justify="right", style="green", no_wrap=True)
    table.add_column("赞", justify="right", style="yellow", no_wrap=True)
    for item in items:
        table.add_row(
            str(item.get("slug") or ""),
            str(item.get("author") or ""),
            "已下架" if item.get("status") == "archived" else "上架中",
            f"v{item.get('version')}" if item.get("version") else "",
            str(item.get("install_count", 0)),
            str(item.get("like_count", 0)),
        )
    return table


def _install_access_label(value: str) -> str:
    if value == "anonymous":
        return "免登录安装"
    if value == "restricted":
        return "限定人员可装"
    return "公司登录可装"


def _visibility_label(value: str) -> str:
    if value == "unlisted":
        return "链接可访问"
    if value == "restricted":
        return "授权用户可见"
    if value == "match_install_access":
        return "跟安装权限联动"
    return "公开列表可见"


def _render_access_panel(slug: str, data: dict) -> None:
    grants = data.get("grants") or []
    handles = [
        f"@{item.get('principal')}"
        for item in grants
        if isinstance(item, dict) and item.get("principal")
    ]
    table = Table.grid(padding=(0, 2))
    table.add_column(style="bold")
    table.add_column()
    table.add_row("Skill", slug)
    table.add_row("安装权限", _install_access_label(str(data.get("install_access") or "")))
    table.add_row("可见性", _visibility_label(str(data.get("visibility") or "")))
    table.add_row("指定人员", ", ".join(handles) if handles else "[dim]未设置[/dim]")
    rprint(table)


@app.command()
def search(
    keyword: Annotated[str, typer.Argument(help="搜索关键词")],
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="business / tool / method / cli"),
    ] = None,
    limit: Annotated[int, typer.Option("--limit", help="最多返回多少条")] = 50,
    full: Annotated[
        bool,
        typer.Option(
            "--full",
            help="搜 SKILL.md 全文（默认只搜名称/描述/标签）",
        ),
    ] = False,
) -> None:
    """搜索 skill（默认只搜名称/描述/标签，加 --full 搜 SKILL.md 全文）"""
    if category and category not in CATEGORIES:
        rprint(f"[red]✗ 未知分类[/red]: {category}（支持 {', '.join(CATEGORIES)}）")
        raise typer.Exit(code=2)
    data = api.list_skills(
        q=keyword, category=category, sort="installs", limit=limit, fulltext=full
    )
    items = data.get("items", [])
    if not items:
        hint = "" if full else "  [dim]提示：加 --full 搜 SKILL.md 全文[/dim]"
        rprint(f"[yellow]没有匹配 '{keyword}' 的 skill[/yellow]\n{hint}")
        return
    scope = "全文" if full else "名称/描述/标签"
    rprint(f"[dim]共 {data.get('total', len(items))} 条结果（搜索范围：{scope}）[/dim]")
    rprint(_render_table(items))


@app.command(name="list")
def list_cmd(
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="business / tool / method / cli"),
    ] = None,
    sort: Annotated[
        str,
        typer.Option("--sort", help="installs / likes / updated / created"),
    ] = "installs",
    mine: Annotated[
        bool,
        typer.Option("--mine", help="只列出我管理的 skill（含已下架）"),
    ] = False,
) -> None:
    """列出所有 skill"""
    if category and category not in CATEGORIES:
        rprint(f"[red]✗ 未知分类[/red]: {category}")
        raise typer.Exit(code=2)
    if mine:
        api.require_login()
        sort = "updated"
    data = api.list_skills(
        category=category,
        sort=sort,
        limit=100,
        include_archived=mine,
    )
    items = data.get("items", [])
    if not items:
        if mine:
            rprint("[yellow]你还没有管理任何 skill[/yellow]")
        else:
            rprint("[yellow]Marketplace 还是空的，去发布第一个 skill 吧 ✨[/yellow]")
        return
    scope = "我管理的 skill" if mine else "skill"
    rprint(f"[dim]共 {data.get('total', len(items))} 个{scope} (按 {sort} 排序)[/dim]")
    rprint(_render_mine_table(items) if mine else _render_table(items))


@app.command()
def info(
    slug: Annotated[str, typer.Argument(help="例如 @community/marketplace-guide")],
    readme: Annotated[
        bool,
        typer.Option("--readme", help="附加显示 SKILL.md 正文"),
    ] = False,
    example: Annotated[
        bool,
        typer.Option("--example", help="附加显示使用示例"),
    ] = False,
    full: Annotated[
        bool,
        typer.Option("--full", help="等同于 --readme + --example"),
    ] = False,
) -> None:
    """显示 skill 详细信息（默认只显示元信息，加 --full 看完整 readme + 示例）"""
    _validate_slug(slug)
    sk = api.get_skill(slug)
    show_readme = readme or full
    show_example = example or full

    header = (
        f"[bold cyan]{sk['slug']}[/bold cyan] "
        f"[dim]v{sk.get('version', '?')}[/dim]\n"
        f"{sk.get('description', '')}"
    )
    rprint(Panel(header, expand=False))

    meta = Table.grid(padding=(0, 2))
    meta.add_column(style="bold")
    meta.add_column()
    meta.add_row("作者", sk.get("author", ""))
    meta.add_row("分类", sk.get("category", ""))
    meta.add_row("标签", ", ".join(sk.get("tags") or []) or "[dim]无[/dim]")
    meta.add_row("版本", str(sk.get("version", "")))
    meta.add_row("状态", "已下架" if sk.get("status") == "archived" else "上架中")
    meta.add_row("装机数", str(sk.get("install_count", 0)))
    meta.add_row("本周装机", f"+{sk.get('weekly_install_count', 0)}")
    meta.add_row("点赞", str(sk.get("like_count", 0)))

    updated_at = sk.get("updated_at")
    if updated_at:
        try:
            from datetime import datetime, timezone

            dt = datetime.fromtimestamp(int(updated_at), tz=timezone.utc).astimezone()
            meta.add_row("更新时间", dt.strftime("%Y-%m-%d %H:%M"))
        except (ValueError, OSError, TypeError):
            meta.add_row("更新时间", str(updated_at))
    rprint(meta)

    if show_readme:
        readme_text = sk.get("readme") or ""
        if readme_text:
            rprint("\n[bold]README[/bold]")
            rprint(Markdown(readme_text))
        else:
            rprint("\n[dim](无 SKILL.md 正文)[/dim]")

    if show_example:
        example_text = sk.get("example")
        if example_text:
            rprint("\n[bold]示例[/bold]")
            rprint(Panel(example_text, expand=False))
        else:
            rprint("\n[dim](作者未填写示例)[/dim]")

    if not show_readme and not show_example:
        rprint(
            f"\n[dim]💡 看完整 readme: agent-skills info {slug} --full[/dim]"
        )


@app.command()
def versions(
    slug: Annotated[str, typer.Argument(help="例如 @community/marketplace-guide")],
) -> None:
    """查看 skill 的版本历史（仅展示，安装默认使用最新版）"""
    _validate_slug(slug)
    data = api.get_skill_versions(slug)
    items = data.get("items", [])
    if not items:
        rprint(f"[yellow]没有版本记录[/yellow]: {slug}")
        return

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("版本", style="cyan")
    table.add_column("状态")
    table.add_column("上传者")
    table.add_column("上传时间")

    for item in items:
        uploaded_at = item.get("uploaded_at")
        uploaded_time = ""
        if uploaded_at:
            try:
                from datetime import datetime, timezone

                dt = datetime.fromtimestamp(int(uploaded_at), tz=timezone.utc).astimezone()
                uploaded_time = dt.strftime("%Y-%m-%d %H:%M")
            except (ValueError, OSError, TypeError):
                uploaded_time = str(uploaded_at)
        table.add_row(
            f"v{item.get('version', '')}",
            "当前" if item.get("is_current") else "历史",
            f"@{item.get('uploaded_by')}" if item.get("uploaded_by") else "",
            uploaded_time,
        )

    rprint(table)


@app.command()
def feedback(
    target: Annotated[
        str,
        typer.Argument(help="例如 @community/marketplace-guide；或 list 查看收到的反馈"),
    ],
    kind: Annotated[
        str | None,
        typer.Option("--type", "-t", help="issue / suggestion / question / usage"),
    ] = None,
    message: Annotated[
        str | None,
        typer.Option("--message", "-m", help="反馈正文"),
    ] = None,
    agent: Annotated[
        str | None,
        typer.Option("--agent", "-a", help="codex / claude / cursor / antigravity"),
    ] = None,
    context: Annotated[
        str | None,
        typer.Option("--context", help="可选上下文文本"),
    ] = None,
    context_file: Annotated[
        Path | None,
        typer.Option("--context-file", help="从文件读取可选上下文"),
    ] = None,
    skill: Annotated[
        str | None,
        typer.Option("--skill", help="feedback list 时只看某个 skill"),
    ] = None,
    limit: Annotated[
        int,
        typer.Option("--limit", help="feedback list 最多返回多少条"),
    ] = 50,
) -> None:
    """给 skill 作者提交问题、建议或使用反馈；feedback list 可查看收到的反馈"""
    if target == "list":
        api.require_login()
        if skill:
            _validate_slug(skill)
        data = api.list_feedback(skill=skill, limit=limit)
        items = data.get("items", [])
        if not items:
            scope = f" {skill}" if skill else ""
            rprint(f"[yellow]还没有收到{scope} 的反馈[/yellow]")
            return
        rprint(f"[dim]共 {data.get('total', len(items))} 条反馈[/dim]")
        rprint(_render_feedback_table(items))
        return

    slug = target
    _validate_slug(slug)
    api.require_login()
    sk = api.get_skill(slug)

    choices = ["issue", "suggestion", "question", "usage"]
    if kind is None:
        kind = Prompt.ask("反馈类型", choices=choices, default="issue")
    elif kind not in choices:
        rprint(f"[red]✗ 未知反馈类型[/red]: {kind}（支持 {', '.join(choices)}）")
        raise typer.Exit(code=2)

    if message is None:
        message = Prompt.ask("反馈内容").strip()
    if not message.strip():
        rprint("[red]✗ 反馈内容不能为空[/red]")
        raise typer.Exit(code=2)

    context_text = context or ""
    if context_file:
        try:
            context_text = context_file.expanduser().read_text(encoding="utf-8")
        except OSError as e:
            rprint(f"[red]✗ 读取上下文文件失败[/red]: {e}")
            raise typer.Exit(code=2) from None

    installed_version = _installed_version(slug)
    result = api.create_feedback(
        slug,
        kind=kind,
        message=message.strip(),
        context=context_text.strip() or None,
        agent=agent,
        version=installed_version or str(sk.get("version") or ""),
    )
    rprint(
        Panel(
            f"[green]✓ 已提交反馈[/green] #{result.get('id')}\n"
            f"[dim]Skill[/dim]: {slug}  [dim]版本[/dim]: {result.get('version') or sk.get('version')}",
            expand=False,
        )
    )


def _render_feedback_table(items: list[dict]) -> Table:
    table = Table(show_header=True, header_style="bold cyan", show_lines=False, expand=True)
    table.add_column("Skill", style="cyan", overflow="fold", max_width=32)
    table.add_column("来源", no_wrap=True, max_width=12)
    table.add_column("反馈", ratio=2, min_width=16, overflow="fold")
    table.add_column("提交", style="magenta", overflow="fold", max_width=20)
    for item in items:
        message = str(item.get("message") or "")
        if len(message) > 64:
            message = message[:61] + "..."
        created_at = item.get("created_at")
        created_time = ""
        if created_at:
            try:
                from datetime import datetime, timezone

                dt = datetime.fromtimestamp(int(created_at), tz=timezone.utc).astimezone()
                created_time = dt.strftime("%m-%d %H:%M")
            except (ValueError, OSError, TypeError):
                created_time = str(created_at)
        source = "CLI" if item.get("source") == "cli" else "Web"
        if item.get("kind"):
            source = f"{source}/{item.get('kind')}"
        version = f"v{item.get('version')}" if item.get("version") else ""
        submitter = (
            f"@{item.get('user_handle')}"
            if item.get("user_handle")
            else str(item.get("user_id") or "")
        )
        if created_time:
            submitter = f"{submitter}\n{created_time}" if submitter else created_time
        table.add_row(
            str(item.get("skill_slug") or item.get("skill_name") or ""),
            source,
            f"{version}\n{message}" if version else message,
            submitter,
        )
    return table


def _installed_version(slug: str) -> str | None:
    for row in state.load_installed():
        if row.get("slug") == slug and row.get("version"):
            return str(row.get("version"))
    return None


@app.command()
def login(
    timeout: Annotated[
        int,
        typer.Option("--timeout", help="等待网页登录完成的秒数"),
    ] = 120,
) -> None:
    """Open browser login and save CLI credentials."""
    data = api.start_cli_login()
    authorize_url = str(data.get("authorize_url") or "")
    device_code = str(data.get("device_code") or "")
    interval = max(1, int(data.get("interval_seconds") or 2))
    if not authorize_url or not device_code:
        rprint("[red]✗ 服务端没有返回完整登录信息[/red]")
        raise typer.Exit(code=1)

    rprint("[dim]Opening browser login...[/dim]")
    if not webbrowser.open(authorize_url, new=1, autoraise=True):
        rprint("[red]✗ 浏览器打开失败，登录失败[/red]")
        raise typer.Exit(code=1)

    deadline = time.time() + max(1, timeout)
    while time.time() < deadline:
        result = api.poll_cli_login(device_code)
        if result.get("status") == "ok":
            token = str(result.get("token") or "")
            user = result.get("user") or {}
            expires_at = int(result.get("expires_at") or 0)
            if not token or not user:
                rprint("[red]✗ 服务端登录响应不完整[/red]")
                raise typer.Exit(code=1)
            credentials.save_credentials(token, expires_at, user)
            rprint(
                Panel(
                    f"[green]✓ CLI 已登录[/green]\n"
                    f"[dim]用户[/dim]: {user.get('name') or user.get('handle')} (@{user.get('handle')})\n"
                    f"[dim]凭据[/dim]: {credentials.CREDENTIALS_PATH}",
                    expand=False,
                )
            )
            return
        time.sleep(interval)

    rprint("[red]✗ 登录超时，请重新运行 agent-skills login[/red]")
    raise typer.Exit(code=1)


@app.command()
def whoami() -> None:
    """查看当前 CLI 登录身份"""
    user = api.require_login()
    table = Table.grid(padding=(0, 2))
    table.add_column(style="bold")
    table.add_column()
    table.add_row("姓名", str(user.get("name") or ""))
    table.add_row("Handle", f"@{user.get('handle')}")
    table.add_row("Open ID", str(user.get("open_id") or ""))
    rprint(table)
    rprint(f"[dim]凭据: {credentials.CREDENTIALS_PATH}[/dim]")


@app.command()
def logout() -> None:
    """清除当前 CLI 登录态"""
    if credentials.get_token():
        try:
            api.cli_logout()
        except SystemExit:
            pass
    credentials.delete_credentials()
    rprint("[green]✓ 已退出 CLI 登录[/green]")


@app.command()
def install(
    slug: Annotated[str, typer.Argument(help="例如 @community/marketplace-guide")],
    target: Annotated[
        str | None,
        typer.Option("--target", "-t", help="1/2/3/4、12、all、codex、claude、cursor、antigravity"),
    ] = None,
    yes: Annotated[
        bool,
        typer.Option("--yes", "-y", help="目标已存在时直接覆盖"),
    ] = False,
) -> None:
    """下载 skill 并安装到 agent 目录"""
    _validate_slug(slug)
    sk = api.get_skill(slug)
    skill_name = sk.get("name") or slug.split("/", 1)[-1]
    version = sk.get("version")

    try:
        agents = agent_detect.resolve_agents(target)
    except ValueError as e:
        rprint(f"[red]✗ {e}[/red]")
        raise typer.Exit(code=2) from None
    if not agents:
        rprint("[yellow]已跳过安装[/yellow]")
        return

    rprint(f"[dim]正在下载[/dim] {slug} v{version} ...")
    zip_bytes = api.download(slug)

    installed: list[tuple[str, Path, str]] = []
    for agent in agents:
        dest = installer.install_zip(zip_bytes, agent, skill_name, yes=yes)
        if version:
            state.record_install(
                slug=slug,
                name=skill_name,
                version=str(version),
                agent=agent,
                path=dest,
                installed_at=int(time.time()),
            )

        try:
            result = api.install_event(slug, agent, version)
            install_count = str(result.get("install_count", "?"))
        except SystemExit:
            install_count = "?"
        except Exception as e:
            rprint(f"[yellow]⚠ 装机上报失败（不影响安装）: {e}[/yellow]")
            install_count = "?"
        installed.append((agent, dest, install_count))

    lines = [f"[green]✓ 已安装[/green] [cyan]{slug}[/cyan] v{version}"]
    for agent, dest, install_count in installed:
        lines.append(
            f"[dim]Agent[/dim]: {agent}  [dim]目录[/dim]: {dest}  "
            f"[dim]累计装机[/dim]: {install_count}"
        )
    rprint(
        Panel(
            "\n".join(lines),
            expand=False,
        )
    )


def _remove_path(path: Path) -> None:
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink()


@app.command()
def uninstall(
    slug: Annotated[str, typer.Argument(help="例如 @community/marketplace-guide")],
    target: Annotated[
        str | None,
        typer.Option("--target", "-t", help="1/2/3/4、12、all、codex、claude、cursor、antigravity"),
    ] = None,
    yes: Annotated[
        bool,
        typer.Option("--yes", "-y", help="直接删除，不再二次确认"),
    ] = False,
) -> None:
    """从本机 agent 目录删除已安装的 skill"""
    _validate_slug(slug)
    try:
        agents = agent_detect.resolve_agents(target) if target else None
    except ValueError as e:
        rprint(f"[red]✗ {e}[/red]")
        raise typer.Exit(code=2) from None
    if agents == []:
        rprint("[yellow]已跳过删除[/yellow]")
        return

    agent_set = set(agents) if agents is not None else None
    rows = [
        row
        for row in state.load_installed()
        if row.get("slug") == slug
        and (agent_set is None or str(row.get("agent") or "") in agent_set)
    ]

    targets: list[tuple[str, Path, bool]] = []
    for row in rows:
        agent = str(row.get("agent") or "?")
        path_value = row.get("path")
        if path_value:
            targets.append((agent, Path(str(path_value)).expanduser(), True))

    if not targets:
        skill_name = slug.split("/", 1)[-1]
        scan_agents = agents or agent_detect.VALID_AGENTS
        for agent in scan_agents:
            path = agent_detect.get_target_dir(agent) / skill_name
            if path.exists():
                targets.append((agent, path, False))

    deduped: list[tuple[str, Path, bool]] = []
    seen_paths: set[Path] = set()
    for agent, path, recorded in targets:
        key = path.expanduser().resolve(strict=False)
        if key in seen_paths:
            continue
        seen_paths.add(key)
        deduped.append((agent, path, recorded))
    targets = deduped

    if not targets and not rows:
        hint = f"可指定目标重试: agent-skills uninstall {slug} --target claude"
        rprint(f"[yellow]本机没有找到安装记录或目录[/yellow]: {slug}\n[dim]{hint}[/dim]")
        return

    existing = [(agent, path) for agent, path, _ in targets if path.exists()]
    missing = [(agent, path) for agent, path, recorded in targets if recorded and not path.exists()]

    if not existing and missing:
        removed = state.remove_installs(slug=slug, agents=agent_set)
        rprint(
            f"[yellow]未找到本地目录，已清理 {len(removed)} 条安装记录[/yellow]: {slug}"
        )
        return

    if not yes:
        preview = "\n".join(f"- {agent}: {path}" for agent, path in existing)
        if not Confirm.ask(
            f"[yellow]将删除 {len(existing)} 个本地目录[/yellow]:\n{preview}\n继续?",
            default=False,
        ):
            rprint("[dim]已取消[/dim]")
            raise typer.Exit(code=0)

    deleted: list[tuple[str, Path]] = []
    failed: list[tuple[str, Path, str]] = []
    for agent, path in existing:
        try:
            _remove_path(path)
            deleted.append((agent, path))
        except OSError as e:
            failed.append((agent, path, str(e)))

    removed_records = state.remove_installs(slug=slug, agents=agent_set)

    lines = [f"[green]✓ 已卸载[/green] [cyan]{slug}[/cyan]"]
    for agent, path in deleted:
        lines.append(f"[dim]Agent[/dim]: {agent}  [dim]目录[/dim]: {path}")
    if missing:
        lines.append(f"[yellow]已清理缺失目录的安装记录[/yellow]: {len(missing)} 条")
    if removed_records:
        lines.append(f"[dim]安装记录[/dim]: 已清理 {len(removed_records)} 条")
    if failed:
        for agent, path, err in failed:
            lines.append(f"[red]删除失败[/red] {agent}: {path} ({err})")
    rprint(Panel("\n".join(lines), expand=False))

    if failed:
        raise typer.Exit(code=1)


@app.command(name="delete")
def delete_cmd(
    slug: Annotated[str, typer.Argument(help="例如 @community/marketplace-guide")],
    yes: Annotated[
        bool,
        typer.Option("--yes", "-y", help="直接下架，不再二次确认"),
    ] = False,
) -> None:
    """下架自己管理的 skill（可恢复，不会删除历史版本）"""
    _validate_slug(slug)
    api.require_login()
    sk = api.get_skill(slug)
    if sk.get("status") == "archived":
        rprint(f"[yellow]已经下架[/yellow]: {slug}")
        return
    if not yes and not Confirm.ask(
        f"[yellow]确认下架[/yellow] {slug}? 下架后列表/搜索默认不展示，安装会被拒绝。",
        default=False,
    ):
        rprint("[dim]已取消[/dim]")
        raise typer.Exit(code=0)
    result = api.archive_skill(slug)
    rprint(
        Panel(
            f"[green]✓ 已下架[/green] [cyan]{slug}[/cyan]\n"
            f"[dim]状态[/dim]: {result.get('status')}",
            expand=False,
        )
    )


@app.command()
def restore(
    slug: Annotated[str, typer.Argument(help="例如 @community/marketplace-guide")],
) -> None:
    """恢复自己管理的已下架 skill"""
    _validate_slug(slug)
    api.require_login()
    result = api.restore_skill(slug)
    rprint(
        Panel(
            f"[green]✓ 已恢复[/green] [cyan]{slug}[/cyan]\n"
            f"[dim]状态[/dim]: {result.get('status')}",
            expand=False,
        )
    )


@app.command()
def access(
    action_or_slug: Annotated[
        str,
        typer.Argument(
            help=(
                "@author/name 查看权限；或 set/grant/revoke，例如 "
                "agent-skills access set @author/name --install company"
            )
        ),
    ],
    slug_or_handle: Annotated[
        str | None,
        typer.Argument(help="set/grant/revoke 时填写 slug；show 时可省略"),
    ] = None,
    handle: Annotated[
        str | None,
        typer.Argument(help="grant/revoke handle, for example demo-user"),
    ] = None,
    install_access: Annotated[
        str | None,
        typer.Option("--install", help="anonymous / company / restricted"),
    ] = None,
    visibility: Annotated[
        str | None,
        typer.Option("--visibility", help="listed / unlisted / restricted / match_install_access"),
    ] = None,
) -> None:
    """查看或修改自己管理的 Skill 权限"""
    action = action_or_slug.strip()
    api.require_login()

    if action in {"show", "get"}:
        if not slug_or_handle:
            rprint("[red]✗ 缺少 slug[/red]: agent-skills access show @author/name")
            raise typer.Exit(code=2)
        slug = _validate_slug(slug_or_handle)
        _render_access_panel(slug, api.get_access(slug))
        return

    if action == "set":
        if not slug_or_handle:
            rprint("[red]✗ 缺少 slug[/red]: agent-skills access set @author/name --install company")
            raise typer.Exit(code=2)
        slug = _validate_slug(slug_or_handle)
        if not install_access and not visibility:
            rprint("[red]✗ 至少指定一个字段[/red]: --install 或 --visibility")
            raise typer.Exit(code=2)
        if install_access and install_access not in INSTALL_ACCESS_CHOICES:
            rprint(
                f"[red]✗ 未知安装权限[/red]: {install_access}（支持 {', '.join(INSTALL_ACCESS_CHOICES)}）"
            )
            raise typer.Exit(code=2)
        if visibility and visibility not in VISIBILITY_CHOICES:
            rprint(
                f"[red]✗ 未知可见性[/red]: {visibility}（支持 {', '.join(VISIBILITY_CHOICES)}）"
            )
            raise typer.Exit(code=2)
        data = api.update_access(slug, install_access=install_access, visibility=visibility)
        rprint(f"[green]✓ 权限已更新[/green]: {slug}")
        _render_access_panel(slug, data)
        return

    if action in {"grant", "revoke"}:
        if not slug_or_handle or not handle:
            rprint(f"[red]✗ 用法[/red]: agent-skills access {action} @author/name demo-user")
            raise typer.Exit(code=2)
        slug = _validate_slug(slug_or_handle)
        data = api.grant_access(slug, handle) if action == "grant" else api.revoke_access(slug, handle)
        verb = "已授权" if action == "grant" else "已移除授权"
        rprint(f"[green]✓ {verb}[/green]: {slug} @{handle.lstrip('@')}")
        merged = api.get_access(slug)
        merged["grants"] = data.get("grants", merged.get("grants", []))
        _render_access_panel(slug, merged)
        return

    slug = _validate_slug(action)
    if slug_or_handle or handle or install_access or visibility:
        rprint("[red]✗ 查看权限时只需要 slug[/red]: agent-skills access @author/name")
        raise typer.Exit(code=2)
    _render_access_panel(slug, api.get_access(slug))


def _clean_skill_name(raw: str) -> str:
    return (
        re.sub(r"[^a-z0-9-]+", "-", raw.strip().lower())
        .strip("-")[:50]
    )


def _suggest_display_name(name: str) -> str:
    return " ".join(part.capitalize() for part in re.split(r"[-_]+", name) if part)


def _suggest_display_description(description: str) -> str:
    first_line = next((line.strip() for line in description.splitlines() if line.strip()), "")
    return first_line[:107] + "..." if len(first_line) > 110 else first_line


def _write_skill_frontmatter(skill_dir: Path, metadata: dict) -> None:
    skill_md = skill_dir / "SKILL.md"
    post = frontmatter.load(skill_md)
    post.metadata.update(metadata)
    skill_md.write_text(frontmatter.dumps(post), encoding="utf-8")


def _ask_skill_name(default: str) -> str:
    while True:
        value = Prompt.ask("SKILL.md name", default=default).strip()
        if SKILL_NAME_RE.match(value):
            return value
        rprint("[red]name 仅支持小写字母、数字和短横线，长度 1-50[/red]")


def _parse_skill_md(skill_dir: Path, *, interactive: bool) -> tuple[str, str, dict]:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        rprint(f"[red]✗ 未找到 SKILL.md[/red]: {skill_md}")
        raise typer.Exit(code=2)
    post = frontmatter.load(skill_md)
    fm = dict(post.metadata)
    name = str(fm.get("name") or "").strip()
    description = str(fm.get("description") or "").strip()
    updates: dict[str, str] = {}
    if not name:
        if not interactive:
            rprint("[red]✗ SKILL.md frontmatter 缺少 [bold]name[/bold] 字段[/red]")
            raise typer.Exit(code=2)
        default_name = _clean_skill_name(skill_dir.name) or "my-skill"
        rprint("[yellow]SKILL.md frontmatter 缺少 name，将写回本地文件。[/yellow]")
        name = _ask_skill_name(default_name)
        updates["name"] = name
    elif not SKILL_NAME_RE.match(name):
        rprint("[red]✗ SKILL.md frontmatter.name 仅支持小写字母、数字和短横线，长度 1-50[/red]")
        raise typer.Exit(code=2)
    if not description:
        if not interactive:
            rprint("[red]✗ SKILL.md frontmatter 缺少 [bold]description[/bold] 字段[/red]")
            raise typer.Exit(code=2)
        rprint("[yellow]SKILL.md frontmatter 缺少 description，将写回本地文件。[/yellow]")
        while not description:
            description = Prompt.ask("SKILL.md description").strip()
            if not description:
                rprint("[red]description 不能为空[/red]")
        updates["description"] = description

    display_name = str(fm.get("display_name") or "").strip()
    if interactive and not display_name:
        display_name = Prompt.ask("卡片标题", default=_suggest_display_name(name)).strip()
        if display_name:
            updates["display_name"] = display_name

    display_description = str(fm.get("display_description") or "").strip()
    if interactive and not display_description:
        suggested = _suggest_display_description(description)
        display_description = Prompt.ask("卡片短描述", default=suggested).strip()
        if display_description:
            updates["display_description"] = display_description

    if updates:
        _write_skill_frontmatter(skill_dir, updates)
        fm.update(updates)
        rprint("[dim]已写回 SKILL.md 发布元信息。[/dim]")

    return str(name), str(description), fm


def _skill_version(fm: dict) -> str:
    version = fm.get("version")
    return str(version).strip() if version else "0.1.0"


def _suggest_patch_version(version: str) -> str:
    match = re.match(r"^(\d+)\.(\d+)\.(\d+)(.*)$", version)
    if not match:
        return f"{version}.1"
    return f"{match.group(1)}.{match.group(2)}.{int(match.group(3)) + 1}{match.group(4) or ''}"


def _write_skill_version(skill_dir: Path, version: str) -> None:
    skill_md = skill_dir / "SKILL.md"
    _write_skill_frontmatter(skill_dir, {"version": version})


def _ensure_publish_version(
    *,
    skill_dir: Path,
    target_slug: str,
    version: str,
    current_version: str | None,
    yes: bool,
) -> str:
    versions_data = api.get_skill_versions(target_slug)
    existing_versions = {
        str(item.get("version") or "")
        for item in versions_data.get("items", [])
    }
    if version not in existing_versions:
        return version

    suggested = _suggest_patch_version(current_version or version)
    if yes:
        rprint(
            f"[red]✗ 版本已存在[/red]: {target_slug} v{version}\n"
            f"  请先把 SKILL.md version 改为新版本，例如 {suggested}"
        )
        raise typer.Exit(code=1)

    rprint(
        f"[yellow]版本已存在[/yellow]: {target_slug} v{version}\n"
        f"[dim]当前线上版本是 {current_version or version}，建议发布为 {suggested}[/dim]"
    )
    while True:
        new_version = Prompt.ask("新版本号", default=suggested).strip()
        if new_version and new_version != version:
            break
        rprint("[red]新版本号必须和当前版本不同[/red]")
    _write_skill_version(skill_dir, new_version)
    rprint(f"[dim]已更新本地 SKILL.md version 为 {new_version}[/dim]")
    return new_version


@app.command()
def publish(
    path: Annotated[
        Path,
        typer.Argument(help="skill 目录（默认当前目录）"),
    ] = Path("."),
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="business / tool / method / cli"),
    ] = None,
    tags: Annotated[
        str | None,
        typer.Option("--tags", help="逗号分隔，最多 5 个"),
    ] = None,
    example: Annotated[
        str | None,
        typer.Option("--example", help="使用示例"),
    ] = None,
    target_slug: Annotated[
        str | None,
        typer.Option("--slug", help="更新已有 Skill 的 slug，例如 @community/marketplace-guide"),
    ] = None,
    yes: Annotated[
        bool,
        typer.Option("--yes", "-y", help="跳过覆盖确认（CI / 脚本场景）"),
    ] = False,
) -> None:
    """把本地 skill 目录打包发布到 marketplace"""
    skill_dir = path.expanduser().resolve()
    if not skill_dir.is_dir():
        rprint(f"[red]✗ 目录不存在[/red]: {skill_dir}")
        raise typer.Exit(code=2)

    name, description, fm = _parse_skill_md(skill_dir, interactive=not yes)
    version = _skill_version(fm)
    if not str(fm.get("version") or "").strip():
        _write_skill_version(skill_dir, version)
        rprint(f"[dim]SKILL.md 未写 version，已补为 {version}[/dim]")

    user = api.require_login()

    if target_slug:
        slug = _validate_slug(target_slug)
        existing = api.try_get_skill(slug)
        if not existing:
            rprint(f"[red]✗ --slug 指向的 Skill 不存在[/red]: {slug}")
            raise typer.Exit(code=1)
        if str(existing.get("name") or "") != name:
            rprint(
                f"[red]✗ 上传目录和目标 Skill 不匹配[/red]\n"
                f"  目标 Skill: {existing.get('name')}\n"
                f"  本地 SKILL.md: {name}"
            )
            raise typer.Exit(code=2)
        operation = "发布已有 Skill 的新版本"
        version = _ensure_publish_version(
            skill_dir=skill_dir,
            target_slug=slug,
            version=version,
            current_version=str(existing.get("version") or ""),
            yes=yes,
        )
        if category or tags or example:
            rprint("[dim]--slug 更新会沿用线上 category / tags / example，本次忽略这些参数。[/dim]")
    else:
        slug = f"@{user.get('handle')}/{name}"
        existing = api.try_get_skill(slug)
        operation = "更新自己的 Skill" if existing else "新建 Skill"
        if existing:
            version = _ensure_publish_version(
                skill_dir=skill_dir,
                target_slug=slug,
                version=version,
                current_version=str(existing.get("version") or ""),
                yes=yes,
            )

    rprint(
        Panel(
            f"[bold cyan]{slug}[/bold cyan] [dim]v{version}[/dim]\n"
            f"[dim]类型[/dim]: {operation}\n"
            f"{description}\n[dim]目录[/dim]: {skill_dir}",
            title="即将发布",
            expand=False,
        )
    )
    if target_slug:
        category = category or "tool"
    else:
        if not category:
            category = Prompt.ask(
                "选择分类",
                choices=CATEGORIES,
                default="tool",
            )
        elif category not in CATEGORIES:
            rprint(f"[red]✗ 未知分类[/red]: {category}")
            raise typer.Exit(code=2)

        if tags is None:
            tags = Prompt.ask("标签（逗号分隔，回车跳过）", default="") or None
        if example is None:
            example = Prompt.ask("使用示例（回车跳过）", default="") or None

    rprint("[dim]正在打包...[/dim]")
    zip_path = packager.package_dir(skill_dir)
    try:
        rprint(f"[dim]正在上传 {zip_path.stat().st_size // 1024} KB ...[/dim]")
        if target_slug:
            sk = api.publish_version(slug, zip_path)
        else:
            sk = api.publish(zip_path, category=category, tags=tags, example=example)
    finally:
        try:
            zip_path.unlink()
        except OSError:
            pass

    base = cfg_mod.load_config().get(
        "api_base_url",
        cfg_mod.DEFAULT_API_BASE_URL,
    ).rstrip("/")
    detail_url = f"{base}/skills/{sk.get('slug', name)}"
    rprint(
        Panel(
            f"[green]✓ 发布成功[/green] [cyan]{sk.get('slug')}[/cyan] v{sk.get('version', '?')}\n"
            f"[dim]详情页[/dim]: {detail_url}",
            expand=False,
        )
    )


# ---------------- update / doctor commands ----------------


def _install_cli_release(release: dict) -> None:
    wheel_url = str(release.get("wheel_url") or "")
    if not wheel_url:
        rprint("[red]✗ release manifest 缺少 wheel_url[/red]")
        raise typer.Exit(code=1)

    uv_bin = shutil.which("uv")
    if not uv_bin:
        rprint(
            "[red]✗ 未找到 uv[/red]\n"
            "  请先安装 uv，或重新运行 Marketplace 的 install.sh / install.ps1"
        )
        raise typer.Exit(code=1)

    rprint(f"[dim]正在下载[/dim] {wheel_url}")
    wheel_bytes = api.download_url(wheel_url)

    expected_sha = str(release.get("sha256") or "")
    if expected_sha:
        actual_sha = hashlib.sha256(wheel_bytes).hexdigest()
        if actual_sha != expected_sha:
            rprint("[red]✗ wheel sha256 校验失败[/red]")
            rprint(f"  expected: {expected_sha}")
            rprint(f"  actual:   {actual_sha}")
            raise typer.Exit(code=1)

    filename = Path(wheel_url.split("?", 1)[0]).name or "agent_skills-latest.whl"
    with tempfile.TemporaryDirectory(prefix="agent-skills-") as tmp:
        wheel_path = Path(tmp) / filename
        wheel_path.write_bytes(wheel_bytes)
        cmd = [uv_bin, "tool", "install", "--force", str(wheel_path)]
        rprint(f"[dim]正在执行[/dim] {' '.join(cmd)}")
        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            rprint(f"[red]✗ uv 安装失败[/red]: exit {e.returncode}")
            raise typer.Exit(code=e.returncode) from None


@self_app.command("check")
def self_check() -> None:
    """检查 agent-skills CLI 是否有新版本"""
    release = api.cli_release()
    latest = str(release.get("version", "?"))
    if _is_newer_version(latest, __version__):
        rprint(
            f"[yellow]有新版本[/yellow]: 当前 v{__version__} → 最新 v{latest}\n"
            f"运行 [cyan]agent-skills self update[/cyan] 更新"
        )
    else:
        rprint(f"[green]✓ 已是最新[/green]: v{__version__}")


@self_app.command("update")
def self_update(
    force: Annotated[
        bool,
        typer.Option("--force", "-f", help="即使版本相同也重新安装"),
    ] = False,
) -> None:
    """更新 agent-skills CLI 本体"""
    release = api.cli_release()
    latest = str(release.get("version", ""))
    if not force and not _is_newer_version(latest, __version__):
        rprint(f"[green]✓ 已是最新[/green]: v{__version__}")
        return

    _install_cli_release(release)
    rprint(f"[green]✓ CLI 更新完成[/green]: v{latest}")


@app.command()
def doctor() -> None:
    """检查 CLI、API、uv 和本机 agent 目录状态"""
    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("检查项")
    table.add_column("状态")
    table.add_column("详情")

    cfg = cfg_mod.load_config()
    api_base = str(cfg.get("api_base_url", ""))

    release = None
    release_error: Exception | None = None
    try:
        release = api.try_cli_release()
        if not release:
            raise RuntimeError("release_not_found")
    except Exception as e:
        release_error = e

    latest_version = str(release.get("version") or "") if release else ""
    if _is_newer_version(latest_version, __version__):
        table.add_row(
            "CLI",
            "[yellow]update[/yellow]",
            f"agent-skills v{__version__}; latest v{latest_version}; run agent-skills self update",
        )
    else:
        table.add_row("CLI", "[green]ok[/green]", f"agent-skills v{__version__}")
    table.add_row("OS", "[green]ok[/green]", platform.platform())

    uv_bin = shutil.which("uv")
    if uv_bin:
        table.add_row("uv", "[green]ok[/green]", uv_bin)
    else:
        table.add_row("uv", "[red]missing[/red]", "install.sh / install.ps1 会自动安装")

    try:
        health = api.health()
        table.add_row("Marketplace API", "[green]ok[/green]", f"{api_base} ({health.get('status')})")
    except Exception as e:
        table.add_row("Marketplace API", "[red]failed[/red]", f"{api_base} ({e})")

    if release:
        table.add_row("CLI release", "[green]ok[/green]", f"latest v{release.get('version')}")
    else:
        table.add_row("CLI release", "[yellow]missing[/yellow]", str(release_error))

    detected = agent_detect.detect_installed_agents()
    table.add_row(
        "Agents",
        "[green]ok[/green]" if detected else "[yellow]unknown[/yellow]",
        ", ".join(detected) if detected else "首次 install 时会询问",
    )

    installed = state.load_installed()
    table.add_row(
        "Installed skills",
        "[green]ok[/green]" if installed else "[dim]empty[/dim]",
        f"{len(installed)} records ({state.INSTALLED_PATH})",
    )

    rprint(table)


@app.command()
def outdated() -> None:
    """查看本机已安装 skill 是否有新版本"""
    rows = state.load_installed()
    if not rows:
        rprint(f"[yellow]还没有本机安装记录[/yellow]\n[dim]位置: {state.INSTALLED_PATH}[/dim]")
        return

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Skill", style="cyan")
    table.add_column("Agent")
    table.add_column("当前")
    table.add_column("最新")
    table.add_column("状态")

    has_updates = False
    for row in rows:
        slug = str(row.get("slug") or "")
        current = str(row.get("version") or "?")
        agent = str(row.get("agent") or "?")
        sk = api.try_get_skill(slug)
        if sk is None:
            table.add_row(slug, agent, current, "-", "[red]已下架/不存在[/red]")
            continue
        latest = str(sk.get("version") or "?")
        if _is_newer_version(latest, current):
            has_updates = True
            status = "[yellow]可更新[/yellow]"
        else:
            status = "[green]最新[/green]"
        table.add_row(slug, agent, current, latest, status)

    rprint(table)
    if has_updates:
        rprint("[dim]运行 [cyan]agent-skills update --all[/cyan] 更新全部可更新 skill[/dim]")


def _update_one_installed(row: dict, *, force: bool = False) -> bool:
    slug = str(row.get("slug") or "")
    if not slug:
        return False

    current = str(row.get("version") or "")
    sk = api.get_skill(slug)
    latest = str(sk.get("version") or "")
    if not force and not _is_newer_version(latest, current):
        rprint(f"[dim]跳过 {slug}: 已是 v{current}[/dim]")
        return False

    agent = str(row.get("agent") or "")
    if agent not in agent_detect.VALID_AGENTS:
        rprint(f"[yellow]跳过 {slug}: 未知 agent {agent}[/yellow]")
        return False

    skill_name = str(sk.get("name") or row.get("name") or slug.split("/", 1)[-1])
    dest_value = row.get("path")
    dest = Path(str(dest_value)).expanduser() if dest_value else None

    rprint(f"[dim]正在更新[/dim] {slug} {current or '?'} → {latest}")
    zip_bytes = api.download(slug)
    installed_path = installer.install_zip(
        zip_bytes,
        agent,
        skill_name,
        yes=True,
        dest=dest,
    )
    state.record_install(
        slug=slug,
        name=skill_name,
        version=latest,
        agent=agent,
        path=installed_path,
        installed_at=int(time.time()),
    )
    try:
        api.install_event(slug, agent, latest)
    except Exception:
        pass
    rprint(f"[green]✓ 已更新[/green] {slug} v{latest}")
    return True


@app.command(name="update")
def update_cmd(
    slug: Annotated[
        str | None,
        typer.Argument(help="例如 @community/marketplace-guide；不传则需要 --all"),
    ] = None,
    all_: Annotated[
        bool,
        typer.Option("--all", help="更新所有本机已安装 skill"),
    ] = False,
    force: Annotated[
        bool,
        typer.Option("--force", "-f", help="即使版本相同也重新安装"),
    ] = False,
) -> None:
    """更新本机已安装的 skill"""
    rows = state.load_installed()
    if not rows:
        rprint(f"[yellow]还没有本机安装记录[/yellow]\n[dim]位置: {state.INSTALLED_PATH}[/dim]")
        return
    api.require_login()

    if all_:
        targets = rows
    elif slug:
        _validate_slug(slug)
        targets = [row for row in rows if row.get("slug") == slug]
        if not targets:
            rprint(f"[yellow]本机没有安装记录[/yellow]: {slug}")
            return
    else:
        rprint("[red]✗ 请传 slug，或使用 --all[/red]")
        raise typer.Exit(code=2)

    changed = 0
    for row in targets:
        if _update_one_installed(row, force=force):
            changed += 1
    rprint(f"[green]完成[/green]：更新 {changed} 个 skill")


# ---------------- config subcommands ----------------


@config_app.command("show")
def config_show() -> None:
    """显示当前所有配置"""
    cfg = cfg_mod.load_config()
    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Key")
    table.add_column("Value")
    for k, v in cfg.items():
        table.add_row(k, str(v))
    rprint(table)
    rprint(f"[dim]位置: {cfg_mod.CONFIG_PATH}[/dim]")


@config_app.command("get")
def config_get(key: Annotated[str, typer.Argument()]) -> None:
    """读单个配置项"""
    val = cfg_mod.get_value(key)
    if val is None:
        rprint(f"[yellow]未设置[/yellow]: {key}")
        raise typer.Exit(code=1)
    rprint(val)


@config_app.command("set")
def config_set(
    key: Annotated[str, typer.Argument()],
    value: Annotated[str, typer.Argument()],
) -> None:
    """写单个配置项"""
    cfg_mod.set_value(key, value)
    rprint(f"[green]✓[/green] {key} = {value}")


if __name__ == "__main__":
    app()
