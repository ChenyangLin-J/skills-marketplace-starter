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

## Starter Favicon Refresh

Date: 2026-06-17

Scope:

```text
Replaced the starter favicon with a green Skills Marketplace monogram.
Versioned the favicon URL as /favicon.svg?v=starter-green to avoid stale browser cache.
```

Checks:

```text
curl -sS 'http://localhost:3102/favicon.svg?v=starter-green'
Result: returned the new dark green SVG.

Browser head links:
- rel="shortcut icon" href="/favicon.svg?v=starter-green"
- rel="icon" href="/favicon.svg?v=starter-green"

npm run lint
Result: passed.
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

## Open Source Homepage Style Refresh

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

Browser preview:

```text
URL: http://localhost:3102/
Title: Skills Marketplace Starter
Visible hero content:
- Open source starter kit
- Self-host your agent skills marketplace
- Install the marketplace helper into your agent
- Trending this week
- All Skills
```


## Full English Starter Pass

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
Result: passed.
uv run agent-skills publish --help
Result: passed.
uv run agent-skills access --help
Result: passed.
uv run agent-skills search --help
Result: passed.
python3 -m py_compile code/cli/src/agent_skills/*.py
Result: passed.
```

Browser / HTML:

```text
URL: http://localhost:3102/
<html lang="en">
Homepage strings visible: English only.
Seed Skill descriptions: English only.
```

Text scan:

```text
pattern='[\p{Han}]|z''h-CN'
rg -n "$pattern" code/app code/cli docs skills README.md -S
Result: no matches.
```

## Starter Detail And Docs Cleanup

Date: 2026-06-17

Scope:

```text
Removed starter docs screenshot/video placeholder support from tutorial pages.
Removed bundled historical tutorial screenshots.
Changed Skill detail page accent from warning yellow to the starter accent green.
```

Code scans:

```text
media_pattern='tutorials/screen''shots|video''Placeholder|Video place''holder|tutorial-''media|tutorial-inline-''image|screen''shot:'
rg -n "$media_pattern" code/app docs skills -S
Result: no matches.

yellow_pattern='255, 241, ''204|f2''f0ec|--detail-accent: var\(--warn''ing\)|--detail-warm-rgb: 2''55'
rg -n "$yellow_pattern" code/app/app code/app/components code/app/lib -S
Result: no matches.

pattern='[\p{Han}]|z''h-CN'
rg -n "$pattern" code/app code/cli docs skills README.md -S
Result: no matches.
```

Browser:

```text
URL: http://localhost:3102/skills/%40community%2Fmarketplace-guide
Detail accent: #047857
Detail accent RGB: 4, 120, 87

URL: http://localhost:3102/docs/what-is-skill-marketplace
Media strip count: 0
Article image count: 0
Video media marker text: false
Screenshot path text: false
```

Web:

```text
cd code/app
npm run lint
Result: passed.

npm run build
Result: passed.
Note: Next/Turbopack emitted the existing NFT tracing warning for the download route.
```
