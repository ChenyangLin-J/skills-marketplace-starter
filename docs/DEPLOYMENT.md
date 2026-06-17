# Deployment

The starter is local-first. Production deployment is intentionally simple.

## Minimal Deployment

1. Deploy `code/app` as a Node.js service.
2. Set `APP_BASE_URL` to the public URL.
3. Persist `code/app/data`.
4. Build or publish the CLI wheel if using one-click install scripts.

## Required Environment

```env
APP_NAME="Skills Marketplace Starter"
APP_BASE_URL="https://your-domain.example"
AUTH_MODE="local"
STORAGE_DRIVER="local"
DATA_DIR="./data"
SESSION_SECRET="replace-me"
```

## Storage

The first version uses local disk. Make sure the data directory is persistent.

External object storage can be added later by implementing a storage adapter.

## Auth

The starter defaults to local auth for development and small internal deployments.

OAuth providers can be added later, but are not required for the starter to run.
