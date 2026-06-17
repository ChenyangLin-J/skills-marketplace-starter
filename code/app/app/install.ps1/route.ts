import { marketplaceOrigin } from '@/lib/origin'

export const runtime = 'nodejs'

function script(origin: string): string {
  return `$ErrorActionPreference = "Stop"

$MarketplaceUrl = $env:AGENT_SKILLS_MARKETPLACE_URL
if ([string]::IsNullOrWhiteSpace($MarketplaceUrl)) {
  $MarketplaceUrl = "${origin}"
}
$MarketplaceUrl = $MarketplaceUrl.TrimEnd("/")

$LocalBin = Join-Path $HOME ".local\\bin"
$env:Path = "$LocalBin;$env:Path"

function Test-PathListContains {
  param(
    [string] $PathValue,
    [string] $Dir
  )
  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    return $false
  }
  $Target = $Dir.TrimEnd("\\", "/")
  foreach ($Part in ($PathValue -split [System.IO.Path]::PathSeparator)) {
    if ($Part.TrimEnd("\\", "/") -ieq $Target) {
      return $true
    }
  }
  return $false
}

function Ensure-UserPath {
  $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not (Test-PathListContains $UserPath $LocalBin)) {
    $NextUserPath = if ([string]::IsNullOrWhiteSpace($UserPath)) {
      $LocalBin
    } else {
      "$LocalBin$([System.IO.Path]::PathSeparator)$UserPath"
    }
    [Environment]::SetEnvironmentVariable("Path", $NextUserPath, "User")
    Write-Host "Added $LocalBin to the user PATH for future PowerShell sessions."
  }
}

function Show-CliNextSteps {
  Write-Host ""
  $CliNow = Get-Command agent-skills -ErrorAction SilentlyContinue
  if ($CliNow) {
    Write-Host "You can now run in this PowerShell:"
    Write-Host "  agent-skills login"
  } else {
    $Candidate = Join-Path $LocalBin "agent-skills.exe"
    Write-Host "agent-skills is installed at:"
    Write-Host "  $Candidate"
    Write-Host "For this current PowerShell, run:"
    Write-Host ('  $env:Path = "' + $LocalBin + ';$env:Path"')
    Write-Host "  agent-skills login"
  }
  Write-Host ""
  Write-Host "Future PowerShell windows should work automatically. If an old window still cannot find it, open a new PowerShell window."
}

$UvCommand = Get-Command uv -ErrorAction SilentlyContinue
if (-not $UvCommand) {
  Write-Host "Installing uv..."
  irm https://astral.sh/uv/install.ps1 | iex
  $env:Path = "$LocalBin;$env:Path"
  $UvCommand = Get-Command uv -ErrorAction SilentlyContinue
}
if (-not $UvCommand) {
  throw "uv install failed: uv not found on PATH"
}
$Uv = $UvCommand.Source

Write-Host "Fetching agent-skills release..."
$Manifest = Invoke-RestMethod -Uri "$MarketplaceUrl/api/cli/releases/latest"

Write-Host "Installing agent-skills..."
& $Uv tool install --force $Manifest.wheel_url
try { & $Uv tool update-shell | Out-Null } catch {}
Ensure-UserPath

$ConfigDir = Join-Path $HOME ".agent-skills"
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
$ConfigPath = Join-Path $ConfigDir "config.toml"
@"
api_base_url = "$MarketplaceUrl"
default_agent = "ask"
auto_update = true
"@ | Set-Content -Encoding UTF8 -Path $ConfigPath

$CliCommand = Get-Command agent-skills -ErrorAction SilentlyContinue
if (-not $CliCommand) {
  $Candidate = Join-Path $LocalBin "agent-skills.exe"
  if (Test-Path $Candidate) {
    $CliCommand = @{ Source = $Candidate }
  }
}

function Get-DefaultGuideTarget {
  if (Test-Path (Join-Path $HOME ".codex")) { return "codex" }
  if (Test-Path (Join-Path $HOME ".claude")) { return "claude" }
  if (Test-Path (Join-Path $HOME ".cursor")) { return "cursor" }
  if (Test-Path (Join-Path $HOME ".antigravity")) { return "antigravity" }
  return "codex"
}

function Add-GuideTarget {
  param(
    [System.Collections.Generic.List[string]] $Targets,
    [string] $Target
  )
  if ($Target -in @("codex", "claude", "cursor", "antigravity") -and -not $Targets.Contains($Target)) {
    $Targets.Add($Target) | Out-Null
  }
}

function Parse-GuideTargets {
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
      Add-GuideTarget $Targets "codex"
      Add-GuideTarget $Targets "claude"
      Add-GuideTarget $Targets "cursor"
      Add-GuideTarget $Targets "antigravity"
      continue
    }
    if ($Token -in @("codex", "claude", "cursor", "antigravity")) {
      Add-GuideTarget $Targets $Token
      continue
    }
    if ($Token -match "^[1-5]+$") {
      foreach ($Digit in $Token.ToCharArray()) {
        switch ($Digit) {
          "1" { Add-GuideTarget $Targets "codex" }
          "2" { Add-GuideTarget $Targets "claude" }
          "3" { Add-GuideTarget $Targets "cursor" }
          "4" { Add-GuideTarget $Targets "antigravity" }
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

function Install-GuideSkill {
  if (-not $CliCommand) {
    return
  }

  $GuideTarget = $env:AGENT_SKILLS_GUIDE_TARGET
  if ([string]::IsNullOrWhiteSpace($GuideTarget)) {
    $DefaultGuideTarget = Get-DefaultGuideTarget
    Write-Host ""
    try {
      Write-Host "Install the starter guide skill? Choose one or more:"
      Write-Host "  1) Codex        ~/.codex/skills/"
      Write-Host "  2) Claude       ~/.claude/skills/"
      Write-Host "  3) Cursor       ~/.cursor/skills/"
      Write-Host "  4) Antigravity  ~/.antigravity/skills/"
      Write-Host "  5) Skip"
      Write-Host "Examples: 1, 12, 1 2, codex,claude, all"
      $GuideTarget = Read-Host "Target agents (default: $DefaultGuideTarget)"
    } catch {
      Write-Host "No interactive terminal detected; skipping guide skill install."
      Write-Host "To install it automatically, set AGENT_SKILLS_GUIDE_TARGET=12 before rerun."
      return
    }
    if ([string]::IsNullOrWhiteSpace($GuideTarget)) {
      $GuideTarget = $DefaultGuideTarget
    }
  }

  $ParsedGuideTargets = Parse-GuideTargets $GuideTarget
  if ($ParsedGuideTargets.Skip) {
    Write-Host "Skipping guide skill install."
    return
  }
  if ($ParsedGuideTargets.Invalid.Count -gt 0) {
    Write-Warning "Unknown guide skill target(s): $($ParsedGuideTargets.Invalid -join ', '). Skipping guide skill install."
    return
  }
  if ($ParsedGuideTargets.Targets.Count -eq 0) {
    Write-Host "No guide skill target selected. Skipping guide skill install."
    return
  }

  $FirstGuideTarget = $null
  foreach ($Target in $ParsedGuideTargets.Targets) {
    Write-Host ""
    Write-Host "Installing starter guide skill to $Target..."
    & $CliCommand.Source install "@community/marketplace-guide" --target $Target --yes
    if ($LASTEXITCODE -eq 0) {
      if (-not $FirstGuideTarget) {
        $FirstGuideTarget = $Target
      }
    } else {
      Write-Warning "Guide skill install failed for $Target; CLI install is still complete."
    }
  }

  if ($FirstGuideTarget) {
    try { & $CliCommand.Source config set default_agent $FirstGuideTarget | Out-Null } catch {}
  }
}

Write-Host ""
Write-Host "agent-skills installed."
if ($CliCommand) {
  Install-GuideSkill
  & $CliCommand.Source doctor
  Show-CliNextSteps
} else {
  Show-CliNextSteps
}
`
}

export async function GET() {
  const origin = marketplaceOrigin()
  return new Response(script(origin), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
