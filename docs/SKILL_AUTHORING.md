# Skill Authoring

Write Skills so an agent can decide when to use them, load only the context it needs, and give useful feedback when something fails.

## Core Model

A Skill has three layers:

1. `description` is discovery. It should say what the Skill does, when to use it, and include real user wording.
2. `SKILL.md` is the compact operating guide. It is loaded after the Skill is selected.
3. `references/` and `scripts/` hold longer details and repeatable actions. Link them from `SKILL.md` with clear conditions.

## Minimal Frontmatter

```yaml
---
name: report-writer
description: Use when the user wants to turn notes, analysis, meeting outcomes, or research into a clear written report. Trigger phrases include "write a report", "summarize this into a report", "make this into a memo", and "prepare an update for stakeholders".
version: 0.1.0
---
```

Keep frontmatter safe and portable. `name`, `description`, and `version` are enough for the starter.

## Good Descriptions

A useful description includes:

- The work the Skill performs.
- The user situations that should trigger it.
- Keywords, file types, commands, or product names that matter.
- Boundaries when the Skill should not be used.

Avoid descriptions that are only abstract labels, long manuals, or release notes.

## SKILL.md Body

Keep the body short and executable:

```md
# Report Writer

## Workflow

1. Ask for the intended audience if it is unclear.
2. Extract the key conclusion, evidence, risks, and next steps.
3. Draft the report with conclusion first.
4. If a source is missing, name the gap instead of inventing it.

## References

- For report structure examples, read [references/report-templates.md](references/report-templates.md).
- For tone rules, read [references/style-guide.md](references/style-guide.md).
```

Long command lists, detailed examples, and edge-case troubleshooting belong in `references/`.

## References

Use references for:

- Full command tables.
- Multi-step examples.
- Longer troubleshooting notes.
- Templates and style guides.
- Domain-specific glossaries.

Rules:

- Link every reference directly from `SKILL.md`.
- Explain when to open each reference.
- Avoid copying the same large section into multiple files.

## Scripts

Use `scripts/` when the agent would otherwise have to repeatedly rewrite fragile logic. Good examples include validation, conversion, packaging, or deterministic data extraction.

Document how to run each script from `SKILL.md` or a linked reference.

## Publishing Checklist

- [ ] `description` includes realistic trigger phrases.
- [ ] `SKILL.md` is short enough to scan quickly.
- [ ] Longer details are linked from `references/`.
- [ ] Repeatable or fragile steps are scripts where practical.
- [ ] No tokens, cookies, private user data, internal URLs, or local absolute paths are included.
- [ ] The Skill has been installed into at least one local agent target and tested with a real prompt.

## Trigger Eval

For important Skills, keep a few positive and negative examples:

| Type | Example |
| --- | --- |
| Should trigger | `What skills are available in the marketplace?` |
| Should trigger | `I need to write a project report` |
| Should trigger | `This Skill did not trigger; help me send feedback` |
| Should not trigger | `Which skills are already loaded in this session?` |
| Should not trigger | `Help me write a plain Python function` |

Record the agent, prompt, expected behavior, actual behavior, and evidence when you test.
