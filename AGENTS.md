# Repository Guidelines

This repository is the open source starter version of Skills Marketplace.

## Product Goal

Build a self-hosted marketplace where teams can publish, discover, install, update, and improve AI agent skills.

The core loop is:

1. Humans publish and maintain Skills in the Web UI.
2. Agents call the CLI to search, install, update, and report feedback.
3. Skills carry reusable task context.
4. Feedback turns failed usage into the next version of the Skill.

## Development Rules

- Keep the starter easy to run locally.
- Default to SQLite and local file storage.
- Do not require any company-specific OAuth provider.
- Do not add SaaS multi-tenancy, complex RBAC, external storage, queues, or CI dependencies unless explicitly scoped.
- Keep `@author/name` as the canonical Skill id.
- Keep list/search API responses compact for agent usage.
- Use structured parsers for `SKILL.md` frontmatter.

## Open Source Hygiene

- Do not commit real credentials, internal domains, private user data, local evidence, production DBs, uploaded zips, or generated caches.
- Keep examples generic and safe.
- Seed Skills must be demo-safe and reusable by other teams.
- Before publishing, run a text scan for internal names and secret-like strings.

## Useful Commands

Web:

```bash
cd code/app
npm install
npm run dev
```

CLI:

```bash
cd code/cli
uv run agent-skills --help
```

Starter spec:

```text
docs/OPEN_SOURCE_STARTER_SPEC.md
```
