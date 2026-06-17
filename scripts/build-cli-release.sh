#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_DIR="$ROOT_DIR/code/cli"
RELEASE_DIR="$ROOT_DIR/code/app/data/cli-releases"

mkdir -p "$RELEASE_DIR"

cd "$CLI_DIR"
rm -rf "$CLI_DIR/dist"
uv build

WHEEL_PATH="$(find "$CLI_DIR/dist" -maxdepth 1 -name 'agent_skills-*.whl' -print | sort | tail -n 1)"
if [ -z "$WHEEL_PATH" ]; then
  echo "No agent_skills wheel found in $CLI_DIR/dist" >&2
  exit 1
fi

cp "$WHEEL_PATH" "$RELEASE_DIR/"
echo "Published CLI wheel:"
echo "  $RELEASE_DIR/$(basename "$WHEEL_PATH")"
