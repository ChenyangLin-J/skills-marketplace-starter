import { NextRequest, NextResponse } from 'next/server'
import {
  archiveSkill,
  canManageSkill,
  checkSkillVisibility,
  getSkillBySlug,
  updateSkillMetadata,
} from '@/lib/skills'
import { apiError, decodeSlug } from '@/lib/api'
import { userIdOrAnonymous } from '@/lib/auth/session'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { CATEGORIES, type Category } from '@/lib/types'
import { isSingleEmoji } from '@/lib/emoji'

export const runtime = 'nodejs'

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.value))

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const currentUser = getAuthenticatedUserFromRequest(req)
  const skill = getSkillBySlug(slug, userIdOrAnonymous(currentUser))
  if (!skill) return apiError(404, 'not_found', `skill ${slug} 不存在`)
  const decision = checkSkillVisibility(skill, currentUser)
  if (!decision.allowed) return apiError(decision.status, decision.code, decision.message)
  return NextResponse.json(skill)
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', '请先登录后再编辑 Skill')

  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) return apiError(404, 'not_found', `skill ${slug} 不存在`)
  if (!canManageSkill(skill, currentUser)) {
    return apiError(403, 'forbidden', '只能管理自己发布或归属给自己的 Skill')
  }

  let body: {
    display_name?: unknown
    display_description?: unknown
    description?: unknown
    category?: unknown
    tags?: unknown
    example?: unknown
    icon?: unknown
    emoji?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return apiError(400, 'validation_failed', '需要 JSON body')
  }

  const errs: Record<string, string> = {}
  const displayName =
    typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 40) : undefined
  const displayDescription =
    typeof body.display_description === 'string'
      ? body.display_description.trim().slice(0, 120)
      : undefined
  const description =
    typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : undefined
  const category = typeof body.category === 'string' ? body.category.trim() : undefined
  const example = typeof body.example === 'string' ? body.example.trim().slice(0, 4000) : undefined
  const icon = typeof body.icon === 'string' ? body.icon.trim().slice(0, 40) : undefined
  const emoji = typeof body.emoji === 'string' ? body.emoji.trim().slice(0, 20) : undefined

  if (description !== undefined && !description) errs.description = 'description 不能为空'
  if (category !== undefined && !VALID_CATEGORIES.has(category)) {
    errs.category = `category 必须是 ${[...VALID_CATEGORIES].join(' / ')}`
  }
  if (icon !== undefined && icon && !isSingleEmoji(icon)) {
    errs.icon = 'icon 只能是一个 emoji'
  }
  if (emoji !== undefined && emoji && !isSingleEmoji(emoji)) {
    errs.emoji = 'emoji 只能是一个 emoji'
  }

  let tags: string[] | undefined
  if (Array.isArray(body.tags)) {
    tags = body.tags
      .map((tag) => (typeof tag === 'string' ? tag.trim().replace(/^#/, '') : ''))
      .filter(Boolean)
      .slice(0, 5)
  } else if (typeof body.tags === 'string') {
    tags = body.tags
      .split(',')
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 5)
  } else if (body.tags !== undefined) {
    errs.tags = 'tags 必须是数组或逗号分隔字符串'
  }

  if (Object.keys(errs).length > 0) {
    return apiError(400, 'validation_failed', '字段校验失败', errs)
  }

  const updated = updateSkillMetadata(slug, {
    display_name: displayName,
    display_description: displayDescription,
    description,
    category: category as Category | undefined,
    tags,
    example,
    icon,
    emoji,
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', '请先登录后再下架 Skill')

  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) return apiError(404, 'not_found', `skill ${slug} 不存在`)
  if (!canManageSkill(skill, currentUser)) {
    return apiError(403, 'forbidden', '只能管理自己发布或归属给自己的 Skill')
  }
  if (skill.status === 'archived') {
    return NextResponse.json(skill)
  }

  const archived = archiveSkill(slug)
  return NextResponse.json(archived)
}
