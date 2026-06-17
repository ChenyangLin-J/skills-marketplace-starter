---
title: Create Your First Skill
description: Build a minimal Skill folder with a clear SKILL.md file.
audience: creator
difficulty: beginner
duration: 8 min
category: Creating Skills
order: 5
---

## Minimal Folder

```txt
my-first-skill/
  SKILL.md
```

Add these only when needed:

```txt
my-first-skill/
  SKILL.md
  references/
  scripts/
  assets/
```

## Minimal SKILL.md

```md
---
name: report-writer
description: Use when the user wants to turn notes, analysis, research, or meeting outcomes into a clear report. Trigger phrases include "write a report", "prepare a memo", and "summarize this for stakeholders".
version: 0.1.0
---

# Report Writer

## Workflow

1. Identify the audience and purpose.
2. Extract the key conclusion, evidence, risks, and next steps.
3. Draft the report with conclusion first.
4. Name any missing source instead of inventing it.
```

## Local Check

Before publishing:

- The folder has a top-level `SKILL.md`.
- The frontmatter has `name`, `description`, and `version`.
- The description contains real user phrases.
- The body is short enough to scan.
- Any long examples or templates are in `references/`.
