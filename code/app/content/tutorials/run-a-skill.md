---
title: Run A Skill
description: Use natural language to trigger an installed Skill and check whether it worked.
audience: user
difficulty: beginner
duration: 5 min
category: Using Skills
order: 3
---

## You Usually Do Not Click Run

Most Skills run when your local agent decides the current task matches the Skill description.

After installing `@community/marketplace-guide`, try asking your agent:

```txt
What skills are available in the marketplace?
```

After installing `@demo/report-writer`, try:

```txt
I need to write a project report. Can you check whether there is a suitable Skill first?
```

## Signs The Skill Worked

You should see at least one of these signals:

1. The agent says it is using a specific Skill.
2. The answer follows the workflow or template from the Skill.
3. The agent runs the CLI command described by the Skill, such as `agent-skills list` or `agent-skills info`.

## If It Does Not Trigger

Check:

- The Skill is installed into the agent you are using.
- The agent session was restarted after installation.
- The user prompt matches the Skill `description`.
- The Skill description includes realistic user wording.

You can submit feedback from the Web detail page or with:

```bash
agent-skills feedback @community/marketplace-guide \
  --type issue \
  --message "The guide did not trigger when I asked what Skills are available."
```
