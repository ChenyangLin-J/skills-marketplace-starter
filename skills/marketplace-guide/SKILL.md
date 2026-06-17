---
name: marketplace-guide
version: 0.1.0
description: Skills Marketplace Starter / agent-skills CLI guide. Use when the user asks what skills are available, how to install or update a Skill, how to publish or manage a Skill, how to fill the Web publish page, how to change install access or visibility, how to grant users access, how to send or view feedback, how to handle @author/name slugs, how to install or update the CLI, how one-click scripts work, where Codex/Claude/Cursor/Antigravity install Skills, or why a Marketplace Skill does not trigger or does not work. Trigger phrases include "Skills 市场有什么", "what skills are available", "install a skill", "publish a skill", "agent-skills", "skill feedback", and "skill not working".
---

# Marketplace Guide

This Skill helps an agent remember when to use Skills Marketplace Starter and how to call the `agent-skills` CLI.

`agent-skills` is not general world knowledge. Agents should use real CLI/API state instead of guessing what Skills exist, how access is configured, or whether local installs are outdated.

The important loop is: discover a Skill, install it into the right local agent, use it, and send concrete feedback when the Skill is wrong, outdated, unclear, or fails to trigger.

Do not treat this file as a full manual. Read references only when the user needs details.

## First Response

Classify the user intent, then give the shortest useful next command:

- Before running marketplace commands from an agent workflow, prefer checking CLI login with `agent-skills whoami`; if missing or uncertain, run `agent-skills login`.
- If the user wants to know what exists, run `agent-skills list` or `agent-skills search <keyword>`.
- If the user gives a slug and wants install/update/uninstall, use `install`, `outdated`, `update`, or `uninstall`.
- If the user wants to publish or manage their Skills, use `publish`, `list --mine`, `versions`, `delete`, `restore`, and `feedback list`.
- If the user asks who can see or install a Skill, use `agent-skills access` or direct them to the Web detail management tab.
- If a Marketplace-installed Skill errors, does not trigger, or produces poor output, do the smallest useful diagnosis and submit feedback with `agent-skills feedback`.
- If the CLI is not installed, give the local Web install command.

Answer concisely. Give the command first, then one sentence of explanation. Do not expand into package manager alternatives unless the user asks.

## Scope

Assume the user means this Marketplace when they say:

- `Skills 市场有什么`, `marketplace 有哪些 skill`, `what skills are available`
- `找一个能做 PDF/报告/SQL/测试 的 skill`
- `安装 @author/name`, `更新 skill`, `卸载 skill`, `这个 skill 有新版本吗`
- `发布页怎么填`, `这个 Skill 是做什么的怎么写`, `我发布了哪些 skill`, `我收到的反馈`
- `改权限`, `谁能安装`, `可见性`, `限定人员`, `access grant`
- `这个从平台装的 skill 报错了`, `skill 不触发`, `不好用`, `给 skill 提反馈`
- `一键脚本`, `PowerShell`, `Codex/Claude/Cursor/Antigravity 安装目录`

Only answer about the current agent session's already-loaded Skills when the user explicitly asks "what Skills are loaded in this conversation/session?"

## Defaults And Safety

- Prefer real CLI queries over memory: `agent-skills list/search/info/doctor/outdated`.
- CLI login is Marketplace login, separate from the host agent login.
- Default local API is `http://localhost:3000`; production deployments should use their own configured base URL.
- Do not read unrelated workspace notes to answer Marketplace questions.
- Do not automatically read, package, or upload user files. Feedback context should use only text the user provides or explicitly approves.
- If the slug is missing, locate it with `agent-skills search <keyword>` or `agent-skills list`.

## Quick Commands

```bash
agent-skills whoami
agent-skills login
agent-skills list
agent-skills search report
agent-skills info @community/marketplace-guide --full
agent-skills install @community/marketplace-guide
agent-skills outdated
agent-skills update --all
agent-skills feedback @author/name --type issue --message "Describe the failure"
agent-skills access @author/name
agent-skills access set @author/name --install company --visibility listed
```

CLI not installed:

```bash
# macOS / Linux
export PATH="$HOME/.local/bin:$PATH"; curl -fsSL http://localhost:3000/install.sh | bash

# Windows PowerShell
irm http://localhost:3000/install.ps1 | iex
```

After install:

```bash
agent-skills login
agent-skills whoami
agent-skills doctor
```

## References

- For full CLI commands and command options, read [references/cli-commands.md](references/cli-commands.md).
- For one-click installers, agent target numbers, install directories, and Cursor/Antigravity notes, read [references/install-targets.md](references/install-targets.md).
- For publishing, updating, managing versions, archive/restore, and owner feedback, read [references/publishing-management.md](references/publishing-management.md).
- For Skill errors, trigger failures, poor output, and feedback wording, read [references/feedback-troubleshooting.md](references/feedback-troubleshooting.md).

## Response Style

- For first-time users, keep answers short, steady, and runnable.
- If the user gives a clear target and slug, act directly and summarize the result.
- If the user asks about concepts, explain the relationship between Web Marketplace, CLI, local agent install directories, and feedback loop.
