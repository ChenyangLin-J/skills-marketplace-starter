# Writing Patterns

## Good Skill Candidates

Good candidates:

- Team workflows that repeat often and are easy to miss steps in.
- Tasks requiring a specific CLI, API, document convention, or team standard.
- Tasks where a generic agent may guess incorrectly but a fixed process can be reliable.
- Tasks that can be evaluated with examples, checklists, command output, or test evidence.

Poor candidates:

- One-off questions.
- A plain prompt without reusable workflow, dependency, or quality standard.
- Work requiring private data that cannot be sanitized.
- Cases where the user only wants help in the current conversation and does not want a reusable asset.

## Minimal Directory

```txt
my-skill/
  SKILL.md
```

Add more only when needed:

```txt
my-skill/
  SKILL.md
  references/
    commands.md
    troubleshooting.md
  scripts/
    validate.py
  assets/
    template.md
  agents/
    openai.yaml
```

## Minimal SKILL.md Template

```md
---
name: my-skill
version: 0.1.0
description: Use when the user needs <real task>, asks "<real wording 1>" or "<real wording 2>", or needs <tool/platform/workflow>. Do not use when <negative scenario>.
---

# My Skill

One sentence describing what this Skill helps the agent do reliably.

## First Response

- If the user already provided input: do this first.
- If key information is missing: ask only the most important question.
- If the user asks for a state-changing or risky operation: confirm first.

## Workflow

1. Step one.
2. Step two.
3. Output format or acceptance criteria.

## Safety

- Do not read unauthorized files.
- Do not submit tokens, cookies, secrets, or webhook URLs.
- Confirm before state-changing operations.

## References

- For full commands, read [references/commands.md](references/commands.md).
- For troubleshooting, read [references/troubleshooting.md](references/troubleshooting.md).
```

## Description Pattern

`description` should cover:

- What the Skill helps the agent do.
- When it should be used.
- Real user wording, abbreviations, slugs, commands, or file types.
- Clear boundaries for when not to use it.

Avoid:

- `description: productivity helper`
- Only saying "improves efficiency"
- Putting a full tutorial or command table in the description

## Body Shape

Keep `SKILL.md` short:

- First response.
- Workflow.
- Defaults.
- Safety boundaries.
- Reference routing.

Do not make the main file a full manual. Move long commands, examples, platform differences, and troubleshooting into references.

## Reference Splitting

Rules:

- One hop: every reference should be linked directly from `SKILL.md`.
- Routing belongs in the main file.
- Do not repeat large sections across files.
- Name files by task, such as `commands.md`, `trigger-eval.md`, and `publish-and-feedback.md`.

## Quality Check

Before publishing:

- `name` is lowercase kebab-case.
- `version` exists.
- `description` has realistic trigger phrases.
- Body is short enough to execute.
- Reference links exist.
- No tokens, secrets, webhook URLs, local absolute paths, or private data.
- Trigger eval has at least 5 positive examples and 2 negative examples.
