import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import {
  createSession,
  sanitizeNextPath,
  setSessionCookie,
} from '@/lib/auth/session'
import { devLoginEnabled, getOrCreateDevUser } from '@/lib/auth/dev'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  if (!devLoginEnabled()) {
    return apiError(404, 'not_found', 'dev login is disabled')
  }

  const nextPath = sanitizeNextPath(req.nextUrl.searchParams.get('next') || '/')
  const user = getOrCreateDevUser()
  const session = createSession(user.open_id)
  const res = NextResponse.redirect(new URL(nextPath, req.url))
  setSessionCookie(res, session.token, session.expiresAt, req)
  return res
}
