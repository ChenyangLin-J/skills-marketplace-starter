---
title: Install Your First Skill
description: Install the CLI, choose an agent target, and install the starter guide Skill.
audience: user
difficulty: beginner
duration: 3 min
category: Getting Started
order: 2
screenshot: /tutorials/screenshots/skill-detail.png
videoPlaceholder: Short install recording placeholder.
---

## Install The CLI

macOS / Linux:

```bash
export PATH="$HOME/.local/bin:$PATH"; curl -fsSL http://localhost:3000/install.sh | bash
```

Windows PowerShell:

```powershell
irm http://localhost:3000/install.ps1 | iex
```

The script installs `agent-skills`, writes `~/.agent-skills/config.toml`, and offers to install the starter guide Skill into one or more agent targets.

Target choices:

- `1` Codex
- `2` Claude Code
- `3` Cursor
- `4` Antigravity
- `5` Skip

You can also enter `12`, `1,2`, `codex,claude`, or `all`.

## Check The Install

```bash
agent-skills doctor
agent-skills --version
```

## Login

The starter uses local demo auth by default:

```bash
agent-skills login
agent-skills whoami
```

## Install A Skill Later

```bash
agent-skills install @community/marketplace-guide --target codex
```

Open the Skill detail page when you want a one-click script or a direct zip download.
