# Publish And Feedback

## Before Publishing

Check the folder:

```bash
find skills/my-skill -maxdepth 3 -type f | sort
```

Check sensitive information:

```bash
rg -n "(secret|token|webhook|password|api[_-]?key|https://hooks|/Users/)" skills/my-skill
```

## Publish

Confirm login:

```bash
cd code/cli
uv run agent-skills whoami
```

Publish a new Skill:

```bash
uv run agent-skills publish ../../skills/my-skill \
  --category method \
  --tags skill-writing,trigger-eval,marketplace \
  --example "Help me turn this workflow into a publishable Skill" \
  --yes
```

Update an existing user-owned Skill:

```bash
uv run agent-skills publish ../../skills/my-skill --yes
```

Update an existing community slug:

```bash
uv run agent-skills publish ../../skills/marketplace-guide \
  --slug @community/marketplace-guide \
  --yes
```

In the starter, `--slug` updates an existing Skill; it should not be used to silently create a new official-looking record unless the user explicitly chooses that ownership model.

## After Publishing

```bash
uv run agent-skills info @demo/my-skill --full
uv run agent-skills versions @demo/my-skill
uv run agent-skills list --mine
```

Isolated install validation:

```bash
HOME=/tmp/agent-skill-home \
AGENT_SKILLS_TARGET_ROOT=/tmp/agent-skill-targets \
AGENT_SKILLS_CREDENTIALS_PATH=$HOME/.agent-skills/credentials.json \
uv run agent-skills install @demo/my-skill --target codex --yes
```

Install validation may call the install reporting API and increment install count. Record that side effect in test notes.

## Feedback Loop

When users report no trigger, runtime errors, unclear instructions, or poor output:

```bash
agent-skills feedback @demo/my-skill \
  --type issue \
  --message "This Skill did not trigger for '<user wording>'; consider improving description."
```

Maintainers can view feedback:

```bash
agent-skills feedback list --skill @demo/my-skill
```

When processing feedback, decide:

- Is `description` missing a trigger?
- Is reference routing unclear?
- Is a command outdated?
- Is the user missing a dependency or login state?
- Should this Skill not cover the reported scenario?
