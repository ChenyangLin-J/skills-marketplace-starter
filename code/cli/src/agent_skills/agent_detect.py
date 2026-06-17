from __future__ import annotations

import os
from pathlib import Path

from rich.prompt import Prompt

from . import config as cfg_mod

AGENT_DIRS: dict[str, str] = {
    "codex": "~/.codex/skills/",
    "claude": "~/.claude/skills/",
    "cursor": "~/.cursor/skills/",
    "antigravity": "~/.antigravity/skills/",
}

VALID_AGENTS = list(AGENT_DIRS.keys())
AGENT_NUMBER_MAP: dict[str, str] = {
    "1": "codex",
    "2": "claude",
    "3": "cursor",
    "4": "antigravity",
}


def get_target_dir(agent: str) -> Path:
    override = os.environ.get("AGENT_SKILLS_TARGET_ROOT")
    if override:
        return Path(override).expanduser() / agent / "skills"
    return Path(AGENT_DIRS[agent]).expanduser()


def detect_installed_agents() -> list[str]:
    found: list[str] = []
    for name, path in AGENT_DIRS.items():
        parent = Path(path).expanduser().parent
        if parent.exists():
            found.append(name)
    return found


def parse_agent_selection(selection: str) -> tuple[list[str], list[str], bool]:
    normalized = (
        selection.strip()
        .lower()
        .replace(",", " ")
        .replace(";", " ")
        .replace("/", " ")
    )
    targets: list[str] = []
    invalid: list[str] = []
    skip = False

    def add(agent: str) -> None:
        if agent not in targets:
            targets.append(agent)

    for token in normalized.split():
        if token in {"skip", "none", "no", "n", "5"}:
            skip = True
            break
        if token == "all":
            for agent in VALID_AGENTS:
                add(agent)
            continue
        if token in VALID_AGENTS:
            add(token)
            continue
        if token.isdigit() and all(ch in "12345" for ch in token):
            for ch in token:
                if ch == "5":
                    skip = True
                    break
                add(AGENT_NUMBER_MAP[ch])
            if skip:
                break
            continue
        invalid.append(token)

    return targets, invalid, skip


def format_agent_menu(default: str | None = None) -> str:
    suffix = f"default {default}" if default else "multiple selections allowed"
    return (
        "Choose install targets (1 Codex / 2 Claude / 3 Cursor / 4 Antigravity / 5 Skip; "
        f"supports 12, 1,2, all; {suffix})"
    )


def resolve_agents(target_override: str | None) -> list[str]:
    if target_override:
        targets, invalid, skip = parse_agent_selection(target_override)
        if skip:
            return []
        if invalid or not targets:
            supported = ", ".join([*VALID_AGENTS, "1", "2", "3", "4", "all", "skip"])
            bad = ", ".join(invalid) if invalid else target_override
            raise ValueError(f"Unknown agent: {bad}. Supported: {supported}")
        return targets

    cfg = cfg_mod.load_config()
    default = cfg.get("default_agent", "ask")
    if default in VALID_AGENTS:
        return [default]

    detected = detect_installed_agents()
    if not detected:
        detected = VALID_AGENTS
    default_choice = detected[0]
    chosen = Prompt.ask(format_agent_menu(default_choice), default=default_choice)
    targets, invalid, skip = parse_agent_selection(chosen)
    if skip:
        return []
    if invalid or not targets:
        supported = "1 / 2 / 3 / 4 / 5 / all / " + " / ".join(VALID_AGENTS)
        bad = ", ".join(invalid) if invalid else chosen
        raise ValueError(f"Unknown agent: {bad}. Supported: {supported}")

    remember = Prompt.ask(
        "Remember the first target as default? (change later with [cyan]agent-skills config set default_agent <name>[/cyan])",
        choices=["y", "n"],
        default="y",
    )
    if remember == "y" and targets:
        cfg_mod.set_value("default_agent", targets[0])
    return targets


def resolve_agent(target_override: str | None) -> str:
    targets = resolve_agents(target_override)
    if not targets:
        raise ValueError("No install target selected")
    return targets[0]
