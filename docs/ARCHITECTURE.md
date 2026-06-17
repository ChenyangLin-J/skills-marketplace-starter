# Architecture

Skills Marketplace Starter has three parts:

```text
Browser  -> Next.js Web + API -> SQLite + local uploads
Terminal -> agent-skills CLI  -> Next.js REST API
Agent    -> calls CLI         -> installs Skills locally
```

## Web

Path:

```text
code/app
```

Responsibilities:

- Render marketplace pages.
- Serve REST APIs.
- Parse and store uploaded Skill packages.
- Track versions, installs, likes, and feedback.
- Provide local development auth.

## CLI

Path:

```text
code/cli
```

Responsibilities:

- Search and inspect Skills.
- Install Skills into agent directories.
- Publish Skill folders.
- Update and uninstall local Skills.
- Submit feedback.

The CLI talks to the Web API only. It does not read SQLite or uploads directly.

## Data

Default local data path:

```text
code/app/data
```

Contents:

- `skills.db`
- `uploads/`
- `cli-releases/`

This directory should not be committed.

## Skill ID

Skills use a canonical id:

```text
@author/name
```

Example:

```text
@community/marketplace-guide
```
