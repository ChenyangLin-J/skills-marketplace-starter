# Install Targets

Read this file when the user asks where Skills are installed, what the install script prompts mean, or why Codex / Claude Code / Cursor / Antigravity behave differently.

## One-Click CLI Install

macOS / Linux:

```bash
export PATH="$HOME/.local/bin:$PATH"; curl -fsSL http://localhost:3000/install.sh | bash
```

Windows PowerShell:

```powershell
irm http://localhost:3000/install.ps1 | iex
```

The script installs or updates the `agent-skills` CLI, writes the Marketplace API config, optionally installs `@community/marketplace-guide`, and then runs `agent-skills doctor`.

On macOS / Linux, keep the leading `export PATH="$HOME/.local/bin:$PATH"` in the copied command. It updates the current terminal before the installer runs, so the user can usually type `agent-skills login` immediately after the script exits.

## One-Click Single Skill Install

Single Skill scripts, such as `/api/skills/@author/name/install.sh`, can install an anonymous Skill without the CLI. If `agent-skills` is missing, the script should still remind the user to install the CLI because login, search, updates, and feedback work better from the agent once the CLI is available.

For `company` or `restricted` Skills, the script needs CLI credentials written by `agent-skills login`. If the user has no CLI or no login, tell them to install the CLI, run `agent-skills login`, confirm with `agent-skills whoami`, then retry the one-click script.

## Agent Targets

| Target | Directory | Current status |
| --- | --- | --- |
| Codex | `~/.codex/skills/<skill-name>/` | Main supported target. |
| Claude Code | `~/.claude/skills/<skill-name>/` | Main supported target. |
| Cursor | `~/.cursor/skills/<skill-name>/` | Cursor native personal Skill directory. |
| Antigravity | `~/.antigravity/skills/<skill-name>/` | Experimental until manually verified. |

Use the same Skill package for every target. The target only changes where files land and how the host agent discovers them.

## Prompt Input

When the installer asks where to install the guide:

| Input | Meaning |
| --- | --- |
| `1` | Codex |
| `2` | Claude Code |
| `3` | Cursor |
| `4` | Antigravity |
| `5` / `skip` | Skip guide install |
| `12`, `1,2`, `codex,claude`, `all` | Install to multiple targets |

If `agent-skills` is not found right after install, ask the user to run:

```bash
export PATH="$HOME/.local/bin:$PATH"
agent-skills login
```

## Zip Download

Manual zip download names should use the bare Skill name:

```text
marketplace-guide.zip
```

Marketplace metadata lives inside the zip:

```text
skill-marketplace.json
```

It records slug, author, name, version, category, tags, and Marketplace URL. Do not ask users to rename local folders based on version numbers; local Skill directories should normally be the bare Skill name.
