# agent-skills CLI

Command line interface for Skills Marketplace Starter.

## Development

```bash
uv run agent-skills --help
uv run agent-skills config set api_base_url http://localhost:3000
uv run agent-skills list
```

## Common Commands

```bash
agent-skills list
agent-skills search report
agent-skills info @community/marketplace-guide
agent-skills install @community/marketplace-guide --target codex
agent-skills feedback @community/marketplace-guide --type suggestion --message "Add a Cursor example"
agent-skills publish ./path/to/my-skill
agent-skills update --all
agent-skills doctor
```

## Config

Config lives under:

```text
~/.agent-skills/config.toml
```

Default API:

```text
http://localhost:3000
```

## Safe Install Test

```bash
HOME=/tmp/agent-skills-home \
AGENT_SKILLS_TARGET_ROOT=/tmp/agent-skills-targets \
uv run agent-skills install @community/marketplace-guide --target codex --yes
```
