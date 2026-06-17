import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { dataDir } from './db'
import { marketplaceOrigin } from './origin'

const PACKAGE_NAME = 'agent-skills'
const WHEEL_PREFIX = 'agent_skills'

export type CliRelease = {
  name: string
  version: string
  wheel_url: string
  sha256: string
  api_base_url: string
  min_supported_version: string
}

export function cliReleaseDir(): string {
  const dir = path.join(dataDir(), 'cli-releases')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function getCliVersion(): string {
  if (process.env.AGENT_SKILLS_CLI_VERSION) {
    return process.env.AGENT_SKILLS_CLI_VERSION
  }

  const pyproject = path.resolve(process.cwd(), '../cli/pyproject.toml')
  try {
    const text = fs.readFileSync(pyproject, 'utf8')
    const match = text.match(/^version\s*=\s*"([^"]+)"/m)
    if (match) return match[1]
  } catch {
    // Route handlers still work in deployments that only copy app/.
  }
  return '0.1.0'
}

export function expectedWheelFilename(version = getCliVersion()): string {
  return `${WHEEL_PREFIX}-${version}-py3-none-any.whl`
}

export function findLatestWheel(): string | null {
  const dir = cliReleaseDir()
  const expected = path.join(dir, expectedWheelFilename())
  if (fs.existsSync(expected)) return expected

  const wheels = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(`${WHEEL_PREFIX}-`) && name.endsWith('.whl'))
    .map((name) => path.join(dir, name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)

  return wheels[0] ?? null
}

export function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

export function buildCliRelease(): CliRelease | null {
  const wheelPath = findLatestWheel()
  if (!wheelPath) return null

  const origin = marketplaceOrigin()
  const version = getCliVersion()
  const filename = path.basename(wheelPath)

  return {
    name: PACKAGE_NAME,
    version,
    wheel_url: `${origin}/api/cli/releases/latest/download/${filename}`,
    sha256: sha256File(wheelPath),
    api_base_url: origin,
    min_supported_version: '0.1.0',
  }
}
