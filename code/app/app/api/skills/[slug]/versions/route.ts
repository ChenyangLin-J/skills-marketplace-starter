import { NextRequest, NextResponse } from 'next/server'
import { apiError, decodeSlug } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { userIdOrAnonymous } from '@/lib/auth/session'
import { parseSkillZip, rewriteSkillZipVersion, SkillParseError } from '@/lib/parse-skill'
import { saveSkillZip, skillZipExists } from '@/lib/storage'
import {
  canManageSkill,
  checkSkillVisibility,
  getSkillBySlug,
  listSkillVersions,
  skillVersionExists,
  upsertSkill,
} from '@/lib/skills'
import type { SkillSource } from '@/lib/types'

export const runtime = 'nodejs'

const VALID_SOURCES = new Set<SkillSource>(['official', 'external', 'user'])

function suggestPatchVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/)
  if (!match) return `${version}.1`
  const patch = Number(match[3]) + 1
  return `${match[1]}.${match[2]}.${patch}${match[4] || ''}`
}

function sourceFromFrontmatter(frontmatter: Record<string, unknown>): SkillSource | undefined {
  const source = String(frontmatter.source || '').trim()
  return VALID_SOURCES.has(source as SkillSource) ? (source as SkillSource) : undefined
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const currentUser = getAuthenticatedUserFromRequest(req)
  const skill = getSkillBySlug(slug, userIdOrAnonymous(currentUser))
  if (!skill) return apiError(404, 'not_found', `skill ${slug} does not exist`)
  const decision = checkSkillVisibility(skill, currentUser)
  if (!decision.allowed) return apiError(decision.status, decision.code, decision.message)

  const items = listSkillVersions(slug)
  return NextResponse.json({ items, total: items.length })
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', 'Log in before publishing a new version.')

  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) return apiError(404, 'not_found', `skill ${slug} does not exist`)
  if (!canManageSkill(skill, currentUser)) {
    return apiError(403, 'forbidden', 'You can only manage Skills you published or own.')
  }

  const ct = req.headers.get('content-type') || ''
  if (!ct.includes('multipart/form-data')) {
    return apiError(400, 'validation_failed', 'multipart/form-data is required')
  }

  const form = await req.formData()
  const file = form.get('file')
  const versionOverride = String(form.get('version') || '').trim()
  if (!file || !(file instanceof File)) {
    return apiError(400, 'validation_failed', 'Field validation failed', { file: 'Missing file' })
  }

  let buf: Buffer<ArrayBufferLike> = Buffer.from(await file.arrayBuffer())
  let parsed
  try {
    parsed = await parseSkillZip(buf)
    if (versionOverride) {
      const rewritten = await rewriteSkillZipVersion(buf, versionOverride)
      buf = rewritten.buffer
      parsed = rewritten.parsed
    }
  } catch (e) {
    if (e instanceof SkillParseError) {
      return apiError(400, e.code, e.message, e.details)
    }
    return apiError(500, 'server_error', String(e))
  }

  if (parsed.name !== skill.name) {
    return apiError(400, 'validation_failed', 'The uploaded package does not match the current Skill', {
      name: `Current Skill is ${skill.name}; uploaded package is ${parsed.name}`,
    })
  }

  if (
    skill.version === parsed.version ||
    skillVersionExists(slug, parsed.version) ||
    skillZipExists(skill.author, skill.name, parsed.version)
  ) {
    return apiError(
      409,
      'version_conflict',
      `Version ${parsed.version} already exists. Enter a new version before publishing.`,
      {
        slug,
        current_version: skill.version,
        suggested_version: suggestPatchVersion(skill.version),
      },
    )
  }

  let zipPath: string
  try {
    zipPath = saveSkillZip(skill.author, skill.name, parsed.version, buf)
  } catch (e) {
    return apiError(500, 'server_error', `Storage failed: ${String(e)}`)
  }

  const result = upsertSkill({
    slug,
    author: skill.author,
    name: skill.name,
    description: parsed.description,
    category: skill.category,
    tags: skill.tags,
    version: parsed.version,
    zip_path: zipPath,
    readme: parsed.readme,
    frontmatter: parsed.frontmatter,
    example: skill.example,
    uploaded_by: currentUser.handle,
    source: sourceFromFrontmatter(parsed.frontmatter),
  })

  return NextResponse.json(
    {
      ...result.skill,
      is_overwrite: result.isOverwrite,
      previous_version: result.previousVersion,
    },
    { status: 200 },
  )
}
