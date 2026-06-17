import { NextRequest, NextResponse } from 'next/server'
import { apiError, decodeSlug } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import {
  INSTALL_ACCESS_VALUES,
  SKILL_VISIBILITY_VALUES,
  canManageSkill,
  getSkillBySlug,
  listSkillAccessGrants,
  normalizeAccessHandle,
  replaceSkillAccessGrants,
  updateSkillAccess,
} from '@/lib/skills'
import { listMarketplaceUsers } from '@/lib/users'
import type { InstallAccess, SkillVisibility } from '@/lib/types'

export const runtime = 'nodejs'

function accessBody(slug: string) {
  const skill = getSkillBySlug(slug)
  if (!skill) return null
  const grants = listSkillAccessGrants(slug)
  return {
    slug: skill.slug,
    install_access: skill.install_access,
    visibility: skill.visibility,
    grants,
    users: listMarketplaceUsers(),
  }
}

function validateGrantHandles(value: unknown): { handles?: string[]; error?: string } {
  if (value === undefined) return {}
  if (!Array.isArray(value)) return { error: 'grants 必须是 handle 字符串数组' }

  const handles: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return { error: 'grants 必须是 handle 字符串数组' }
    const handle = normalizeAccessHandle(item)
    if (!handle) return { error: `无效 handle: ${item}` }
    handles.push(handle)
  }
  return { handles: [...new Set(handles)] }
}

async function requireManagedSkill(req: NextRequest, rawSlug: string) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return { error: apiError(401, 'unauthorized', '请先登录后再管理权限') }

  const slug = decodeSlug(rawSlug)
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) return { error: apiError(404, 'not_found', `skill ${slug} 不存在`) }
  if (!canManageSkill(skill, currentUser)) {
    return { error: apiError(403, 'forbidden', '只能管理自己发布或归属给自己的 Skill') }
  }
  return { currentUser, slug, skill }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await ctx.params
  const managed = await requireManagedSkill(req, raw)
  if ('error' in managed) return managed.error

  const body = accessBody(managed.slug)
  if (!body) return apiError(404, 'not_found', `skill ${managed.slug} 不存在`)
  return NextResponse.json(body)
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug: raw } = await ctx.params
  const managed = await requireManagedSkill(req, raw)
  if ('error' in managed) return managed.error

  let body: {
    install_access?: unknown
    visibility?: unknown
    grants?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return apiError(400, 'validation_failed', '需要 JSON body')
  }

  const errs: Record<string, string> = {}
  const installAccess =
    typeof body.install_access === 'string' ? body.install_access.trim() : undefined
  const visibility = typeof body.visibility === 'string' ? body.visibility.trim() : undefined
  const grants = validateGrantHandles(body.grants)

  if (installAccess !== undefined && !INSTALL_ACCESS_VALUES.includes(installAccess as InstallAccess)) {
    errs.install_access = `install_access 必须是 ${INSTALL_ACCESS_VALUES.join(' / ')}`
  }
  if (visibility !== undefined && !SKILL_VISIBILITY_VALUES.includes(visibility as SkillVisibility)) {
    errs.visibility = `visibility 必须是 ${SKILL_VISIBILITY_VALUES.join(' / ')}`
  }
  if (grants.error) errs.grants = grants.error

  if (Object.keys(errs).length > 0) {
    return apiError(400, 'validation_failed', '字段校验失败', errs)
  }

  updateSkillAccess(managed.slug, {
    install_access: installAccess as InstallAccess | undefined,
    visibility: visibility as SkillVisibility | undefined,
  })
  if (grants.handles) {
    replaceSkillAccessGrants(managed.slug, grants.handles, managed.currentUser.handle)
  }

  const nextBody = accessBody(managed.slug)
  return NextResponse.json(nextBody)
}
