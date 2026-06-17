# Skills Marketplace Web

Next.js App Router app for the self-hosted Skills Marketplace Starter.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` for local development.

Runtime data is local and ignored by git:

```txt
data/
  skills.db
  uploads/
  cli-releases/
```

## Local Login

The starter defaults to local demo auth. Open this URL or use the navbar login:

```txt
http://localhost:3000/api/auth/dev-login
```

The demo user is `@demo`. Replace the auth layer when you connect a real identity provider.

## Alerts

API errors go through `apiError()`. Server request errors are captured by
`instrumentation.ts`; browser errors and unhandled promise rejections are
captured by `instrumentation-client.ts`.

Alerts are optional. Configure a generic JSON webhook when you want error
notifications:

```bash
ALERT_WEBHOOK_URL=https://example.com/hooks/skills-marketplace
ALERT_DEDUPE_MS=300000
```

If no webhook is configured, alert calls become no-ops. Set `ALERT_LOG_ONLY=1`
to print alert payloads to server logs during local development.

## Main Routes

- `/`: marketplace home, search, category filters, skill list
- `/skills/[slug]`: skill detail, README rendering, install actions
- `/publish`: upload a skill zip or folder
- `/mine`: manage your skills and feedback
- `/admin`: local admin directory for the demo user
- `/docs`: tutorial center
- `/install.sh` / `/install.ps1`: CLI install scripts
- `/api/auth/cli/*`: CLI browser login, token polling, whoami, logout
- `/api/skills/[slug]/versions`: version history
- `/api/skills/[slug]/feedback`: Web / CLI feedback
- `/api/skills/[slug]/install.sh` / `/api/skills/[slug]/install.ps1`: per-skill install scripts

## Tutorial Content

Tutorials are repo-native Markdown files:

```txt
content/tutorials/
  what-is-skill-marketplace.md
  install-first-skill.md
  run-a-skill.md
  read-skill-detail.md
  create-first-skill.md
  skill-writing-guide.md
  publish-skill.md
  manage-skill.md
  feedback-skill.md
  troubleshooting.md
```

## CLI Release

Build the latest CLI wheel and publish it into the app data directory:

```bash
cd ../..
./scripts/build-cli-release.sh
```

The install scripts and `agent-skills self update` read from
`/api/cli/releases/latest`. The install script also offers to install
`@community/marketplace-guide` to Codex / Claude Code / Cursor / Antigravity.

## Data Check

```bash
sqlite3 data/skills.db 'SELECT COUNT(*) FROM skills;'
sqlite3 data/skills.db 'SELECT COUNT(*) FROM skill_versions;'
curl http://localhost:3000/api/cli/releases/latest
curl http://localhost:3000/api/skills?limit=1
```

## Checks

```bash
npm run lint
npm run build
```
