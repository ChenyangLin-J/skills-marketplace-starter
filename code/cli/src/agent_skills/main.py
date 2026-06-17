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
    help="Read and write ~/.agent-skills/config.toml",
    no_args_is_help=True,
)
app.add_typer(config_app, name="config")

self_app = typer.Typer(
    name="self",
    help="Check or update the agent-skills CLI",
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
            f"[dim]New agent-skills version v{latest}; run "
            f"[cyan]agent-skills self update[/cyan] to update.[/dim]"
        )


@app.callback()
def _root(
    ctx: typer.Context,
    version: Annotated[
        bool,
        typer.Option("--version", "-v", callback=_version_callback, is_eager=True, help="Show version"),
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
    table.add_column("Author", style="magenta")
    table.add_column("Description")
    table.add_column("Installs", justify="right", style="green")
    table.add_column("Likes", justify="right", style="yellow")
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
    table.add_column("Author", style="magenta", no_wrap=True, max_width=14)
    table.add_column("Status", no_wrap=True, max_width=8)
    table.add_column("Version", no_wrap=True, max_width=12)
    table.add_column("Installs", justify="right", style="green", no_wrap=True)
    table.add_column("Likes", justify="right", style="yellow", no_wrap=True)
    for item in items:
        table.add_row(
            str(item.get("slug") or ""),
            str(item.get("author") or ""),
            "Archived" if item.get("status") == "archived" else "Active",
            f"v{item.get('version')}" if item.get("version") else "",
            str(item.get("install_count", 0)),
            str(item.get("like_count", 0)),
        )
    return table


def _install_access_label(value: str) -> str:
    if value == "anonymous":
        return "Public install"
    if value == "restricted":
        return "Restricted install"
    return "Signed-in install"


def _visibility_label(value: str) -> str:
    if value == "unlisted":
        return "Unlisted link"
    if value == "restricted":
        return "Selected users"
    if value == "match_install_access":
        return "Match install access"
    return "Listed"


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
    table.add_row("Install access", _install_access_label(str(data.get("install_access") or "")))
    table.add_row("Visibility", _visibility_label(str(data.get("visibility") or "")))
    table.add_row("Granted users", ", ".join(handles) if handles else "[dim]Not set[/dim]")
    rprint(table)


@app.command()
def search(
    keyword: Annotated[str, typer.Argument(help="Search keyword")],
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="business / tool / method / cli"),
    ] = None,
    limit: Annotated[int, typer.Option("--limit", help="Maximum results to return")] = 50,
    full: Annotated[
        bool,
        typer.Option(
            "--full",
            help="Search full SKILL.md text; default searches name/description/tags",
        ),
    ] = False,
) -> None:
    """Search Skills. By default searches name/description/tags; add --full for full SKILL.md text."""
    if category and category not in CATEGORIES:
        rprint(f"[red]✗ Unknown category[/red]: {category} (supported: {', '.join(CATEGORIES)})")
        raise typer.Exit(code=2)
    data = api.list_skills(
        q=keyword, category=category, sort="installs", limit=limit, fulltext=full
    )
    items = data.get("items", [])
    if not items:
        hint = "" if full else "  [dim]Tip: add --full to search all SKILL.md text[/dim]"
        rprint(f"[yellow]No Skills matched '{keyword}'[/yellow]\n{hint}")
        return
    scope = "full text" if full else "name/description/tags"
    rprint(f"[dim]Total {data.get('total', len(items))} results (scope: {scope})[/dim]")
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
        typer.Option("--mine", help="List only Skills I manage, including archived ones"),
    ] = False,
) -> None:
    """List all Skills"""
    if category and category not in CATEGORIES:
        rprint(f"[red]✗ Unknown category[/red]: {category}")
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
            rprint("[yellow]You do not manage any Skills yet[/yellow]")
        else:
            rprint("[yellow]The Marketplace is empty. Publish the first Skill ✨[/yellow]")
        return
    scope = "managed Skills" if mine else "skill"
    rprint(f"[dim]Total {data.get('total', len(items))} {scope} (sorted by {sort})[/dim]")
    rprint(_render_mine_table(items) if mine else _render_table(items))


@app.command()
def info(
    slug: Annotated[str, typer.Argument(help="for example @community/marketplace-guide")],
    readme: Annotated[
        bool,
        typer.Option("--readme", help="Also show the SKILL.md body"),
    ] = False,
    example: Annotated[
        bool,
        typer.Option("--example", help="Also show the usage example"),
    ] = False,
    full: Annotated[
        bool,
        typer.Option("--full", help="Same as --readme + --example"),
    ] = False,
) -> None:
    """Show Skill details. By default shows metadata; add --full for readme and example."""
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
    meta.add_row("Author", sk.get("author", ""))
    meta.add_row("Category", sk.get("category", ""))
    meta.add_row("Tags", ", ".join(sk.get("tags") or []) or "[dim]None[/dim]")
    meta.add_row("Version", str(sk.get("version", "")))
    meta.add_row("Status", "Archived" if sk.get("status") == "archived" else "Active")
    meta.add_row("Installs", str(sk.get("install_count", 0)))
    meta.add_row("Weekly installs", f"+{sk.get('weekly_install_count', 0)}")
    meta.add_row("Likes", str(sk.get("like_count", 0)))

    updated_at = sk.get("updated_at")
    if updated_at:
        try:
            from datetime import datetime, timezone

            dt = datetime.fromtimestamp(int(updated_at), tz=timezone.utc).astimezone()
            meta.add_row("Updated at", dt.strftime("%Y-%m-%d %H:%M"))
        except (ValueError, OSError, TypeError):
            meta.add_row("Updated at", str(updated_at))
    rprint(meta)

    if show_readme:
        readme_text = sk.get("readme") or ""
        if readme_text:
            rprint("\n[bold]README[/bold]")
            rprint(Markdown(readme_text))
        else:
            rprint("\n[dim](No SKILL.md body)[/dim]")

    if show_example:
        example_text = sk.get("example")
        if example_text:
            rprint("\n[bold]Example[/bold]")
            rprint(Panel(example_text, expand=False))
        else:
            rprint("\n[dim](No example provided)[/dim]")

    if not show_readme and not show_example:
        rprint(
            f"\n[dim]💡 View full readme: agent-skills info {slug} --full[/dim]"
        )


@app.command()
def versions(
    slug: Annotated[str, typer.Argument(help="for example @community/marketplace-guide")],
) -> None:
    """Show Skill version history. Install uses the latest version by default."""
    _validate_slug(slug)
    data = api.get_skill_versions(slug)
    items = data.get("items", [])
    if not items:
        rprint(f"[yellow]No version records[/yellow]: {slug}")
        return

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Version", style="cyan")
    table.add_column("Status")
    table.add_column("Uploaded by")
    table.add_column("Uploaded at")

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
            "Current" if item.get("is_current") else "History",
            f"@{item.get('uploaded_by')}" if item.get("uploaded_by") else "",
            uploaded_time,
        )

    rprint(table)


@app.command()
def feedback(
    target: Annotated[
        str,
        typer.Argument(help="for example @community/marketplace-guide；or list to view received feedback"),
    ],
    kind: Annotated[
        str | None,
        typer.Option("--type", "-t", help="issue / suggestion / question / usage"),
    ] = None,
    message: Annotated[
        str | None,
        typer.Option("--message", "-m", help="Feedback message"),
    ] = None,
    agent: Annotated[
        str | None,
        typer.Option("--agent", "-a", help="codex / claude / cursor / antigravity"),
    ] = None,
    context: Annotated[
        str | None,
        typer.Option("--context", help="Optional context text"),
    ] = None,
    context_file: Annotated[
        Path | None,
        typer.Option("--context-file", help="Read optional context from a file"),
    ] = None,
    skill: Annotated[
        str | None,
        typer.Option("--skill", help="Only show one Skill when using feedback list"),
    ] = None,
    limit: Annotated[
        int,
        typer.Option("--limit", help="feedback list Maximum results to return"),
    ] = 50,
) -> None:
    """Send issues, suggestions, or usage feedback to the Skill author; feedback list shows received feedback."""
    if target == "list":
        api.require_login()
        if skill:
            _validate_slug(skill)
        data = api.list_feedback(skill=skill, limit=limit)
        items = data.get("items", [])
        if not items:
            scope = f" {skill}" if skill else ""
            rprint(f"[yellow]No feedback received{scope} yet[/yellow]")
            return
        rprint(f"[dim]Total {data.get('total', len(items))} feedback items[/dim]")
        rprint(_render_feedback_table(items))
        return

    slug = target
    _validate_slug(slug)
    api.require_login()
    sk = api.get_skill(slug)

    choices = ["issue", "suggestion", "question", "usage"]
    if kind is None:
        kind = Prompt.ask("Feedback type", choices=choices, default="issue")
    elif kind not in choices:
        rprint(f"[red]✗ Unknown feedback type[/red]: {kind} (supported: {', '.join(choices)})")
        raise typer.Exit(code=2)

    if message is None:
        message = Prompt.ask("Feedback message").strip()
    if not message.strip():
        rprint("[red]✗ Feedback message cannot be empty[/red]")
        raise typer.Exit(code=2)

    context_text = context or ""
    if context_file:
        try:
            context_text = context_file.expanduser().read_text(encoding="utf-8")
        except OSError as e:
            rprint(f"[red]✗ Failed to read context file[/red]: {e}")
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
            f"[green]✓ Feedback submitted[/green] #{result.get('id')}\n"
            f"[dim]Skill[/dim]: {slug}  [dim]Version[/dim]: {result.get('version') or sk.get('version')}",
            expand=False,
        )
    )


def _render_feedback_table(items: list[dict]) -> Table:
    table = Table(show_header=True, header_style="bold cyan", show_lines=False, expand=True)
    table.add_column("Skill", style="cyan", overflow="fold", max_width=32)
    table.add_column("Source", no_wrap=True, max_width=12)
    table.add_column("Feedback", ratio=2, min_width=16, overflow="fold")
    table.add_column("Submitted by", style="magenta", overflow="fold", max_width=20)
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
        typer.Option("--timeout", help="Seconds to wait for web login"),
    ] = 120,
) -> None:
    """Open browser login and save CLI credentials."""
    data = api.start_cli_login()
    authorize_url = str(data.get("authorize_url") or "")
    device_code = str(data.get("device_code") or "")
    interval = max(1, int(data.get("interval_seconds") or 2))
    if not authorize_url or not device_code:
        rprint("[red]✗ Server did not return complete login data[/red]")
        raise typer.Exit(code=1)

    rprint("[dim]Opening browser login...[/dim]")
    if not webbrowser.open(authorize_url, new=1, autoraise=True):
        rprint("[red]✗ Could not open browser; login failed[/red]")
        raise typer.Exit(code=1)

    deadline = time.time() + max(1, timeout)
    while time.time() < deadline:
        result = api.poll_cli_login(device_code)
        if result.get("status") == "ok":
            token = str(result.get("token") or "")
            user = result.get("user") or {}
            expires_at = int(result.get("expires_at") or 0)
            if not token or not user:
                rprint("[red]✗ Server login response is incomplete[/red]")
                raise typer.Exit(code=1)
            credentials.save_credentials(token, expires_at, user)
            rprint(
                Panel(
                    f"[green]✓ CLI logged in[/green]\n"
                    f"[dim]User[/dim]: {user.get('name') or user.get('handle')} (@{user.get('handle')})\n"
                    f"[dim]Credentials[/dim]: {credentials.CREDENTIALS_PATH}",
                    expand=False,
                )
            )
            return
        time.sleep(interval)

    rprint("[red]✗ Login timed out. Run agent-skills login again.[/red]")
    raise typer.Exit(code=1)


@app.command()
def whoami() -> None:
    """Show current CLI login identity"""
    user = api.require_login()
    table = Table.grid(padding=(0, 2))
    table.add_column(style="bold")
    table.add_column()
    table.add_row("Name", str(user.get("name") or ""))
    table.add_row("Handle", f"@{user.get('handle')}")
    table.add_row("Open ID", str(user.get("open_id") or ""))
    rprint(table)
    rprint(f"[dim]Credentials: {credentials.CREDENTIALS_PATH}[/dim]")


@app.command()
def logout() -> None:
    """Clear current CLI login state"""
    if credentials.get_token():
        try:
            api.cli_logout()
        except SystemExit:
            pass
    credentials.delete_credentials()
    rprint("[green]✓ CLI logged out[/green]")


@app.command()
def install(
    slug: Annotated[str, typer.Argument(help="for example @community/marketplace-guide")],
    target: Annotated[
        str | None,
        typer.Option("--target", "-t", help="1/2/3/4、12、all、codex、claude、cursor、antigravity"),
    ] = None,
    yes: Annotated[
        bool,
        typer.Option("--yes", "-y", help="Overwrite when target already exists"),
    ] = False,
) -> None:
    """Download a Skill and install it into an agent directory"""
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
        rprint("[yellow]Install skipped[/yellow]")
        return

    rprint(f"[dim]Downloading[/dim] {slug} v{version} ...")
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
            rprint(f"[yellow]⚠ Install event failed; installation is still complete: {e}[/yellow]")
            install_count = "?"
        installed.append((agent, dest, install_count))

    lines = [f"[green]✓ Installed[/green] [cyan]{slug}[/cyan] v{version}"]
    for agent, dest, install_count in installed:
        lines.append(
            f"[dim]Agent[/dim]: {agent}  [dim]Directory[/dim]: {dest}  "
            f"[dim]Total installs[/dim]: {install_count}"
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
    slug: Annotated[str, typer.Argument(help="for example @community/marketplace-guide")],
    target: Annotated[
        str | None,
        typer.Option("--target", "-t", help="1/2/3/4、12、all、codex、claude、cursor、antigravity"),
    ] = None,
    yes: Annotated[
        bool,
        typer.Option("--yes", "-y", help="Delete without confirmation"),
    ] = False,
) -> None:
    """Remove an installed Skill from local agent directories"""
    _validate_slug(slug)
    try:
        agents = agent_detect.resolve_agents(target) if target else None
    except ValueError as e:
        rprint(f"[red]✗ {e}[/red]")
        raise typer.Exit(code=2) from None
    if agents == []:
        rprint("[yellow]Delete skipped[/yellow]")
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
        hint = f"Retry with a target: agent-skills uninstall {slug} --target claude"
        rprint(f"[yellow]No local install records or directories found[/yellow]: {slug}\n[dim]{hint}[/dim]")
        return

    existing = [(agent, path) for agent, path, _ in targets if path.exists()]
    missing = [(agent, path) for agent, path, recorded in targets if recorded and not path.exists()]

    if not existing and missing:
        removed = state.remove_installs(slug=slug, agents=agent_set)
        rprint(
            f"[yellow]No local directory found; cleaned {len(removed)} install records[/yellow]: {slug}"
        )
        return

    if not yes:
        preview = "\n".join(f"- {agent}: {path}" for agent, path in existing)
        if not Confirm.ask(
            f"[yellow]Will delete {len(existing)} local directories[/yellow]:\n{preview}\nContinue?",
            default=False,
        ):
            rprint("[dim]Cancelled[/dim]")
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

    lines = [f"[green]✓ Uninstalled[/green] [cyan]{slug}[/cyan]"]
    for agent, path in deleted:
        lines.append(f"[dim]Agent[/dim]: {agent}  [dim]Directory[/dim]: {path}")
    if missing:
        lines.append(f"[yellow]Cleaned install records with missing directories[/yellow]: {len(missing)}")
    if removed_records:
        lines.append(f"[dim]Install records[/dim]: cleaned {len(removed_records)}")
    if failed:
        for agent, path, err in failed:
            lines.append(f"[red]Delete failed[/red] {agent}: {path} ({err})")
    rprint(Panel("\n".join(lines), expand=False))

    if failed:
        raise typer.Exit(code=1)


@app.command(name="delete")
def delete_cmd(
    slug: Annotated[str, typer.Argument(help="for example @community/marketplace-guide")],
    yes: Annotated[
        bool,
        typer.Option("--yes", "-y", help="Archive without confirmation"),
    ] = False,
) -> None:
    """Archive a Skill you manage. It can be restored and version history is kept."""
    _validate_slug(slug)
    api.require_login()
    sk = api.get_skill(slug)
    if sk.get("status") == "archived":
        rprint(f"[yellow]Already archived[/yellow]: {slug}")
        return
    if not yes and not Confirm.ask(
        f"[yellow]Confirm archive[/yellow] {slug}? After archive, list/search will hide it by default and install will be rejected.",
        default=False,
    ):
        rprint("[dim]Cancelled[/dim]")
        raise typer.Exit(code=0)
    result = api.archive_skill(slug)
    rprint(
        Panel(
            f"[green]✓ Archived[/green] [cyan]{slug}[/cyan]\n"
            f"[dim]Status[/dim]: {result.get('status')}",
            expand=False,
        )
    )


@app.command()
def restore(
    slug: Annotated[str, typer.Argument(help="for example @community/marketplace-guide")],
) -> None:
    """Restore an archived Skill you manage"""
    _validate_slug(slug)
    api.require_login()
    result = api.restore_skill(slug)
    rprint(
        Panel(
            f"[green]✓ Restored[/green] [cyan]{slug}[/cyan]\n"
            f"[dim]Status[/dim]: {result.get('status')}",
            expand=False,
        )
    )


@app.command()
def access(
    action_or_slug: Annotated[
        str,
        typer.Argument(
            help=(
                "@author/name to show access, or set/grant/revoke, for example "
                "agent-skills access set @author/name --install company"
            )
        ),
    ],
    slug_or_handle: Annotated[
        str | None,
        typer.Argument(help="Provide slug for set/grant/revoke; optional for show"),
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
    """View or modify access for a Skill you manage"""
    action = action_or_slug.strip()
    api.require_login()

    if action in {"show", "get"}:
        if not slug_or_handle:
            rprint("[red]✗ Missing slug[/red]: agent-skills access show @author/name")
            raise typer.Exit(code=2)
        slug = _validate_slug(slug_or_handle)
        _render_access_panel(slug, api.get_access(slug))
        return

    if action == "set":
        if not slug_or_handle:
            rprint("[red]✗ Missing slug[/red]: agent-skills access set @author/name --install company")
            raise typer.Exit(code=2)
        slug = _validate_slug(slug_or_handle)
        if not install_access and not visibility:
            rprint("[red]✗ Specify at least one field[/red]: --install or --visibility")
            raise typer.Exit(code=2)
        if install_access and install_access not in INSTALL_ACCESS_CHOICES:
            rprint(
                f"[red]✗ Unknown install access[/red]: {install_access} (supported: {', '.join(INSTALL_ACCESS_CHOICES)})"
            )
            raise typer.Exit(code=2)
        if visibility and visibility not in VISIBILITY_CHOICES:
            rprint(
                f"[red]✗ Unknown visibility[/red]: {visibility} (supported: {', '.join(VISIBILITY_CHOICES)})"
            )
            raise typer.Exit(code=2)
        data = api.update_access(slug, install_access=install_access, visibility=visibility)
        rprint(f"[green]✓ Access updated[/green]: {slug}")
        _render_access_panel(slug, data)
        return

    if action in {"grant", "revoke"}:
        if not slug_or_handle or not handle:
            rprint(f"[red]✗ Usage[/red]: agent-skills access {action} @author/name demo-user")
            raise typer.Exit(code=2)
        slug = _validate_slug(slug_or_handle)
        data = api.grant_access(slug, handle) if action == "grant" else api.revoke_access(slug, handle)
        verb = "Granted" if action == "grant" else "Revoked"
        rprint(f"[green]✓ {verb}[/green]: {slug} @{handle.lstrip('@')}")
        merged = api.get_access(slug)
        merged["grants"] = data.get("grants", merged.get("grants", []))
        _render_access_panel(slug, merged)
        return

    slug = _validate_slug(action)
    if slug_or_handle or handle or install_access or visibility:
        rprint("[red]✗ Only pass slug when viewing access[/red]: agent-skills access @author/name")
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
        rprint("[red]name must use lowercase letters, numbers, and hyphens, 1-50 characters[/red]")


def _parse_skill_md(skill_dir: Path, *, interactive: bool) -> tuple[str, str, dict]:
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        rprint(f"[red]✗ SKILL.md not found[/red]: {skill_md}")
        raise typer.Exit(code=2)
    post = frontmatter.load(skill_md)
    fm = dict(post.metadata)
    name = str(fm.get("name") or "").strip()
    description = str(fm.get("description") or "").strip()
    updates: dict[str, str] = {}
    if not name:
        if not interactive:
            rprint("[red]✗ SKILL.md frontmatter is missing [bold]name[/bold][/red]")
            raise typer.Exit(code=2)
        default_name = _clean_skill_name(skill_dir.name) or "my-skill"
        rprint("[yellow]SKILL.md frontmatter is missing name; writing it back to the local file.[/yellow]")
        name = _ask_skill_name(default_name)
        updates["name"] = name
    elif not SKILL_NAME_RE.match(name):
        rprint("[red]✗ SKILL.md frontmatter.name must use lowercase letters, numbers, and hyphens, 1-50 characters[/red]")
        raise typer.Exit(code=2)
    if not description:
        if not interactive:
            rprint("[red]✗ SKILL.md frontmatter is missing [bold]description[/bold][/red]")
            raise typer.Exit(code=2)
        rprint("[yellow]SKILL.md frontmatter is missing description; writing it back to the local file.[/yellow]")
        while not description:
            description = Prompt.ask("SKILL.md description").strip()
            if not description:
                rprint("[red]description cannot be empty[/red]")
        updates["description"] = description

    display_name = str(fm.get("display_name") or "").strip()
    if interactive and not display_name:
        display_name = Prompt.ask("Card title", default=_suggest_display_name(name)).strip()
        if display_name:
            updates["display_name"] = display_name

    display_description = str(fm.get("display_description") or "").strip()
    if interactive and not display_description:
        suggested = _suggest_display_description(description)
        display_description = Prompt.ask("Card short description", default=suggested).strip()
        if display_description:
            updates["display_description"] = display_description

    if updates:
        _write_skill_frontmatter(skill_dir, updates)
        fm.update(updates)
        rprint("[dim]Wrote publish metadata back to SKILL.md.[/dim]")

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
            f"[red]✗ Version already exists[/red]: {target_slug} v{version}\n"
            f"  Change SKILL.md version to a new version first, for example {suggested}"
        )
        raise typer.Exit(code=1)

    rprint(
        f"[yellow]Version already exists[/yellow]: {target_slug} v{version}\n"
        f"[dim]Current marketplace version is {current_version or version}; suggested version is {suggested}[/dim]"
    )
    while True:
        new_version = Prompt.ask("New version", default=suggested).strip()
        if new_version and new_version != version:
            break
        rprint("[red]New version must differ from the current version[/red]")
    _write_skill_version(skill_dir, new_version)
    rprint(f"[dim]Updated local SKILL.md version to {new_version}[/dim]")
    return new_version


@app.command()
def publish(
    path: Annotated[
        Path,
        typer.Argument(help="Skill directory (defaults to current directory)"),
    ] = Path("."),
    category: Annotated[
        str | None,
        typer.Option("--category", "-c", help="business / tool / method / cli"),
    ] = None,
    tags: Annotated[
        str | None,
        typer.Option("--tags", help="Comma-separated, up to 5"),
    ] = None,
    example: Annotated[
        str | None,
        typer.Option("--example", help="Usage example"),
    ] = None,
    target_slug: Annotated[
        str | None,
        typer.Option("--slug", help="Slug of an existing Skill to update, for example @community/marketplace-guide"),
    ] = None,
    yes: Annotated[
        bool,
        typer.Option("--yes", "-y", help="Skip overwrite confirmation for CI or scripts"),
    ] = False,
) -> None:
    """Package and publish a local Skill directory to the marketplace"""
    skill_dir = path.expanduser().resolve()
    if not skill_dir.is_dir():
        rprint(f"[red]✗ Directorydoes not exist[/red]: {skill_dir}")
        raise typer.Exit(code=2)

    name, description, fm = _parse_skill_md(skill_dir, interactive=not yes)
    version = _skill_version(fm)
    if not str(fm.get("version") or "").strip():
        _write_skill_version(skill_dir, version)
        rprint(f"[dim]SKILL.md had no version; set it to {version}[/dim]")

    user = api.require_login()

    if target_slug:
        slug = _validate_slug(target_slug)
        existing = api.try_get_skill(slug)
        if not existing:
            rprint(f"[red]✗ --slug points to a Skill that does not exist[/red]: {slug}")
            raise typer.Exit(code=1)
        if str(existing.get("name") or "") != name:
            rprint(
                f"[red]✗ Uploaded directory does not match target Skill[/red]\n"
                f"  Target Skill: {existing.get('name')}\n"
                f"  Local SKILL.md: {name}"
            )
            raise typer.Exit(code=2)
        operation = "Publish a new version of an existing Skill"
        version = _ensure_publish_version(
            skill_dir=skill_dir,
            target_slug=slug,
            version=version,
            current_version=str(existing.get("version") or ""),
            yes=yes,
        )
        if category or tags or example:
            rprint("[dim]--slug updates keep existing category / tags / example, so these arguments are ignored.[/dim]")
    else:
        slug = f"@{user.get('handle')}/{name}"
        existing = api.try_get_skill(slug)
        operation = "Update your Skill" if existing else "Create new Skill"
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
            f"[dim]Operation[/dim]: {operation}\n"
            f"{description}\n[dim]Directory[/dim]: {skill_dir}",
            title="Ready to publish",
            expand=False,
        )
    )
    if target_slug:
        category = category or "tool"
    else:
        if not category:
            category = Prompt.ask(
                "Choose category",
                choices=CATEGORIES,
                default="tool",
            )
        elif category not in CATEGORIES:
            rprint(f"[red]✗ Unknown category[/red]: {category}")
            raise typer.Exit(code=2)

        if tags is None:
            tags = Prompt.ask("Tags (comma-separated, press Enter to skip)", default="") or None
        if example is None:
            example = Prompt.ask("Usage example (press Enter to skip)", default="") or None

    rprint("[dim]Packaging...[/dim]")
    zip_path = packager.package_dir(skill_dir)
    try:
        rprint(f"[dim]Uploading {zip_path.stat().st_size // 1024} KB ...[/dim]")
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
            f"[green]✓ Published[/green] [cyan]{sk.get('slug')}[/cyan] v{sk.get('version', '?')}\n"
            f"[dim]Detail page[/dim]: {detail_url}",
            expand=False,
        )
    )


# ---------------- update / doctor commands ----------------


def _install_cli_release(release: dict) -> None:
    wheel_url = str(release.get("wheel_url") or "")
    if not wheel_url:
        rprint("[red]✗ release manifest is missing wheel_url[/red]")
        raise typer.Exit(code=1)

    uv_bin = shutil.which("uv")
    if not uv_bin:
        rprint(
            "[red]✗ uv was not found[/red]\n"
            "  Install uv first, or rerun the Marketplace install.sh / install.ps1"
        )
        raise typer.Exit(code=1)

    rprint(f"[dim]Downloading[/dim] {wheel_url}")
    wheel_bytes = api.download_url(wheel_url)

    expected_sha = str(release.get("sha256") or "")
    if expected_sha:
        actual_sha = hashlib.sha256(wheel_bytes).hexdigest()
        if actual_sha != expected_sha:
            rprint("[red]✗ wheel sha256 check failed[/red]")
            rprint(f"  expected: {expected_sha}")
            rprint(f"  actual:   {actual_sha}")
            raise typer.Exit(code=1)

    filename = Path(wheel_url.split("?", 1)[0]).name or "agent_skills-latest.whl"
    with tempfile.TemporaryDirectory(prefix="agent-skills-") as tmp:
        wheel_path = Path(tmp) / filename
        wheel_path.write_bytes(wheel_bytes)
        cmd = [uv_bin, "tool", "install", "--force", str(wheel_path)]
        rprint(f"[dim]Running[/dim] {' '.join(cmd)}")
        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            rprint(f"[red]✗ uv install failed[/red]: exit {e.returncode}")
            raise typer.Exit(code=e.returncode) from None


@self_app.command("check")
def self_check() -> None:
    """Check whether a new agent-skills CLI version is available"""
    release = api.cli_release()
    latest = str(release.get("version", "?"))
    if _is_newer_version(latest, __version__):
        rprint(
            f"[yellow]New version available[/yellow]: Current v{__version__} → Latest v{latest}\n"
            f"Run [cyan]agent-skills self update[/cyan] to update"
        )
    else:
        rprint(f"[green]✓ Already up to date[/green]: v{__version__}")


@self_app.command("update")
def self_update(
    force: Annotated[
        bool,
        typer.Option("--force", "-f", help="Reinstall even when the version is the same"),
    ] = False,
) -> None:
    """Update the agent-skills CLI"""
    release = api.cli_release()
    latest = str(release.get("version", ""))
    if not force and not _is_newer_version(latest, __version__):
        rprint(f"[green]✓ Already up to date[/green]: v{__version__}")
        return

    _install_cli_release(release)
    rprint(f"[green]✓ CLI update complete[/green]: v{latest}")


@app.command()
def doctor() -> None:
    """Check CLI, API, uv, and local agent directories"""
    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Check")
    table.add_column("Status")
    table.add_column("Details")

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
        table.add_row("uv", "[red]missing[/red]", "install.sh / install.ps1 will install it automatically")

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
        ", ".join(detected) if detected else "Will ask on first install",
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
    """Check whether locally installed Skills have new versions"""
    rows = state.load_installed()
    if not rows:
        rprint(f"[yellow]No local install records yet[/yellow]\n[dim]Path: {state.INSTALLED_PATH}[/dim]")
        return

    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Skill", style="cyan")
    table.add_column("Agent")
    table.add_column("Current")
    table.add_column("Latest")
    table.add_column("Status")

    has_updates = False
    for row in rows:
        slug = str(row.get("slug") or "")
        current = str(row.get("version") or "?")
        agent = str(row.get("agent") or "?")
        sk = api.try_get_skill(slug)
        if sk is None:
            table.add_row(slug, agent, current, "-", "[red]Archived/does not exist[/red]")
            continue
        latest = str(sk.get("version") or "?")
        if _is_newer_version(latest, current):
            has_updates = True
            status = "[yellow]Update available[/yellow]"
        else:
            status = "[green]Latest[/green]"
        table.add_row(slug, agent, current, latest, status)

    rprint(table)
    if has_updates:
        rprint("[dim]Run [cyan]agent-skills update --all[/cyan] to update all outdated Skills[/dim]")


def _update_one_installed(row: dict, *, force: bool = False) -> bool:
    slug = str(row.get("slug") or "")
    if not slug:
        return False

    current = str(row.get("version") or "")
    sk = api.get_skill(slug)
    latest = str(sk.get("version") or "")
    if not force and not _is_newer_version(latest, current):
        rprint(f"[dim]Skip {slug}: already v{current}[/dim]")
        return False

    agent = str(row.get("agent") or "")
    if agent not in agent_detect.VALID_AGENTS:
        rprint(f"[yellow]Skip {slug}: unknown agent {agent}[/yellow]")
        return False

    skill_name = str(sk.get("name") or row.get("name") or slug.split("/", 1)[-1])
    dest_value = row.get("path")
    dest = Path(str(dest_value)).expanduser() if dest_value else None

    rprint(f"[dim]Updating[/dim] {slug} {current or '?'} → {latest}")
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
    rprint(f"[green]✓ Updated[/green] {slug} v{latest}")
    return True


@app.command(name="update")
def update_cmd(
    slug: Annotated[
        str | None,
        typer.Argument(help="for example @community/marketplace-guide；omit only when using --all"),
    ] = None,
    all_: Annotated[
        bool,
        typer.Option("--all", help="Update all locally installed Skills"),
    ] = False,
    force: Annotated[
        bool,
        typer.Option("--force", "-f", help="Reinstall even when the version is the same"),
    ] = False,
) -> None:
    """Update locally installed Skills"""
    rows = state.load_installed()
    if not rows:
        rprint(f"[yellow]No local install records yet[/yellow]\n[dim]Path: {state.INSTALLED_PATH}[/dim]")
        return
    api.require_login()

    if all_:
        targets = rows
    elif slug:
        _validate_slug(slug)
        targets = [row for row in rows if row.get("slug") == slug]
        if not targets:
            rprint(f"[yellow]No local install record[/yellow]: {slug}")
            return
    else:
        rprint("[red]✗ Pass a slug or use --all[/red]")
        raise typer.Exit(code=2)

    changed = 0
    for row in targets:
        if _update_one_installed(row, force=force):
            changed += 1
    rprint(f"[green]Done[/green]: updated {changed} Skills")


# ---------------- config subcommands ----------------


@config_app.command("show")
def config_show() -> None:
    """Show all current config values"""
    cfg = cfg_mod.load_config()
    table = Table(show_header=True, header_style="bold cyan")
    table.add_column("Key")
    table.add_column("Value")
    for k, v in cfg.items():
        table.add_row(k, str(v))
    rprint(table)
    rprint(f"[dim]Path: {cfg_mod.CONFIG_PATH}[/dim]")


@config_app.command("get")
def config_get(key: Annotated[str, typer.Argument()]) -> None:
    """Read one config value"""
    val = cfg_mod.get_value(key)
    if val is None:
        rprint(f"[yellow]Not set[/yellow]: {key}")
        raise typer.Exit(code=1)
    rprint(val)


@config_app.command("set")
def config_set(
    key: Annotated[str, typer.Argument()],
    value: Annotated[str, typer.Argument()],
) -> None:
    """Write one config value"""
    cfg_mod.set_value(key, value)
    rprint(f"[green]✓[/green] {key} = {value}")


if __name__ == "__main__":
    app()
