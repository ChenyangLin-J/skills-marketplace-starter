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
  if (!currentUser) return apiError(401, 'unauthorized', '请先登录后再恢复 Skill')

  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) return apiError(404, 'not_found', `skill ${slug} 不存在`)
  if (!canManageSkill(skill, currentUser)) {
    return apiError(403, 'forbidden', '只能管理自己发布或归属给自己的 Skill')
  }
  if (skill.status === 'active') return NextResponse.json(skill)

  const restored = restoreSkill(slug)
  return NextResponse.json(restored)
}
