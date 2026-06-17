import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { checkSkillInstallAccess, getSkillBySlug } from '@/lib/skills'
import { apiError, decodeSlug } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { userIdOrAnonymous } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const skill = getSkillBySlug(slug, userIdOrAnonymous(currentUser))
  if (!skill) return apiError(404, 'not_found', `skill ${slug} does not exist`)
  if (skill.status === 'archived') {
    return apiError(410, 'archived', 'This Skill has been archived and cannot be downloaded or installed.')
  }
  const decision = checkSkillInstallAccess(skill, currentUser)
  if (!decision.allowed) return apiError(decision.status, decision.code, decision.message)

  const row = getDb()
    .prepare('SELECT zip_path FROM skills WHERE slug = ?')
    .get(slug) as { zip_path: string } | undefined
  if (!row) return apiError(404, 'not_found', `skill ${slug} does not exist`)

  const abs = path.isAbsolute(row.zip_path)
    ? row.zip_path
    : path.resolve(process.cwd(), row.zip_path)
  if (!fs.existsSync(abs)) {
    return apiError(404, 'not_found', `zip file is missing: ${row.zip_path}`, {
      slug,
      zip_path: row.zip_path,
      abs_path: abs,
    })
  }
  const buf = await addMarketplaceMetadata(fs.readFileSync(abs), skill, requestOrigin(req))

  const filename = `${skill.name}.zip`
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
    },
  })
}

type DownloadSkill = NonNullable<ReturnType<typeof getSkillBySlug>>

function requestOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host
  const proto =
    req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(/:$/, '') || 'http'
  return `${proto}://${host}`
}

async function addMarketplaceMetadata(
  buf: Buffer,
  skill: DownloadSkill,
  origin: string,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buf)
  const skillEntry = Object.values(zip.files).find((entry) => {
    if (entry.dir) return false
    return (entry.name.split('/').pop() || '').toLowerCase() === 'skill.md'
  })
  const dir = skillEntry?.name.includes('/')
    ? skillEntry.name.split('/').slice(0, -1).join('/') + '/'
    : ''
  const metadataPath = `${dir}skill-marketplace.json`

  zip.remove(metadataPath)

  zip.file(
    metadataPath,
    JSON.stringify(
      {
        schema: 'agent-skills.marketplace/v1',
        slug: skill.slug,
        author: skill.author,
        author_name: skill.author_name,
        name: skill.name,
        version: skill.version,
        category: skill.category,
        tags: skill.tags,
        uploaded_at: new Date(skill.updated_at * 1000).toISOString(),
        marketplace_url: `${origin}/skills/${encodeURIComponent(skill.slug)}`,
      },
      null,
      2,
    ) + '\n',
  )

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
