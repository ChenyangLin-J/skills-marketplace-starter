import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { devLoginEnabled, getOrCreateDevUser } from '@/lib/auth/dev'
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  deleteSession,
  setSessionCookie,
} from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!devLoginEnabled()) {
    return apiError(404, 'not_found', 'dev session is disabled')
  }

  let body: { enabled?: unknown } = {}
  try {
    body = (await req.json()) as { enabled?: unknown }
  } catch {
    return apiError(400, 'validation_failed', '需要 JSON body')
  }
  if (typeof body.enabled !== 'boolean') {
    return apiError(400, 'validation_failed', 'enabled 必须是 boolean')
  }

  const enabled = body.enabled === true
  const user = enabled ? getOrCreateDevUser() : null
  const res = NextResponse.json({ user })

  deleteSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (user) {
    const session = createSession(user.open_id)
    setSessionCookie(res, session.token, session.expiresAt, req)
  } else {
    clearSessionCookie(res, req)
  }

  return res
}
