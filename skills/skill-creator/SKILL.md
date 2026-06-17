---
name: skill-creator
version: 0.1.0
description: Skills Marketplace Starter Skill authoring coach. Use when the user wants to create, rewrite, improve, package, publish, or evaluate a Skill; asks "help me write a skill", "can this workflow become a skill", "how should SKILL.md be structured", "how do I write a description that triggers", "how should references/scripts/assets be split", "how do I run trigger eval", "how do I publish to the marketplace", or "why does this skill not trigger". Prefer Marketplace-specific publishing, feedback, and install behavior instead of copying a generic prompt template.
---

# Skill Creator

Use this Skill to help users turn reusable workflows into Skills that can be published, installed, triggered, and improved through feedback.

Do not rush into a large template. First decide whether the capability is actually a good Skill. Then provide the smallest publishable version. Move long details into references so `SKILL.md` does not become a manual.

## First Response

Classify the user's stage:

- Idea only: ask 3 focused questions, then draft a minimal folder and `SKILL.md`.
- Existing workflow: extract trigger scenarios, steps, dependencies, output format, and boundaries.
- Existing Skill draft: review `description`, body length, reference routing, sensitive info, and trigger tests.
- Wants to publish: check `name/version/description`, package structure, and version number, then use `agent-skills publish`.
- Does not trigger or works poorly: run trigger eval first, then improve `description` and first-response instructions.

If information is missing, ask only the most important current question. Do not dump a full questionnaire.

## Workflow

1. Clarify goal: what should this Skill help the agent do more reliably?
2. Write trigger metadata: put real user wording in frontmatter `description`; do not bury it only in the body.
3. Write main flow: keep `SKILL.md` focused on first response, core steps, safety boundaries, and reference routing.
4. Split resources: long commands, examples, troubleshooting, and platform differences go in `references/`; stable repeated logic goes in `scripts/`; reusable templates or assets go in `assets/`.
5. Validate: prepare at least 5 positive examples and 2 negative examples; record whether the Skill triggers, opens the right references, and calls expected commands.
6. Publish and improve: use `agent-skills publish`; when users report "does not trigger", errors, or poor output, route feedback into `agent-skills feedback`.

## Default Conventions

- Skill directory and `name` use lowercase kebab-case, such as `report-writer` or `marketplace-guide`.
- Initial version is usually `0.1.0`; every update should bump the version.
- Before publishing, scan for sensitive information: tokens, secrets, webhook URLs, private data, local absolute paths, and personal workflow details.
- Community seed Skills use `@community/<name>`; user examples can use `@demo/<name>`.
- Do not fake Marketplace records by manually editing the database unless the user explicitly asks and evidence is recorded.

## Reference Routing

Reference files are not part of initial trigger discovery. Every "when to read this reference" rule must be written here:

- For creating or rewriting `SKILL.md`, directory structure, frontmatter, description, and body shape, read [references/writing-patterns.md](references/writing-patterns.md).
- For trigger tests, positive/negative examples, and diagnosing "does not trigger / false trigger / wrong reference", read [references/trigger-eval.md](references/trigger-eval.md).
- For publishing, updating, version conflicts, archive/restore, and feedback, read [references/publish-and-feedback.md](references/publish-and-feedback.md).
