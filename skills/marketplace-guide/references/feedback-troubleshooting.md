# Feedback And Troubleshooting

Read this file when a Marketplace Skill reports an error, does not trigger, gives poor output, or the user wants to submit feedback.

## Why Feedback Matters

`agent-skills` bridges local agent usage and Marketplace maintainers. When a downloaded Skill fails in real work, the useful next step is not only a local workaround; it is sending the concrete failure mode back to the Skill owner so the shared method can improve for everyone.

Feedback should be specific enough to help the maintainer update `description`, `SKILL.md`, references, scripts, examples, or package metadata.

## Triage Flow

1. Confirm the Skill came from this Marketplace or the user provided an `@author/name` slug.
2. Before using CLI feedback or owner feedback views, ask the user to confirm CLI login with `agent-skills whoami`; if it fails, run `agent-skills login`.
3. If the slug is missing, locate it with `agent-skills search <keyword>` or `agent-skills list`.
4. Run the smallest useful checks; do not expand into a full project debug unless the user asks.
5. If the issue is likely in the Skill package or instructions, submit feedback with the user's explicit description.

Minimal checks:

```bash
agent-skills doctor
agent-skills info @author/name --full
agent-skills outdated
```

## When A Skill Does Not Trigger

Check `info --full` and inspect frontmatter:

- If `description` does not mention the user's scenario, feedback should say the trigger description is missing or too narrow.
- If `SKILL.md` body has the right scenario but `description` does not, feedback should say the trigger was placed in the body instead of metadata.
- If Cursor is the target, check `~/.cursor/skills/<skill-name>/`; Cursor rules are a separate project-rule mechanism.
- If Antigravity is the target, treat trigger behavior as experimental until manually verified.

Useful feedback wording:

```bash
agent-skills feedback @author/name \
  --type suggestion \
  --message "This Skill did not trigger for '<user wording>'; consider adding that phrase to frontmatter description."
```

## When A Skill Errors Or Gives Bad Output

Ask for only the minimum needed:

- Which slug, for example `@author/name`.
- What the user asked the agent to do.
- The visible error message or wrong result.
- Optional: the short log snippet the user is willing to share.

Do not read or upload files automatically.

```bash
agent-skills feedback @author/name \
  --type issue \
  --message "Runtime error: ..." \
  --context "User-provided error log or call snippet"
```

Common feedback types:

```bash
agent-skills feedback @author/name --type issue --message "Runtime error: ..."
agent-skills feedback @author/name --type suggestion --message "Please add this trigger scenario: ..."
agent-skills feedback @author/name --type question --message "I am not sure how to use this Skill"
```

If the user only says "not useful", ask one narrow follow-up: which slug, and is it error, no trigger, wrong result, or unclear instructions?

## View Feedback As Owner

```bash
agent-skills feedback list
agent-skills feedback list --skill @author/name
```

The owner can also view feedback in the Skill detail feedback tab.
