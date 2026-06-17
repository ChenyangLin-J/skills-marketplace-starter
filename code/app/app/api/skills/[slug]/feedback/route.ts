import { NextRequest, NextResponse } from 'next/server'
import { apiError, decodeSlug } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import {
  canManageSkill,
  checkSkillVisibility,
  getSkillBySlug,
  listFeedbackForSkill,
  recordFeedback,
} from '@/lib/skills'

export const runtime = 'nodejs'

const VALID_KINDS = new Set(['issue', 'suggestion', 'question', 'usage'])

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', '请先登录后再查看反馈')

  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) return apiError(404, 'not_found', `skill ${slug} 不存在`)
  if (!canManageSkill(skill, currentUser)) {
    return apiError(403, 'forbidden', '只有 Skill 管理者可以查看反馈')
  }

  const items = listFeedbackForSkill(slug)
  return NextResponse.json({ items, total: items.length })
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', '请先登录后再提交反馈')

  const { slug: raw } = await ctx.params
  const slug = decodeSlug(raw)
  const skill = getSkillBySlug(slug, currentUser.open_id)
  if (!skill) return apiError(404, 'not_found', `skill ${slug} 不存在`)
  const decision = checkSkillVisibility(skill, currentUser)
  if (!decision.allowed) return apiError(decision.status, decision.code, decision.message)

  let body: {
    kind?: unknown
    message?: unknown
    context?: unknown
    agent?: unknown
    version?: unknown
    cli_version?: unknown
    source?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return apiError(400, 'validation_failed', '需要 JSON body')
  }

  const kind = typeof body.kind === 'string' ? body.kind.trim() : 'issue'
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const context = typeof body.context === 'string' ? body.context.trim().slice(0, 8000) : ''
  const agent = typeof body.agent === 'string' ? body.agent.trim().slice(0, 40) : ''
  const version = typeof body.version === 'string' ? body.version.trim().slice(0, 80) : skill.version
  const cliVersion =
    typeof body.cli_version === 'string' ? body.cli_version.trim().slice(0, 40) : ''
  const source = body.source === 'cli' ? 'cli' : 'web'

  const errs: Record<string, string> = {}
  if (!VALID_KINDS.has(kind)) errs.kind = 'kind 必须是 issue / suggestion / question / usage'
  if (!message) errs.message = 'message 不能为空'
  if (message.length > 4000) errs.message = 'message 最多 4000 字'
  if (Object.keys(errs).length > 0) {
    return apiError(400, 'validation_failed', '字段校验失败', errs)
  }

  const feedback = recordFeedback({
    skill_slug: slug,
    user_id: currentUser.open_id,
    user_handle: currentUser.handle,
    kind: kind as 'issue' | 'suggestion' | 'question' | 'usage',
    message,
    context: context || undefined,
    agent: agent || undefined,
    version: version || undefined,
    cli_version: cliVersion || undefined,
    source,
  })
  return NextResponse.json(feedback, { status: 201 })
}
