import { NextRequest, NextResponse } from 'next/server'
import { apiError, decodeSlug } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import {
  addSkillAccessGrant,
  canManageSkill,
  getSkillBySlug,
  normalizeAccessHandle,
  removeSkillAccessGrant,
} from '@/lib/skills'

export const runtime = 'nodejs'

async function requireManagedSkill(req: NextRequest, rawSlug: string) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return { error: apiError(401, 'unauthorized', '请先登录后再管理权限') }

  const slug = decodeSlug(rawSlug)
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) return { error: apiError(404, 'not_found', `skill ${slug} 不存在`) }
  if (!canManageSkill(skill, currentUser)) {
    return { error: apiError(403, 'forbidden', '只能管理自己发布或归属给自己的 Skill') }
  }
  return { currentUser, slug }
}

async function handleFromRequest(req: NextRequest): Promise<string | null> {
  const fromQuery = req.nextUrl.searchParams.get('handle')
  if (fromQuery) return normalizeAccessHandle(fromQuery)

  try {
    const body = await req.json()
    return normalizeAccessHandle(String(body?.handle || ''))
  } catch {
    return null
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await ctx.params
  const managed = await requireManagedSkill(req, raw)
  if ('error' in managed) return managed.error

  const handle = await handleFromRequest(req)
  if (!handle) return apiError(400, 'validation_failed', '缺少有效 handle')

  const grants = addSkillAccessGrant(managed.slug, handle, managed.currentUser.handle)
  return NextResponse.json({ grants })
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await ctx.params
  const managed = await requireManagedSkill(req, raw)
  if ('error' in managed) return managed.error

  const handle = await handleFromRequest(req)
  if (!handle) return apiError(400, 'validation_failed', '缺少有效 handle')

  const grants = removeSkillAccessGrant(managed.slug, handle)
  return NextResponse.json({ grants })
}
