---
title: Troubleshooting
description: Fix install failures, trigger failures, upload failures, and permission issues.
audience: all
difficulty: beginner
duration: 6 min
category: Help
order: 10
screenshot: /tutorials/screenshots/error-states.png
videoPlaceholder: Troubleshooting recording placeholder.
---

## CLI Is Missing

```bash
export PATH="$HOME/.local/bin:$PATH"
agent-skills --version
```

If it is still missing, reinstall:

```bash
curl -fsSL http://localhost:3000/install.sh | bash
```

Windows:

```powershell
irm http://localhost:3000/install.ps1 | iex
```

## API Or Login Fails

```bash
agent-skills doctor
agent-skills config get api_base_url
agent-skills login
agent-skills whoami
```

For local starter development, the API base should usually be:

```txt
http://localhost:3000
```

## Skill Does Not Trigger

Check:

- The Skill is installed in the current agent target.
- You restarted the agent session after installing.
- The prompt matches the Skill description.
- The description includes realistic user wording.

## Upload Fails

Check:

- `SKILL.md` is at the top level.
- Frontmatter is valid YAML.
- `name`, `description`, and `version` exist.
- The zip does not include private data or large generated files.

## Send Feedback

```bash
agent-skills feedback @community/marketplace-guide \
  --type issue \
  --message "Describe what failed and how to reproduce it."
```
