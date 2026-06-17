# CLI

The starter CLI is `agent-skills`.

## Development

```bash
cd code/cli
uv run agent-skills --help
```

Set the local API:

```bash
uv run agent-skills config set api_base_url http://localhost:3000
```

## Common Commands

```bash
agent-skills list
agent-skills search report
agent-skills info @community/marketplace-guide
agent-skills install @community/marketplace-guide --target codex
agent-skills feedback @community/marketplace-guide --type suggestion --message "Add a Cursor example"
agent-skills publish ./skills/my-skill
agent-skills update --all
agent-skills doctor
```

## Agent Targets

| Target | Directory |
| --- | --- |
| `codex` | `~/.codex/skills/` |
| `claude` | `~/.claude/skills/` |
| `cursor` | `~/.cursor/skills/` |
| `antigravity` | `~/.antigravity/skills/` |

For tests, set:

```bash
AGENT_SKILLS_TARGET_ROOT=/tmp/agent-skills-targets
```
