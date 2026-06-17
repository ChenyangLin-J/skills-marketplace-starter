import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUserFromRequest } from '@/lib/auth/session'
import { isHomeGuideCompleted, setHomeGuideCompleted } from '@/lib/user-preferences'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = getCurrentUserFromRequest(req)
  if (!user) return apiError(401, 'unauthorized', '请先登录')

  return NextResponse.json({
    completed: isHomeGuideCompleted(user.open_id),
  })
}

export async function POST(req: NextRequest) {
  const user = getCurrentUserFromRequest(req)
  if (!user) return apiError(401, 'unauthorized', '请先登录')

  let body: { completed?: unknown } = {}
  try {
    body = (await req.json()) as { completed?: unknown }
  } catch {
    return apiError(400, 'validation_failed', '需要 JSON body')
  }

  if (typeof body.completed !== 'boolean') {
    return apiError(400, 'validation_failed', 'completed 必须是 boolean')
  }

  setHomeGuideCompleted(user.open_id, body.completed)
  return NextResponse.json({ completed: body.completed })
}
