# Test Checklist

## Web

```bash
cd code/app
npm run lint
npm run build
```

## CLI

```bash
cd code/cli
uv run agent-skills --help
uv run agent-skills doctor
```

## Install Smoke Test

```bash
HOME=/tmp/agent-skills-home \
AGENT_SKILLS_TARGET_ROOT=/tmp/agent-skills-targets \
UV_CACHE_DIR=/tmp/agent-skills-uv-cache \
UV_TOOL_DIR=/tmp/agent-skills-uv-tools \
uv run agent-skills install @community/marketplace-guide --target codex --yes
```

## Open Source Scan

```bash
rg -n "<company-name>|<internal-domain>|<private-user-handle>|APP_SECRET|client_secret|Bearer"
```

## Latest Validation Evidence

Date: 2026-06-17

Web:

```text
cd code/app
npm run lint
Result: passed.

npm run build
Result: passed.
Note: Next/Turbopack emitted the existing NFT tracing warning for the download route.
```

CLI:

```text
cd code/cli
uv run agent-skills --help
Result: passed. Command list rendered for agent-skills 0.1.0.
```

Auto seed and API:

```text
AGENT_SKILLS_DATA_DIR=/tmp/skills-marketplace-starter-data npm run dev -- --port 3100
curl 'http://localhost:3100/api/skills?limit=10'
Result: total = 4
Slugs:
- @community/marketplace-guide
- @community/skill-creator
- @demo/hello-world
- @demo/report-writer
```

CLI against local Web:

```text
HOME=/tmp/agent-skills-cli-home uv run agent-skills config set api_base_url http://localhost:3100
HOME=/tmp/agent-skills-cli-home uv run agent-skills list
HOME=/tmp/agent-skills-cli-home uv run agent-skills info @community/marketplace-guide
Result: passed. CLI listed 4 seed Skills and rendered marketplace-guide info.
```

Install smoke:

```text
HOME=/tmp/agent-skills-cli-home \
AGENT_SKILLS_TARGET_ROOT=/tmp/agent-skills-targets \
uv run agent-skills install @community/marketplace-guide --target codex --yes

Result:
/tmp/agent-skills-targets/codex/skills/marketplace-guide/SKILL.md exists.
```

Hygiene:

```text
Internal-name scan: no matches.
Runtime artifact scan: no .git, node_modules, .next, .venv, data, or .env.local remains in the starter folder.
```

## Seed Skill Refresh

Date: 2026-06-17

CLI against local Web:

```text
HOME=/tmp/agent-skills-prepush-home uv run agent-skills config set api_base_url http://localhost:3101
HOME=/tmp/agent-skills-prepush-home uv run agent-skills list
HOME=/tmp/agent-skills-prepush-home uv run agent-skills info @community/skill-creator --full
Result: passed. CLI listed 4 seed Skills and rendered the upgraded skill-creator readme.
```

Install smoke:

```text
HOME=/tmp/agent-skills-prepush-home \
AGENT_SKILLS_TARGET_ROOT=/tmp/agent-skills-prepush-targets \
uv run agent-skills install @community/skill-creator --target codex --yes

Result:
/tmp/agent-skills-prepush-targets/codex/skills/skill-creator/SKILL.md exists.
```

Web/API:

```text
curl 'http://localhost:3101/api/skills?limit=10'
Result: total = 4
Seed slugs include @community/marketplace-guide and @community/skill-creator.
```
