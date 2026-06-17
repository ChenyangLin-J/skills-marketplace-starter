# Skills Marketplace Starter

A self-hosted starter kit for teams building an internal marketplace of AI agent skills.

Skills Marketplace Starter gives you:

- A Web marketplace for humans to publish, browse, manage, and review feedback on Skills.
- A CLI that agents can call to search, install, update, publish, and submit feedback.
- A local-first storage model using SQLite and uploaded Skill zip files.
- A feedback loop so failed agent usage can become the next version of a Skill.

It is designed for teams that want AI agents to discover and reuse organizational knowledge instead of copying prompts across chats.

## Why This Exists

AI agents need task-specific context:

- Which table or API should be used?
- What does this business metric mean?
- What examples should the agent follow?
- What should happen when a workflow fails?

A Skill packages that context. A marketplace makes those Skills discoverable, installable, maintainable, and improvable.

## What Is Included

| Area | Included |
| --- | --- |
| Web | Home, search, detail, publish, docs, management, feedback |
| API | Skills, versions, downloads, install reporting, likes, feedback, auth |
| CLI | `list`, `search`, `info`, `install`, `uninstall`, `publish`, `update`, `outdated`, `feedback`, `doctor`, `config` |
| Storage | SQLite database and local upload directory |
| Agent targets | Codex, Claude Code, Cursor, Antigravity |
| Seeds | Marketplace guide, Skill creator, hello world, report writer |

## Quickstart

### 1. Start The Web App

```bash
cd code/app
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

### 2. Run The CLI In Development

```bash
cd code/cli
uv run agent-skills --help
uv run agent-skills config set api_base_url http://localhost:3000
uv run agent-skills list
```

### 3. Install A Skill Into An Agent

Use an isolated target directory while testing:

```bash
HOME=/tmp/agent-skills-home \
AGENT_SKILLS_TARGET_ROOT=/tmp/agent-skills-targets \
uv run agent-skills install @community/marketplace-guide --target codex --yes
```

Expected output:

```text
/tmp/agent-skills-targets/codex/skills/marketplace-guide/SKILL.md
```

## Core Concepts

### Skill

A Skill is a folder with a top-level `SKILL.md`.

```text
my-skill/
  SKILL.md
  references/
    examples.md
```

`SKILL.md` uses frontmatter:

```yaml
---
name: report-writer
description: Use when the user wants to turn analysis notes into a clear report.
version: 0.1.0
---
```

### Marketplace

The Web app lets people:

- Browse and search Skills.
- Read Skill documentation.
- Publish new Skills.
- Manage versions and visibility.
- Review feedback from users and agents.

### CLI

The CLI lets humans and agents:

- Search for relevant Skills.
- Install Skills into local agent directories.
- Publish new Skills.
- Update installed Skills.
- Send feedback to Skill creators.

### Feedback Loop

If an agent uses a Skill and a workflow fails, it can submit structured feedback:

```bash
agent-skills feedback @community/marketplace-guide \
  --type issue \
  --message "The install instructions are missing Cursor examples"
```

Creators can use that feedback to publish a better version.

## Repository Layout

```text
.
├── code/
│   ├── app/       # Next.js Web + API
│   └── cli/       # Python Typer CLI
├── docs/          # Starter documentation
├── scripts/       # Helper scripts
└── skills/        # Seed Skills
```

## Default Local Configuration

The starter should run without any company-specific services.

```env
APP_NAME="Skills Marketplace Starter"
APP_BASE_URL="http://localhost:3000"
AUTH_MODE="local"
STORAGE_DRIVER="local"
DATA_DIR="./data"
CLI_NAME="agent-skills"
```

## Open Source Cleanup Status

This repository is being converted from an internal implementation into a clean starter.

Current spec:

[docs/OPEN_SOURCE_STARTER_SPEC.md](docs/OPEN_SOURCE_STARTER_SPEC.md)

Before publishing publicly, run an internal-name scan for your own company names,
domains, user handles, OAuth provider names, and known secret key names. For
example:

```bash
rg -n "<company-name>|<internal-domain>|<private-user-handle>|APP_SECRET|client_secret|Bearer"
```

and a secret scanner such as:

```bash
gitleaks detect --no-git --source .
```

## Non-Goals

- No SaaS multi-tenancy.
- No complex RBAC by default.
- No required external storage.
- No required OAuth provider.
- No bundled company-internal Skills.
- No public marketplace aggregation.

## License

MIT. See [LICENSE](LICENSE).
