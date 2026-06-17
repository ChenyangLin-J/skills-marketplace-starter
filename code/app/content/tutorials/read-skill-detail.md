---
title: Read A Skill Detail Page
description: Understand the description, README, examples, versions, permissions, and install actions.
audience: user
difficulty: beginner
duration: 4 min
category: Using Skills
order: 4
screenshot: /tutorials/screenshots/skill-detail.png
videoPlaceholder: Detail page walkthrough placeholder.
---

## Start With The Description

The description should answer: **when should an agent use this Skill?**

If it is vague, read the README and examples before installing.

![Skill detail page](/tutorials/screenshots/skill-detail.png)

## Read The README

The README comes from `SKILL.md`. Look for:

- Trigger scenarios.
- Workflow steps.
- Inputs and outputs.
- References or scripts the agent may use.
- Boundaries and risks.

## Check Examples

Good examples sound like real user requests:

```txt
Turn these meeting notes into a status update for stakeholders.
```

Weak examples only repeat the Skill name:

```txt
Use this Skill.
```

## Check Permissions

Some Skills support anonymous install. Others require login or explicit access grants. If the install button asks you to log in, use `agent-skills login` or the Web demo login first.
