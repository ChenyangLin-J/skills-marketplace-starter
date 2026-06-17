# Trigger Eval

Trigger eval answers three questions:

1. Does the Skill trigger when it should?
2. Does it avoid triggering when it should not?
3. After trigger, does it read the right reference and call the expected tools or commands?

## Test Cases

Prepare at least:

- 5 positive examples using realistic user wording.
- 2 negative examples that look related but should not use the Skill.
- 1 boundary example where the user explicitly says not to query, not to execute, or only wants to discuss.

Example:

| Type | Prompt | Expected |
| --- | --- | --- |
| Positive | Help me write a Skill for report writing | trigger |
| Positive | How should SKILL.md description be written? | trigger |
| Positive | This Skill does not trigger; help me fix it | trigger |
| Negative | What Skills are loaded in this current conversation? | no trigger |
| Negative | Help me write a normal Python function | no trigger |

## Record Format

```md
| ID | Prompt | Expected | Actual | Routed refs | Pass |
| --- | --- | --- | --- | --- | --- |
| P01 | Help me write a data analysis Skill | trigger | trigger | writing-patterns | yes |
| N01 | Explain what the word skill means | no trigger | no trigger | - | yes |
```

## Judgement

- If realistic wording is missing from `description`, add it there first.
- Trigger words that appear only in the body are not reliable.
- If reference routing is wrong, update the main `SKILL.md` reference section first.
- For risky operations, trigger may succeed, but execution must ask for confirmation.

## Improvement Loop

1. Run eval and record failures.
2. Make the smallest necessary change, usually in `description` or reference routing.
3. Re-run the same examples.
4. Add one regression example.
5. Record evidence in the project test notes.
