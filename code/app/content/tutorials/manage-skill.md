---
title: Manage And Update Skills
description: Edit display metadata, publish new versions, archive, restore, and review feedback.
audience: creator
difficulty: beginner
duration: 6 min
category: Creating Skills
order: 8
---

## Login

```bash
agent-skills login
agent-skills whoami
```

The Web app and CLI use the same marketplace identity.

## Version History

Open the **Versions** tab on a Skill detail page, or use:

```bash
agent-skills versions @demo/report-writer
```

The latest version is used by default for install, download, and one-click scripts.

## Display Metadata

The **Manage** tab lets an owner update:

- Description
- Category
- Tags
- Example prompt
- Icon
- Visibility and install access

Changing display metadata does not rewrite your local `SKILL.md`. If you want to change agent behavior, update `SKILL.md` and publish a new version.

## Feedback Inbox

Feedback from the Web and CLI appears in the Skill feedback tab and in **My Skills**. Use feedback to improve descriptions, examples, references, and scripts.
