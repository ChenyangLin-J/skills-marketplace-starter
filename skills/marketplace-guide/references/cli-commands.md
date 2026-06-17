# CLI Commands

Read this file when the user needs concrete `agent-skills` commands, options, or a compact explanation of what each command does.

## Login First In Agents

When an agent is about to use `agent-skills`, recommend checking login first:

```bash
agent-skills whoami
agent-skills login
```

`list`, `search`, and some `info` calls can work anonymously, but login should still be the default suggestion in agent workflows. Without CLI login, protected installs can fail and feedback cannot be attributed to the user.

## Marketplace Discovery

```bash
agent-skills list
agent-skills list --mine
agent-skills search report
agent-skills info @community/marketplace-guide
agent-skills info @community/marketplace-guide --full
agent-skills versions @community/marketplace-guide
agent-skills access @community/marketplace-guide
```

- `list` shows Marketplace Skills.
- `list --mine` requires login and shows Skills managed by the current user, including archived/restorable entries.
- `search <keyword>` is the default when the user gives a fuzzy need such as "is there a PDF Skill?"
- `info --full` is the right command when an agent needs the full `SKILL.md` body to diagnose trigger issues.
- `versions` shows version history; historical versions are display-only in the starter.

## Install, Update, Uninstall

```bash
agent-skills install @community/marketplace-guide
agent-skills install @community/marketplace-guide --target codex
agent-skills install @community/marketplace-guide --target 12
agent-skills install @community/marketplace-guide --target all
agent-skills outdated
agent-skills update --all
agent-skills update @community/marketplace-guide
agent-skills uninstall @community/marketplace-guide
agent-skills uninstall @community/marketplace-guide --target claude
```

Target shortcuts:

| Input | Meaning |
| --- | --- |
| `1` | Codex |
| `2` | Claude Code |
| `3` | Cursor |
| `4` | Antigravity |
| `5` / `skip` | Skip install |
| `12`, `1,2`, `codex,claude`, `all` | Multiple targets |

Install and download follow the Skill's `install_access`. `anonymous` Skills can install without login; `company` and `restricted` Skills require login.

## CLI Itself

```bash
agent-skills --version
agent-skills doctor
agent-skills self check
agent-skills self update
agent-skills config get api_base_url
agent-skills config set api_base_url http://localhost:3000
agent-skills config set default_agent codex
```

Use `doctor` first when anything feels off. It checks CLI version, OS, `uv`, Marketplace API, latest CLI release, agent targets, and installed Skill records.

## Direct API Fallback

If the CLI is not installed and the user only wants to see Marketplace contents, use the current Web API:

```bash
curl -fsS 'http://localhost:3000/api/skills?limit=100'
```

For a deployed starter, replace `http://localhost:3000` with that deployment's base URL.

## Access Management

Use these only for Skills managed by the current login user:

```bash
agent-skills access @author/name
agent-skills access set @author/name --install company --visibility listed
agent-skills access grant @author/name demo
agent-skills access revoke @author/name demo
```

`--install` values:

| Value | Meaning |
| --- | --- |
| `anonymous` | No login required to download/install. |
| `company` | Any logged-in Marketplace user can install. |
| `restricted` | Only author, owner, or granted handles can install. |

`--visibility` values:

| Value | Meaning |
| --- | --- |
| `listed` | Visible in default list/search. |
| `unlisted` | Hidden from list/search, direct link works. |
| `restricted` | Only author, owner, or granted handles can see. |
| `match_install_access` | Visible to whoever can install. |
