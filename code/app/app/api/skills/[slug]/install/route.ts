import { NextRequest, NextResponse } from 'next/server'
import { checkSkillInstallAccess, getSkillBySlug, recordInstall } from '@/lib/skills'
import { apiError, decodeSlug } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { userIdOrAnonymous } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const currentUser = getAuthenticatedUserFromRequest(req)
  const viewerId = userIdOrAnonymous(currentUser)
  const skill = getSkillBySlug(slug, viewerId)
  if (!skill) {
    return apiError(404, 'not_found', `skill ${slug} does not exist`)
  }
  if (skill.status === 'archived') {
    return apiError(410, 'archived', 'This Skill has been archived and cannot be installed.')
  }
  const decision = checkSkillInstallAccess(skill, currentUser)
  if (!decision.allowed) return apiError(decision.status, decision.code, decision.message)

  let body: { agent?: string; version?: string; source?: string } = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    // empty / invalid body is allowed
  }

  const count = recordInstall(slug, body.agent, body.version, body.source, viewerId)
  return NextResponse.json({ install_count: count })
}
