import { apiError, decodeSlug } from '@/lib/api'
import { marketplaceOrigin } from '@/lib/origin'
import { checkSkillVisibility, getSkillBySlug } from '@/lib/skills'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { userIdOrAnonymous } from '@/lib/auth/session'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

function psQuote(value: string): string {
  return `"${value.replace(/`/g, '``').replace(/"/g, '`"')}"`
}

function script(skill: NonNullable<ReturnType<typeof getSkillBySlug>>): string {
  const origin = marketplaceOrigin()
  const encodedSlug = encodeURIComponent(skill.slug)
  const downloadUrl = `${origin}/api/skills/${encodedSlug}/download`
  const installUrl = `${origin}/api/skills/${encodedSlug}/install`

  return `$ErrorActionPreference = "Stop"

$MarketplaceUrl = ${psQuote(origin)}
$DownloadUrl = ${psQuote(downloadUrl)}
$InstallEventUrl = ${psQuote(installUrl)}
$SkillName = ${psQuote(skill.name)}
$SkillSlug = ${psQuote(skill.slug)}
$SkillVersion = ${psQuote(skill.version)}
$RequiresAuth = ${skill.install_access === 'anonymous' ? '$false' : '$true'}
$CliInstallUrl = "$MarketplaceUrl/install.ps1"
$CredentialsPath = if ([string]::IsNullOrWhiteSpace($env:AGENT_SKILLS_CREDENTIALS_PATH)) {
  Join-Path $HOME ".agent-skills\\credentials.json"
} else {
  $env:AGENT_SKILLS_CREDENTIALS_PATH
}
$AgentSkillsCommand = Get-Command agent-skills -ErrorAction SilentlyContinue

function Show-CliInstallHint {
  Write-Warning "agent-skills CLI is not installed yet."
  Write-Host "Install it if you want Marketplace login, search, updates, or feedback from your Agent:"
  Write-Host "  irm $CliInstallUrl | iex"
}

function Show-LoginRequiredHint {
  if ($AgentSkillsCommand) {
    Write-Warning "This Skill requires Marketplace login. Run these commands, then retry this script:"
    Write-Host "  agent-skills login"
    Write-Host "  agent-skills whoami"
  } else {
    Write-Warning "This Skill requires Marketplace login, but agent-skills CLI is not installed yet."
    Write-Host "Install the CLI first, log in, then retry this script:"
    Write-Host "  irm $CliInstallUrl | iex"
    Write-Host "  agent-skills login"
    Write-Host "  agent-skills whoami"
  }
}

function Get-DefaultSkillTarget {
  if (Test-Path (Join-Path $HOME ".codex")) { return "codex" }
  if (Test-Path (Join-Path $HOME ".claude")) { return "claude" }
  if (Test-Path (Join-Path $HOME ".cursor")) { return "cursor" }
  if (Test-Path (Join-Path $HOME ".antigravity")) { return "antigravity" }
  return "codex"
}

function Add-SkillTarget {
  param(
    [System.Collections.Generic.List[string]] $Targets,
    [string] $Target
  )
  if ($Target -in @("codex", "claude", "cursor", "antigravity") -and -not $Targets.Contains($Target)) {
    $Targets.Add($Target) | Out-Null
  }
}

function Parse-SkillTargets {
  param([string] $Selection)

  $Targets = [System.Collections.Generic.List[string]]::new()
  $Invalid = [System.Collections.Generic.List[string]]::new()
  $Skip = $false
  $Tokens = $Selection.ToLowerInvariant() -split "[,;/\\s]+" | Where-Object { $_ }

  foreach ($Token in $Tokens) {
    if ($Token -in @("skip", "none", "no", "n")) {
      $Skip = $true
      break
    }
    if ($Token -eq "all") {
      Add-SkillTarget $Targets "codex"
      Add-SkillTarget $Targets "claude"
      Add-SkillTarget $Targets "cursor"
      Add-SkillTarget $Targets "antigravity"
      continue
    }
    if ($Token -in @("codex", "claude", "cursor", "antigravity")) {
      Add-SkillTarget $Targets $Token
      continue
    }
    if ($Token -match "^[1-5]+$") {
      foreach ($Digit in $Token.ToCharArray()) {
        switch ($Digit) {
          "1" { Add-SkillTarget $Targets "codex" }
          "2" { Add-SkillTarget $Targets "claude" }
          "3" { Add-SkillTarget $Targets "cursor" }
          "4" { Add-SkillTarget $Targets "antigravity" }
          "5" { $Skip = $true; break }
          default { $Invalid.Add([string]$Digit) | Out-Null }
        }
        if ($Skip) { break }
      }
      if ($Skip) { break }
      continue
    }
    $Invalid.Add($Token) | Out-Null
  }

  [pscustomobject]@{
    Targets = $Targets.ToArray()
    Invalid = $Invalid.ToArray()
    Skip = $Skip
  }
}

function Get-TargetRoot {
  param([string] $Target)
  if (-not [string]::IsNullOrWhiteSpace($env:AGENT_SKILLS_TARGET_ROOT)) {
    return Join-Path (Join-Path $env:AGENT_SKILLS_TARGET_ROOT $Target) "skills"
  }
  switch ($Target) {
    "codex" { return Join-Path $HOME ".codex\\skills" }
    "claude" { return Join-Path $HOME ".claude\\skills" }
    "cursor" { return Join-Path $HOME ".cursor\\skills" }
    "antigravity" { return Join-Path $HOME ".antigravity\\skills" }
  }
}

function Get-AuthHeaders {
  if (-not $RequiresAuth) {
    return @{}
  }
  if (-not (Test-Path $CredentialsPath)) {
    Show-LoginRequiredHint
    throw "Marketplace login is required."
  }
  $Token = ((Get-Content -Raw -Path $CredentialsPath) | ConvertFrom-Json).token
  if ([string]::IsNullOrWhiteSpace($Token)) {
    Show-LoginRequiredHint
    throw "Marketplace login is required."
  }
  return @{ Authorization = "Bearer $Token" }
}

function Report-Install {
  param([string] $Target)
  try {
    $Body = @{
      agent = $Target
      source = "script"
      version = $SkillVersion
    } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri $InstallEventUrl -Headers $AuthHeaders -ContentType "application/json" -Body $Body | Out-Null
  } catch {}
}

if (-not $AgentSkillsCommand) {
  Show-CliInstallHint
}

$AuthHeaders = Get-AuthHeaders

$Selection = $env:AGENT_SKILLS_TARGETS
if ([string]::IsNullOrWhiteSpace($Selection)) {
  $DefaultTarget = Get-DefaultSkillTarget
  Write-Host "Install $SkillSlug? Choose one or more:"
  Write-Host "  1) Codex        ~/.codex/skills/"
  Write-Host "  2) Claude       ~/.claude/skills/"
  Write-Host "  3) Cursor       ~/.cursor/skills/"
  Write-Host "  4) Antigravity  ~/.antigravity/skills/"
  Write-Host "  5) Skip"
  Write-Host "Examples: 1, 12, 1 2, codex,claude, all"
  $Selection = Read-Host "Target agents (default: $DefaultTarget)"
  if ([string]::IsNullOrWhiteSpace($Selection)) {
    $Selection = $DefaultTarget
  }
}

$Parsed = Parse-SkillTargets $Selection
if ($Parsed.Skip) {
  Write-Host "Skipped."
  exit 0
}
if ($Parsed.Invalid.Count -gt 0) {
  throw "Unknown target(s): $($Parsed.Invalid -join ', ')"
}
if ($Parsed.Targets.Count -eq 0) {
  throw "No target selected."
}

$ZipPath = Join-Path ([System.IO.Path]::GetTempPath()) ("agent-skill-" + [System.Guid]::NewGuid().ToString("N") + ".zip")
try {
  Write-Host "Downloading $SkillSlug from $MarketplaceUrl..."
  Invoke-WebRequest -Uri $DownloadUrl -Headers $AuthHeaders -OutFile $ZipPath

  foreach ($Target in $Parsed.Targets) {
    $Root = Get-TargetRoot $Target
    $Dest = Join-Path $Root $SkillName
    Write-Host ("Installing to " + $Target + ": " + $Dest)
    if (Test-Path $Dest) {
      Remove-Item -Recurse -Force $Dest
    }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    Expand-Archive -Path $ZipPath -DestinationPath $Dest -Force
    Report-Install $Target
  }
  Write-Host "Done."
} finally {
  Remove-Item -Force $ZipPath -ErrorAction SilentlyContinue
}
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
  if (!skill) return apiError(404, 'not_found', `skill ${slug} does not exist`)
  const decision = checkSkillVisibility(skill, currentUser)
  if (!decision.allowed) return apiError(decision.status, decision.code, decision.message)

  return new Response(script(skill), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
