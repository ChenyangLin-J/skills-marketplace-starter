---
title: Publish A Skill
description: Upload a local Skill folder or zip so other users and agents can install it.
audience: creator
difficulty: beginner
duration: 6 min
category: Creating Skills
order: 7
---

## Prepare The Package

The uploaded folder or zip should have `SKILL.md` at the top level:

```txt
my-skill.zip
  SKILL.md
  references/
  scripts/
  assets/
```

## Publish From Web

1. Open **Publish**.
2. Choose a folder or `.zip`.
3. Review parsed frontmatter.
4. Select category and tags.
5. Add a short example prompt.
6. Submit and inspect the detail page.

## Publish From CLI

```bash
agent-skills login
agent-skills publish ./my-skill --category tool --tags reports,writing
```

## Update A Skill

Bump the version in `SKILL.md`:

```yaml
version: 0.1.1
```

Then publish the same folder again. Existing users can update with:

```bash
agent-skills update @demo/report-writer
```
