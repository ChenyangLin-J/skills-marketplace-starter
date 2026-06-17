#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/code/app"
DATA_DIR="${AGENT_SKILLS_DATA_DIR:-$APP_DIR/data}"
DATA_DIR="$(cd "$DATA_DIR" && pwd)"
export COPYFILE_DISABLE=1

if [ ! -f "$DATA_DIR/skills.db" ]; then
  echo "skills.db not found: $DATA_DIR/skills.db" >&2
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required for WAL checkpoint before packaging" >&2
  exit 1
fi

sqlite3 "$DATA_DIR/skills.db" 'PRAGMA wal_checkpoint(TRUNCATE);' >/dev/null

PKG_ROOT="/tmp/agent-skills-data-$(date +%Y%m%d%H%M%S)"
PKG_DATA="$PKG_ROOT/data"
mkdir -p "$PKG_DATA"

cp "$DATA_DIR/skills.db" "$PKG_DATA/"
cp "$DATA_DIR/skills.db-wal" "$PKG_DATA/" 2>/dev/null || true
cp "$DATA_DIR/skills.db-shm" "$PKG_DATA/" 2>/dev/null || true
cp -R "$DATA_DIR/uploads" "$PKG_DATA/"
cp -R "$DATA_DIR/cli-releases" "$PKG_DATA/"
find "$PKG_DATA" \( -name '._*' -o -name '.DS_Store' \) -delete

ARCHIVE="$PKG_ROOT.tgz"
tar -czf "$ARCHIVE" -C "$PKG_ROOT" data

echo "Runtime data package created:"
echo "  $ARCHIVE"
echo
echo "Source:"
echo "  $DATA_DIR"
echo
echo "Included:"
echo "  skills.db: $(ls -lh "$PKG_DATA/skills.db" | awk '{print $5}')"
echo "  upload zips: $(find "$PKG_DATA/uploads" -name '*.zip' | wc -l | tr -d ' ')"
echo "  CLI wheels: $(find "$PKG_DATA/cli-releases" -name 'agent_skills-*.whl' | wc -l | tr -d ' ')"
