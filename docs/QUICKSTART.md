# Quickstart

This guide gets the starter running locally.

## 1. Start The Web App

```bash
cd code/app
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

## 2. Seed Demo Skills

The starter ships with demo Skills under `skills/`.

On first database open, the Web app automatically seeds demo Skills when the
`skills` table is empty. Set `AGENT_SKILLS_DISABLE_AUTO_SEED=1` if you want to
start with an empty marketplace.

Expected demo Skills:

- `@community/marketplace-guide`
- `@community/skill-creator`
- `@demo/hello-world`
- `@demo/report-writer`

## 3. Use The CLI

```bash
cd code/cli
uv run agent-skills --help
uv run agent-skills config set api_base_url http://localhost:3000
uv run agent-skills list
```

## 4. Install A Skill Safely

Use isolated directories for testing:

```bash
HOME=/tmp/agent-skills-home \
AGENT_SKILLS_TARGET_ROOT=/tmp/agent-skills-targets \
uv run agent-skills install @community/marketplace-guide --target codex --yes
```

Check:

```bash
ls /tmp/agent-skills-targets/codex/skills/marketplace-guide/SKILL.md
```
