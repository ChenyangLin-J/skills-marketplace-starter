import { marketplaceOrigin } from '@/lib/origin'

export const runtime = 'nodejs'

function script(origin: string): string {
  return `#!/usr/bin/env bash
set -euo pipefail

MARKETPLACE_URL="$(printenv AGENT_SKILLS_MARKETPLACE_URL || true)"
if [ -z "$MARKETPLACE_URL" ]; then
  MARKETPLACE_URL="${origin}"
fi
MARKETPLACE_URL="$(printf '%s' "$MARKETPLACE_URL" | sed 's#/$##')"

ORIGINAL_PATH="$PATH"
LOCAL_BIN="$HOME/.local/bin"
export PATH="$LOCAL_BIN:$PATH"

ensure_shell_path() {
  LINE='export PATH="$HOME/.local/bin:$PATH"'
  SHELL_NAME="$(basename "\${SHELL:-}")"
  RC_FILES=""
  case "$SHELL_NAME" in
    zsh) RC_FILES="$HOME/.zshrc" ;;
    bash) RC_FILES="$HOME/.bashrc" ;;
    *) RC_FILES="$HOME/.zshrc $HOME/.bashrc" ;;
  esac

  for rc in $RC_FILES; do
    mkdir -p "$(dirname "$rc")"
    touch "$rc"
    if ! grep -Fq '$HOME/.local/bin' "$rc" && ! grep -Fq "$HOME/.local/bin" "$rc"; then
      {
        echo
        echo "# agent-skills CLI"
        echo "$LINE"
      } >> "$rc"
      echo "Added ~/.local/bin to $rc for future terminals."
    fi
  done
}

link_cli_into_current_path() {
  CLI_PATH="$LOCAL_BIN/agent-skills"
  [ -x "$CLI_PATH" ] || return 1

  if PATH="$ORIGINAL_PATH" command -v agent-skills >/dev/null 2>&1; then
    return 0
  fi

  OLD_IFS="$IFS"
  IFS=:
  for dir in $ORIGINAL_PATH; do
    IFS="$OLD_IFS"
    [ -n "$dir" ] || continue
    [ -d "$dir" ] || continue
    [ -w "$dir" ] || continue
    [ -O "$dir" ] || continue
    target="$dir/agent-skills"
    if [ -e "$target" ] && [ ! -L "$target" ]; then
      IFS=:
      continue
    fi
    if ln -sf "$CLI_PATH" "$target" 2>/dev/null; then
      echo "Linked agent-skills into current PATH: $target"
      IFS="$OLD_IFS"
      return 0
    fi
    IFS=:
  done
  IFS="$OLD_IFS"
  return 1
}

print_cli_next_steps() {
  echo
  if PATH="$ORIGINAL_PATH" command -v agent-skills >/dev/null 2>&1; then
    echo "You can now run in this terminal:"
    echo "  agent-skills login"
  elif link_cli_into_current_path; then
    echo "You can now run in this terminal:"
    echo "  agent-skills login"
  else
    echo "agent-skills is installed at:"
    echo "  $LOCAL_BIN/agent-skills"
    echo "For this current terminal, run:"
    echo "  export PATH=\"\\$HOME/.local/bin:\\$PATH\""
    echo "  agent-skills login"
  fi
  echo
  echo "Future terminals should work after shell config reload. If not, run:"
  case "$(basename "\${SHELL:-}")" in
    zsh) echo "  source ~/.zshrc" ;;
    bash) echo "  source ~/.bashrc" ;;
    *) echo "  source ~/.zshrc  # or source ~/.bashrc" ;;
  esac
}

if ! command -v uv >/dev/null 2>&1; then
  echo "Installing uv..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$LOCAL_BIN:$PATH"
fi

UV_BIN="$(command -v uv || true)"
if [ -z "$UV_BIN" ] && [ -x "$HOME/.local/bin/uv" ]; then
  UV_BIN="$HOME/.local/bin/uv"
fi
if [ -z "$UV_BIN" ]; then
  echo "uv install failed: uv not found on PATH" >&2
  exit 1
fi

echo "Fetching agent-skills release..."
WHEEL_URL="$("$UV_BIN" run --quiet python - "$MARKETPLACE_URL" <<'PY'
import json
import sys
import urllib.request

base = sys.argv[1].rstrip("/")
req = urllib.request.Request(
    base + "/api/cli/releases/latest",
)
with urllib.request.urlopen(req, timeout=30) as resp:
    data = json.load(resp)
print(data["wheel_url"])
PY
)"

echo "Installing agent-skills..."
"$UV_BIN" tool install --force "$WHEEL_URL"
"$UV_BIN" tool update-shell >/dev/null 2>&1 || true
ensure_shell_path

mkdir -p "$HOME/.agent-skills"
cat > "$HOME/.agent-skills/config.toml" <<EOF
api_base_url = "$MARKETPLACE_URL"
default_agent = "ask"
auto_update = true
EOF

CLI_BIN="$(command -v agent-skills || true)"
if [ -z "$CLI_BIN" ] && [ -x "$HOME/.local/bin/agent-skills" ]; then
  CLI_BIN="$HOME/.local/bin/agent-skills"
fi

default_guide_target() {
  if [ -d "$HOME/.codex" ]; then
    printf 'codex'
  elif [ -d "$HOME/.claude" ]; then
    printf 'claude'
  elif [ -d "$HOME/.cursor" ]; then
    printf 'cursor'
  elif [ -d "$HOME/.antigravity" ]; then
    printf 'antigravity'
  else
    printf 'codex'
  fi
}

append_guide_target() {
  case "$1" in
    codex|claude|cursor|antigravity)
      case " $GUIDE_TARGETS " in
        *" $1 "*) ;;
        *) GUIDE_TARGETS="$GUIDE_TARGETS $1" ;;
      esac
      ;;
    *)
      GUIDE_INVALID_TARGETS="$GUIDE_INVALID_TARGETS $1"
      ;;
  esac
}

append_guide_target_by_number() {
  case "$1" in
    1) append_guide_target codex ;;
    2) append_guide_target claude ;;
    3) append_guide_target cursor ;;
    4) append_guide_target antigravity ;;
    5) GUIDE_TARGETS="__skip__" ;;
    *) GUIDE_INVALID_TARGETS="$GUIDE_INVALID_TARGETS $1" ;;
  esac
}

parse_guide_targets() {
  GUIDE_TARGETS=""
  GUIDE_INVALID_TARGETS=""
  GUIDE_SELECTION="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr ',;/' '   ')"

  for token in $GUIDE_SELECTION; do
    case "$token" in
      skip|none|no|n)
        GUIDE_TARGETS="__skip__"
        return 0
        ;;
      all)
        append_guide_target codex
        append_guide_target claude
        append_guide_target cursor
        append_guide_target antigravity
        ;;
      codex|claude|cursor|antigravity)
        append_guide_target "$token"
        ;;
      *)
        if [[ "$token" =~ ^[1-5]+$ ]]; then
          i=0
          while [ "$i" -lt "\${#token}" ]; do
            append_guide_target_by_number "\${token:$i:1}"
            if [ "$GUIDE_TARGETS" = "__skip__" ]; then
              return 0
            fi
            i=$((i + 1))
          done
        else
          GUIDE_INVALID_TARGETS="$GUIDE_INVALID_TARGETS $token"
        fi
        ;;
    esac
  done
}

install_guide_skill() {
  if [ -z "$CLI_BIN" ]; then
    return 0
  fi

  GUIDE_TARGET="$(printenv AGENT_SKILLS_GUIDE_TARGET || true)"
  if [ -z "$GUIDE_TARGET" ]; then
    DEFAULT_GUIDE_TARGET="$(default_guide_target)"
    if { exec 3<>/dev/tty; } 2>/dev/null; then
      echo
      echo "Install the starter guide skill? Choose one or more:" >&3
      echo "  1) Codex        ~/.codex/skills/" >&3
      echo "  2) Claude       ~/.claude/skills/" >&3
      echo "  3) Cursor       ~/.cursor/skills/" >&3
      echo "  4) Antigravity  ~/.antigravity/skills/" >&3
      echo "  5) Skip" >&3
      echo "Examples: 1, 12, 1 2, codex,claude, all" >&3
      printf "Target agents (default: %s): " "$DEFAULT_GUIDE_TARGET" >&3
      IFS= read -r GUIDE_TARGET <&3 || GUIDE_TARGET=""
      exec 3>&- 3<&-
      if [ -z "$GUIDE_TARGET" ]; then
        GUIDE_TARGET="$DEFAULT_GUIDE_TARGET"
      fi
    else
      echo "No interactive terminal detected; skipping guide skill install."
      echo "To install it automatically, rerun with: AGENT_SKILLS_GUIDE_TARGET=12"
      return 0
    fi
  fi

  parse_guide_targets "$GUIDE_TARGET"

  if [ "$GUIDE_TARGETS" = "__skip__" ]; then
    echo "Skipping guide skill install."
    return 0
  fi
  if [ -n "$GUIDE_INVALID_TARGETS" ]; then
    echo "Unknown guide skill target(s):$GUIDE_INVALID_TARGETS. Skipping guide skill install." >&2
    return 0
  fi
  if [ -z "$GUIDE_TARGETS" ]; then
    echo "No guide skill target selected. Skipping guide skill install."
    return 0
  fi

  FIRST_GUIDE_TARGET=""
  for target in $GUIDE_TARGETS; do
    case "$target" in
      codex|claude|cursor|antigravity)
      echo
      echo "Installing starter guide skill to $target..."
      if "$CLI_BIN" install @community/marketplace-guide --target "$target" --yes; then
        if [ -z "$FIRST_GUIDE_TARGET" ]; then
          FIRST_GUIDE_TARGET="$target"
        fi
      else
        echo "Guide skill install failed for $target; CLI install is still complete." >&2
      fi
      ;;
    esac
  done

  if [ -n "$FIRST_GUIDE_TARGET" ]; then
    "$CLI_BIN" config set default_agent "$FIRST_GUIDE_TARGET" >/dev/null 2>&1 || true
  fi
}

echo
echo "agent-skills installed."
if [ -n "$CLI_BIN" ]; then
  install_guide_skill
  "$CLI_BIN" doctor || true
  print_cli_next_steps
else
  print_cli_next_steps
fi
`
}

export async function GET() {
  const origin = marketplaceOrigin()
  return new Response(script(origin), {
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
