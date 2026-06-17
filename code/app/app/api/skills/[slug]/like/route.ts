import { NextRequest, NextResponse } from 'next/server'
import { addLike, checkSkillVisibility, getSkillBySlug, removeLike } from '@/lib/skills'
import { apiError, decodeSlug } from '@/lib/api'
import { getCurrentUserFromRequest } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const currentUser = getCurrentUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', 'Log in before liking this Skill.')
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) {
    return apiError(404, 'not_found', `skill ${slug} does not exist`)
  }
  const decision = checkSkillVisibility(skill, currentUser)
  if (!decision.allowed) return apiError(decision.status, decision.code, decision.message)
  if (skill.status === 'archived') {
    return apiError(410, 'archived', 'This Skill has been archived and cannot be liked right now.')
  }
  const count = addLike(slug, currentUser.open_id)
  return NextResponse.json({ like_count: count, liked_by_me: true })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const currentUser = getCurrentUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', 'Log in before unliking this Skill.')
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) {
    return apiError(404, 'not_found', `skill ${slug} does not exist`)
  }
  const decision = checkSkillVisibility(skill, currentUser)
  if (!decision.allowed) return apiError(decision.status, decision.code, decision.message)
  const count = removeLike(slug, currentUser.open_id)
  return NextResponse.json({ like_count: count, liked_by_me: false })
}
