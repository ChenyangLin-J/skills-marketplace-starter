---
title: Send Skill Feedback
description: Use Web or CLI feedback to help creators improve a Skill.
audience: all
difficulty: beginner
duration: 4 min
category: Using Skills
order: 9
---

## When To Send Feedback

Send feedback when:

- The Skill does not trigger.
- The instructions are unclear.
- A command or script fails.
- A reference is outdated.
- You have a better example or use case.

Feedback is visible to the Skill owner, not shown as a public comment feed by default.

## Web Feedback

Open the Skill detail page and use the **Feedback** tab.

## CLI Feedback

```bash
agent-skills feedback @community/marketplace-guide \
  --type issue \
  --agent codex \
  --message "The guide did not trigger when I asked what Skills are available."
```

Add context when it helps:

```bash
agent-skills feedback @demo/report-writer \
  --type suggestion \
  --message "Add an executive summary template" \
  --context "The report was for a weekly project update."
```

Feedback turns real usage into the next version of the Skill.
