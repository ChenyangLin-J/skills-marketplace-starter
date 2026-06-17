---
title: Skill Writing Guide
description: Write Skills that are easy for agents to discover and maintain.
audience: creator
difficulty: beginner
duration: 10 min
category: Creating Skills
order: 6
---

## Description Is Discovery

Agents usually see a Skill name and description before they load the full `SKILL.md`. Put trigger intent in `description`, not only in the body.

Weak:

```yaml
description: Report helper.
```

Better:

```yaml
description: Use when the user wants to turn notes, analysis, research, or meeting outcomes into a clear report. Trigger phrases include "write a report", "prepare a memo", and "summarize this for stakeholders".
```

## Keep SKILL.md Compact

The body should tell the agent what to do after the Skill is selected:

- First response behavior.
- Workflow steps.
- Required checks.
- When to open references.
- When to run scripts.

Long examples, complete command tables, and troubleshooting details should move into `references/`.

## Include Boundaries

Write both positive and negative cases:

```md
## Use When

- The user wants a written report, memo, status update, or stakeholder summary.

## Do Not Use When

- The user only wants grammar edits.
- The user wants a slide deck instead of a written report.
```

## Test With Real Prompts

Prepare a small trigger eval:

| Type | Prompt |
| --- | --- |
| Should trigger | `I need to write a project report` |
| Should trigger | `Summarize this research into a memo` |
| Should not trigger | `Fix this Python function` |

If a prompt should trigger but does not, improve the description first.
