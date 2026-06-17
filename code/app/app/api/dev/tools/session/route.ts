import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import {
  canAccessDevToolsFromRequest,
  canUseDevTools,
  DEV_TOOLS_ADMIN_HANDLE,
  setDevToolsAccessCookie,
} from '@/lib/auth/dev-tools'
import {
  createSession,
  getCurrentUserFromRequest,
  setSessionCookie,
} from '@/lib/auth/session'
import { getUserByHandle } from '@/lib/users'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const currentUser = getCurrentUserFromRequest(req)
  if (!canUseDevTools(currentUser) && !canAccessDevToolsFromRequest(req)) {
    return apiError(404, 'not_found', 'dev tools session is unavailable')
  }

  let body: { login?: unknown } = {}
  try {
    body = (await req.json()) as { login?: unknown }
  } catch {
    body = {}
  }

  const shouldLogin = body.login === true
  const adminUser = shouldLogin ? getUserByHandle(DEV_TOOLS_ADMIN_HANDLE) : null
  if (shouldLogin && !adminUser) {
    return apiError(404, 'not_found', 'dev tools admin user is unavailable')
  }

  const res = NextResponse.json({ ok: true, user: adminUser })
  setDevToolsAccessCookie(res, req)
  if (adminUser) {
    const session = createSession(adminUser.open_id)
    setSessionCookie(res, session.token, session.expiresAt, req)
  }
  return res
}
