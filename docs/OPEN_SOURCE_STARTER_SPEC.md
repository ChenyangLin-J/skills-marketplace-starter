# Open Source Starter Spec

## Goal

Package Skills Marketplace as a complete open source starter that another team can clone, run locally, and adapt for its own AI agent Skills.

The starter keeps the full core loop:

- Humans publish and maintain Skills in the Web UI.
- Agents use the CLI to search, install, update, publish, and submit feedback.
- Skills carry reusable task context.
- Feedback from real usage becomes input for the next Skill version.

## Target Experience

```bash
git clone <repo>
cd skills-marketplace-starter
cd code/app
npm install
cp .env.example .env.local
npm run dev
```

In another terminal:

```bash
cd code/cli
uv run agent-skills config set api_base_url http://localhost:3000
uv run agent-skills list
uv run agent-skills install @community/marketplace-guide --target codex
```

## Product Positioning

> A self-hosted starter kit for teams building an internal marketplace of AI agent skills.

This is not a prompt gallery. It is a lightweight system for distributing, installing, maintaining, and improving agent-ready knowledge assets.

## Scope

Included:

- Web marketplace home, search, detail, publish, management, docs, and feedback pages.
- REST APIs for Skills, versions, downloads, install reporting, likes, feedback, and auth.
- Python CLI with list, search, info, install, uninstall, publish, update, outdated, feedback, doctor, config, and self-update commands.
- SQLite database and local uploaded zip storage.
- Local demo auth.
- Minimal visibility and install access controls.
- Codex, Claude Code, Cursor, and Antigravity install targets.
- Seed Skills and starter docs.

Not included:

- SaaS multi-tenancy.
- Complex RBAC.
- Required external storage.
- Required OAuth provider.
- Public marketplace aggregation.
- Bundled private company data, Skills, users, logs, credentials, uploads, or screenshots.

## Naming

| Object | Name |
| --- | --- |
| Repo | `skills-marketplace-starter` |
| Product | `Skills Marketplace Starter` |
| CLI package | `agent-skills` |
| CLI command | `agent-skills` |
| Config dir | `~/.agent-skills/` |
| Community author | `community` |
| Demo author | `demo` |

Canonical Skill ids remain `@author/name`, for example:

```txt
@community/marketplace-guide
@community/skill-creator
@demo/hello-world
@demo/report-writer
```

## Default Runtime

```env
APP_NAME="Skills Marketplace Starter"
APP_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_APP_BASE_URL="http://localhost:3000"
AUTH_MODE="local"
STORAGE_DRIVER="local"
AGENT_SKILLS_DATA_DIR="./data"
AGENT_SKILLS_MARKETPLACE_URL="http://localhost:3000"
NEXT_PUBLIC_AGENT_SKILLS_MARKETPLACE_URL="http://localhost:3000"
SESSION_SECRET="replace-this-in-production"
ENABLE_DEV_LOGIN="1"
```

## Seed Skills

| Skill | Purpose |
| --- | --- |
| `@community/marketplace-guide` | Teach agents when and how to use the marketplace CLI. |
| `@community/skill-creator` | Help users turn reusable knowledge into a `SKILL.md`. |
| `@demo/hello-world` | Minimal install, publish, and update sample. |
| `@demo/report-writer` | Demonstrate the “user says a goal, agent searches and asks to install” flow. |

Seed Skills must be safe, generic, compact enough for a starter, and include realistic trigger phrases plus reference routing in `description` / `SKILL.md`.

## Implementation Requirements

Web:

- Use local demo auth by default.
- Keep SQLite and local uploads as the default storage path.
- Keep compact API responses for agent-facing list/search routes.
- Keep detail pages, version history, install scripts, feedback, and management flows.
- Keep install scripts environment-driven, using the current origin or configured marketplace URL.

CLI:

- Default API base is `http://localhost:3000`.
- Config directory is `~/.agent-skills`.
- Environment variable prefix is `AGENT_SKILLS_`.
- Install tests must support isolated `HOME`, target root, uv cache, and uv tool paths.

Docs:

- README must explain value and quickstart in the first screen.
- Tutorial docs must use only generic seed Skills and generic examples.
- Security docs must explain local data, uploads, credentials, and secret scanning.
- Test docs must describe web, CLI, install, and open-source hygiene checks.

## Acceptance Criteria

- A new user can run the Web app locally in under 10 minutes.
- The home page shows seed Skills.
- Skill detail pages render correctly.
- CLI `list`, `search`, and `info` work against local Web.
- CLI can install `@community/marketplace-guide` into an isolated Codex target.
- Web and CLI feedback submission work.
- No real runtime data, uploads, evidence, cache directories, private Skills, credentials, or company-specific docs are included.
- `npm run lint`, `npm run build`, and `uv run agent-skills --help` pass.

## Verification Commands

```bash
cd code/app
npm run lint
npm run build
```

```bash
cd code/cli
uv run agent-skills --help
uv run agent-skills doctor
```

```bash
HOME=/tmp/agent-skills-home \
AGENT_SKILLS_TARGET_ROOT=/tmp/agent-skills-targets \
UV_CACHE_DIR=/tmp/agent-skills-uv-cache \
UV_TOOL_DIR=/tmp/agent-skills-uv-tools \
uv run agent-skills install @community/marketplace-guide --target codex --yes
```

Before publishing, run a repository-specific scan for company names, internal domains, private user handles, provider names, and secret-like strings.
