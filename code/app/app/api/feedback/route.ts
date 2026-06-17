import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import {
  canManageSkill,
  getSkillBySlug,
  listFeedbackForOwner,
} from '@/lib/skills'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', '请先登录后再查看反馈')

  const sp = req.nextUrl.searchParams
  const skillSlug = (sp.get('skill') || '').trim()
  const limit = sp.get('limit') ? Number(sp.get('limit')) : 50

  if (skillSlug) {
    const skill = getSkillBySlug(skillSlug, currentUser.open_id)
    if (!skill) return apiError(404, 'not_found', `skill ${skillSlug} 不存在`)
    if (!canManageSkill(skill, currentUser)) {
      return apiError(403, 'forbidden', '只有 Skill 管理者可以查看反馈')
    }
  }

  const items = listFeedbackForOwner(
    currentUser.handle,
    Number.isFinite(limit) ? limit : 50,
    skillSlug || undefined,
  )
  return NextResponse.json({ items, total: items.length })
}
