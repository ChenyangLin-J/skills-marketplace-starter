# Publishing And Management

Read this file when the user wants to publish a new Skill, update an existing Skill, manage versions, see their own Skills, or archive and restore a Skill.

## Login

Publishing and management require login:

```bash
agent-skills login
agent-skills whoami
```

CLI login opens the browser. There is no fallback mode; login failure means the operation should fail.

## Publish A New Skill

The local folder must contain a top-level `SKILL.md`:

```yaml
---
name: my-skill
version: 0.1.0
description: Describe when an agent should use this Skill.
---
```

Publish from a local folder:

```bash
agent-skills publish /path/to/my-skill --category tool
```

CLI publish may help fill missing metadata interactively:

- If `name` or `description` is missing, prompt the user and write it back to local `SKILL.md`.
- Suggest `display_name` and `display_description` for card/detail display.
- With `--yes`, missing required metadata should fail instead of guessing.

Categories:

| Category | Use for |
| --- | --- |
| `business` | Business workflows or organization knowledge. |
| `tool` | File processing, API tools, utilities. |
| `method` | Analysis, writing, or working methods. |
| `cli` | Command-line tools and developer workflows. |

Tags are optional and comma-separated:

```bash
agent-skills publish /path/to/my-skill --category business --tags reports,writing
```

## Web Publish Page

Explain fields in user-facing language:

| Web field | What to tell the user |
| --- | --- |
| Name | The name teammates see on cards and detail pages. |
| What this Skill does | A short purpose and scenario. |
| Who can use it | One product-level choice controlling who can see and install the Skill. |
| More display info | Optional category, tags, and examples. |

Do not make ordinary users reason about database fields such as `install_access` and `visibility` unless they ask.

## Update An Existing Skill

Without `--slug`, the target is `@current-login-user/<SKILL.md name>`:

```bash
agent-skills publish /path/to/my-skill
```

Use `--slug` when updating a community or managed Skill whose owner is the current user:

```bash
agent-skills publish skills/marketplace-guide --slug @community/marketplace-guide --yes
```

## Version Rules

- `name` and slug should not be renamed during update.
- Same slug + same version is rejected.
- If the user forgot to bump version, help choose the next patch version.
- Current starter installs the latest version only.
- Historical versions are kept for display and audit, not installation.

## Manage Owned Skills

```bash
agent-skills list --mine
agent-skills versions @author/name
agent-skills delete @author/name --yes
agent-skills restore @author/name
agent-skills access @author/name
agent-skills feedback list
agent-skills feedback list --skill @author/name
```

`delete` archives the Skill from public listing. It can be restored later.

## Manage Access

```bash
agent-skills access @author/name
agent-skills access set @author/name --install company --visibility listed
agent-skills access grant @author/name demo
agent-skills access revoke @author/name demo
```

Grant Marketplace handles, not provider-specific IDs.
