import { NextRequest, NextResponse } from 'next/server'
import {
  INSTALL_ACCESS_VALUES,
  SKILL_VISIBILITY_VALUES,
  getSkillVersion,
  listSkills,
  normalizeAccessHandle,
  replaceSkillAccessGrants,
  skillVersionExists,
  upsertSkill,
} from '@/lib/skills'
import {
  CATEGORIES,
  type Category,
  type InstallAccess,
  type SkillSource,
  type SkillVisibility,
} from '@/lib/types'
import { apiError } from '@/lib/api'
import {
  parseSkillZip,
  rewriteSkillZipFrontmatter,
  rewriteSkillZipVersion,
  SkillParseError,
} from '@/lib/parse-skill'
import { saveSkillZip, skillZipExists } from '@/lib/storage'
import { userIdOrAnonymous } from '@/lib/auth/session'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'

export const runtime = 'nodejs'

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.value))
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

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const fullParam = sp.get('full') || sp.get('fulltext')
  const include = new Set(
    (sp.get('include') || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  )
  const includeAll = include.has('all')
  const includeReadme = sp.get('readme') === '1' || include.has('readme') || includeAll
  const includeFrontmatter = include.has('frontmatter') || includeAll
  const includeExample = include.has('example') || includeAll
  const currentUser = getAuthenticatedUserFromRequest(req)
  const includeArchived =
    sp.get('include_archived') === '1' || sp.get('include_archived') === 'true'
  const result = listSkills({
    q: sp.get('q') || undefined,
    fulltext: fullParam === '1' || fullParam === 'true',
    category: sp.get('category') || undefined,
    sort: sp.get('sort') || undefined,
    limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    offset: sp.get('offset') ? Number(sp.get('offset')) : undefined,
    includeArchived: includeArchived && !!currentUser,
    ownerHandle: includeArchived ? currentUser?.handle : undefined,
  }, userIdOrAnonymous(currentUser), currentUser?.handle)
  if (!includeReadme || !includeFrontmatter || !includeExample) {
    return NextResponse.json({
      ...result,
      items: result.items.map((item) => {
        const { readme, frontmatter, example, ...compactItem } = item
        void readme
        void frontmatter
        void example
        if (includeReadme || includeFrontmatter || includeExample) {
          return {
            ...compactItem,
            ...(includeReadme ? { readme } : {}),
            ...(includeFrontmatter ? { frontmatter } : {}),
            ...(includeExample ? { example } : {}),
          }
        }
        return compactItem
      }),
    })
  }
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) {
    return apiError(401, 'unauthorized', 'Log in before publishing a Skill.')
  }

  const ct = req.headers.get('content-type') || ''
  if (!ct.includes('multipart/form-data')) {
    return apiError(400, 'validation_failed', 'multipart/form-data is required')
  }

  const form = await req.formData()
  const file = form.get('file')
  const category = String(form.get('category') || '').trim()
  const tagsRaw = String(form.get('tags') || '').trim()
  const example = String(form.get('example') || '').trim()
  const versionOverride = String(form.get('version') || '').trim()
  const nameOverride = String(form.get('name') || '').trim()
  const descriptionOverride = String(form.get('description') || '').trim()
  const displayName = String(form.get('display_name') || '').trim()
  const displayDescription = String(form.get('display_description') || '').trim()
  const installAccessRaw = form.get('install_access')
  const visibilityRaw = form.get('visibility')
  const grantsProvided = form.has('grants')
  const grantsRaw = String(form.get('grants') || '').trim()
  const installAccess =
    typeof installAccessRaw === 'string' && installAccessRaw.trim()
      ? installAccessRaw.trim()
      : undefined
  const visibility =
    typeof visibilityRaw === 'string' && visibilityRaw.trim()
      ? visibilityRaw.trim()
      : undefined

  const errs: Record<string, string> = {}
  if (!file || !(file instanceof File)) errs.file = 'Missing file'
  if (!category) errs.category = 'Missing category'
  else if (!VALID_CATEGORIES.has(category))
    errs.category = `category must be ${[...VALID_CATEGORIES].join(' / ')}`
  if (installAccess !== undefined && !INSTALL_ACCESS_VALUES.includes(installAccess as InstallAccess)) {
    errs.install_access = `install_access must be ${INSTALL_ACCESS_VALUES.join(' / ')}`
  }
  if (visibility !== undefined && !SKILL_VISIBILITY_VALUES.includes(visibility as SkillVisibility)) {
    errs.visibility = `visibility must be ${SKILL_VISIBILITY_VALUES.join(' / ')}`
  }

  if (Object.keys(errs).length > 0) {
    return apiError(400, 'validation_failed', 'Field validation failed', errs)
  }

  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5)
    : []
  const grants = grantsRaw
    ? [
        ...new Set(
          grantsRaw
            .split(',')
            .map((handle) => normalizeAccessHandle(handle))
            .filter(Boolean),
        ),
      ]
    : []

  let buf: Buffer<ArrayBufferLike> = Buffer.from(await (file as File).arrayBuffer())

  let parsed
  try {
    const frontmatterUpdates: Record<string, string | undefined> = {
      name: nameOverride,
      description: descriptionOverride,
      display_name: displayName,
      display_description: displayDescription,
    }
    const hasFrontmatterUpdates = Object.values(frontmatterUpdates).some((value) => value?.trim())
    if (hasFrontmatterUpdates) {
      const rewritten = await rewriteSkillZipFrontmatter(buf, frontmatterUpdates)
      buf = rewritten.buffer
      parsed = rewritten.parsed
    } else {
      parsed = await parseSkillZip(buf)
    }
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

  const author = currentUser.handle
  const slug = `@${author}/${parsed.name}`
  const existingVersion = getSkillVersion(slug)

  if (
    existingVersion === parsed.version ||
    skillVersionExists(slug, parsed.version) ||
    skillZipExists(author, parsed.name, parsed.version)
  ) {
    const currentVersion = existingVersion || parsed.version
    return apiError(
      409,
      'version_conflict',
      `Version ${parsed.version} already exists. Enter a new version before publishing.`,
      {
        slug,
        current_version: currentVersion,
        suggested_version: suggestPatchVersion(currentVersion),
      },
    )
  }

  let zipPath: string
  try {
    zipPath = saveSkillZip(author, parsed.name, parsed.version, buf)
  } catch (e) {
    return apiError(500, 'server_error', `Storage failed: ${String(e)}`)
  }

  const result = upsertSkill({
    slug,
    author,
    name: parsed.name,
    description: parsed.description,
    category: category as Category,
    tags,
    version: parsed.version,
    zip_path: zipPath,
    readme: parsed.readme,
    frontmatter: parsed.frontmatter,
    example: example || undefined,
    uploaded_by: currentUser.handle,
    source: sourceFromFrontmatter(parsed.frontmatter),
    install_access: installAccess as InstallAccess | undefined,
    visibility: visibility as SkillVisibility | undefined,
  })

  if (grantsProvided) {
    replaceSkillAccessGrants(slug, grants, currentUser.handle)
  }

  return NextResponse.json(
    {
      ...result.skill,
      is_overwrite: result.isOverwrite,
      previous_version: result.previousVersion,
    },
    { status: 200 },
  )
}
