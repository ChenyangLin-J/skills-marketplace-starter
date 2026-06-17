import { NextRequest, NextResponse } from 'next/server'
import { apiError, decodeSlug } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { canManageSkill, getSkillBySlug, restoreSkill } from '@/lib/skills'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', 'Log in before restoring this Skill.')

  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) return apiError(404, 'not_found', `skill ${slug} does not exist`)
  if (!canManageSkill(skill, currentUser)) {
    return apiError(403, 'forbidden', 'You can only manage Skills you published or own.')
  }
  if (skill.status === 'active') return NextResponse.json(skill)

  const restored = restoreSkill(slug)
  return NextResponse.json(restored)
}
