import { apiError, decodeSlug } from '@/lib/api'
import { marketplaceOrigin } from '@/lib/origin'
import { checkSkillVisibility, getSkillBySlug } from '@/lib/skills'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { userIdOrAnonymous } from '@/lib/auth/session'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function script(skill: NonNullable<ReturnType<typeof getSkillBySlug>>): string {
  const origin = marketplaceOrigin()
  const encodedSlug = encodeURIComponent(skill.slug)
  const downloadUrl = `${origin}/api/skills/${encodedSlug}/download`
  const installUrl = `${origin}/api/skills/${encodedSlug}/install`

  return `#!/usr/bin/env bash
set -euo pipefail

MARKETPLACE_URL=${shQuote(origin)}
DOWNLOAD_URL=${shQuote(downloadUrl)}
INSTALL_EVENT_URL=${shQuote(installUrl)}
SKILL_NAME=${shQuote(skill.name)}
SKILL_SLUG=${shQuote(skill.slug)}
SKILL_VERSION=${shQuote(skill.version)}
REQUIRES_AUTH=${skill.install_access === 'anonymous' ? '0' : '1'}
CREDENTIALS_PATH="\${AGENT_SKILLS_CREDENTIALS_PATH:-$HOME/.agent-skills/credentials.json}"
CLI_INSTALL_URL="$MARKETPLACE_URL/install.sh"

default_skill_target() {
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

append_skill_target() {
  case "$1" in
    codex|claude|cursor|antigravity)
      case " $SKILL_TARGETS " in
        *" $1 "*) ;;
        *) SKILL_TARGETS="$SKILL_TARGETS $1" ;;
      esac
      ;;
    *)
      SKILL_INVALID_TARGETS="$SKILL_INVALID_TARGETS $1"
      ;;
  esac
}

append_skill_target_by_number() {
  case "$1" in
    1) append_skill_target codex ;;
    2) append_skill_target claude ;;
    3) append_skill_target cursor ;;
    4) append_skill_target antigravity ;;
    5) SKILL_TARGETS="__skip__" ;;
    *) SKILL_INVALID_TARGETS="$SKILL_INVALID_TARGETS $1" ;;
  esac
}

parse_skill_targets() {
  SKILL_TARGETS=""
  SKILL_INVALID_TARGETS=""
  SKILL_SELECTION="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr ',;/' '   ')"

  for token in $SKILL_SELECTION; do
    case "$token" in
      skip|none|no|n)
        SKILL_TARGETS="__skip__"
        return 0
        ;;
      all)
        append_skill_target codex
        append_skill_target claude
        append_skill_target cursor
        append_skill_target antigravity
        ;;
      codex|claude|cursor|antigravity)
        append_skill_target "$token"
        ;;
      *)
        if [[ "$token" =~ ^[1-5]+$ ]]; then
          i=0
          while [ "$i" -lt "\${#token}" ]; do
            append_skill_target_by_number "\${token:$i:1}"
            if [ "$SKILL_TARGETS" = "__skip__" ]; then
              return 0
            fi
            i=$((i + 1))
          done
        else
          SKILL_INVALID_TARGETS="$SKILL_INVALID_TARGETS $token"
        fi
        ;;
    esac
  done
}

target_root_for() {
  if [ -n "$(printenv AGENT_SKILLS_TARGET_ROOT || true)" ]; then
    printf '%s/%s/skills' "$(printenv AGENT_SKILLS_TARGET_ROOT)" "$1"
    return 0
  fi

  case "$1" in
    codex) printf '%s/.codex/skills' "$HOME" ;;
    claude) printf '%s/.claude/skills' "$HOME" ;;
    cursor) printf '%s/.cursor/skills' "$HOME" ;;
    antigravity) printf '%s/.antigravity/skills' "$HOME" ;;
  esac
}

load_auth_token() {
  if [ ! -f "$CREDENTIALS_PATH" ]; then
    return 1
  fi
  if ! command -v python3 >/dev/null 2>&1; then
    return 1
  fi
  python3 - "$CREDENTIALS_PATH" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], "r", encoding="utf-8") as f:
        token = json.load(f).get("token", "")
except Exception:
    token = ""
if token:
    print(token)
PY
}

agent_skills_cli_installed() {
  command -v agent-skills >/dev/null 2>&1
}

print_cli_install_hint() {
  echo "Tip: agent-skills CLI is not installed yet." >&2
  echo "Install it if you want Marketplace login, search, updates, or feedback from your Agent:" >&2
  echo "  curl -fsSL $CLI_INSTALL_URL | bash" >&2
}

print_login_required_hint() {
  if agent_skills_cli_installed; then
    echo "This Skill requires Marketplace login. Run these commands, then retry this script:" >&2
    echo "  agent-skills login" >&2
    echo "  agent-skills whoami" >&2
  else
    echo "This Skill requires Marketplace login, but agent-skills CLI is not installed yet." >&2
    echo "Install the CLI first, log in, then retry this script:" >&2
    echo "  curl -fsSL $CLI_INSTALL_URL | bash" >&2
    echo "  agent-skills login" >&2
    echo "  agent-skills whoami" >&2
  fi
}

report_install() {
  if [ -n "$AUTH_TOKEN" ]; then
    curl -fsS -X POST "$INSTALL_EVENT_URL" \\
      -H "Authorization: Bearer $AUTH_TOKEN" \\
      -H 'Content-Type: application/json' \\
      -d "{\\"agent\\":\\"$1\\",\\"source\\":\\"script\\",\\"version\\":\\"$SKILL_VERSION\\"}" \\
      >/dev/null 2>&1 || true
  else
    curl -fsS -X POST "$INSTALL_EVENT_URL" \\
      -H 'Content-Type: application/json' \\
      -d "{\\"agent\\":\\"$1\\",\\"source\\":\\"script\\",\\"version\\":\\"$SKILL_VERSION\\"}" \\
      >/dev/null 2>&1 || true
  fi
}

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi
if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip is required" >&2
  exit 1
fi
if ! agent_skills_cli_installed; then
  print_cli_install_hint
fi

AUTH_TOKEN=""
if [ "$REQUIRES_AUTH" = "1" ]; then
  AUTH_TOKEN="$(load_auth_token || true)"
fi
if [ "$REQUIRES_AUTH" = "1" ] && [ -z "$AUTH_TOKEN" ]; then
  print_login_required_hint
  exit 1
fi

SELECTION="$(printenv AGENT_SKILLS_TARGETS || true)"
if [ -z "$SELECTION" ]; then
  DEFAULT_TARGET="$(default_skill_target)"
  if { exec 3<>/dev/tty; } 2>/dev/null; then
    echo "Install $SKILL_SLUG? Choose one or more:" >&3
    echo "  1) Codex        ~/.codex/skills/" >&3
    echo "  2) Claude       ~/.claude/skills/" >&3
    echo "  3) Cursor       ~/.cursor/skills/" >&3
    echo "  4) Antigravity  ~/.antigravity/skills/" >&3
    echo "  5) Skip" >&3
    echo "Examples: 1, 12, 1 2, codex,claude, all" >&3
    printf "Target agents (default: %s): " "$DEFAULT_TARGET" >&3
    IFS= read -r SELECTION <&3 || SELECTION=""
    exec 3>&- 3<&-
    if [ -z "$SELECTION" ]; then
      SELECTION="$DEFAULT_TARGET"
    fi
  else
    echo "No interactive terminal detected; defaulting to $DEFAULT_TARGET."
    SELECTION="$DEFAULT_TARGET"
  fi
fi

parse_skill_targets "$SELECTION"
if [ "$SKILL_TARGETS" = "__skip__" ]; then
  echo "Skipped."
  exit 0
fi
if [ -n "$SKILL_INVALID_TARGETS" ]; then
  echo "Unknown target(s):$SKILL_INVALID_TARGETS" >&2
  exit 2
fi
if [ -z "$SKILL_TARGETS" ]; then
  echo "No target selected." >&2
  exit 2
fi

ZIP_PATH="$(mktemp -t agent-skill.XXXXXX.zip)"
trap 'rm -f "$ZIP_PATH"' EXIT

echo "Downloading $SKILL_SLUG from $MARKETPLACE_URL..."
if [ -n "$AUTH_TOKEN" ]; then
  curl -fsSL -H "Authorization: Bearer $AUTH_TOKEN" "$DOWNLOAD_URL" -o "$ZIP_PATH"
else
  curl -fsSL "$DOWNLOAD_URL" -o "$ZIP_PATH"
fi

for target in $SKILL_TARGETS; do
  root="$(target_root_for "$target")"
  dest="$root/$SKILL_NAME"
  echo "Installing to $target: $dest"
  rm -rf "$dest"
  mkdir -p "$dest"
  unzip -q "$ZIP_PATH" -d "$dest"
  report_install "$target"
done

echo "Done."
`
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const currentUser = getAuthenticatedUserFromRequest(req)
  const skill = getSkillBySlug(slug, userIdOrAnonymous(currentUser))
  if (!skill) return apiError(404, 'not_found', `skill ${slug} 不存在`)
  const decision = checkSkillVisibility(skill, currentUser)
  if (!decision.allowed) return apiError(decision.status, decision.code, decision.message)

  return new Response(script(skill), {
    headers: {
      'Content-Type': 'text/x-shellscript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
