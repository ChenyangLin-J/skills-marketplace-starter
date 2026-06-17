# Security

## Do Not Commit

- `.env` files
- SQLite databases
- Uploaded Skill zip files
- CLI credentials
- OAuth secrets
- Local screenshots or test evidence

## Local Data

The app stores local runtime data under:

```text
code/app/data
```

This path must stay gitignored.

## Before Publishing

Run:

```bash
rg -n "secret|token|password|client_secret|APP_SECRET|OPENAI_API_KEY|ANTHROPIC_API_KEY|Bearer"
```

Prefer also running:

```bash
gitleaks detect --no-git --source .
```

## Skill Packages

Skill packages can contain instructions, references, and scripts. Review Skill contents before installing untrusted packages.

Do not install Skills from untrusted sources into production agent environments without review.
