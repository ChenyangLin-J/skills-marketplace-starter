import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  clearSessionCookie,
  deleteSession,
} from '@/lib/auth/session'
import { publicOrigin } from '@/lib/origin'

export const runtime = 'nodejs'

function clearLogin(req: NextRequest, res: NextResponse): NextResponse {
  deleteSession(req.cookies.get(SESSION_COOKIE)?.value)
  clearSessionCookie(res, req)
  return res
}

export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/', publicOrigin(req)))
  return clearLogin(req, res)
}

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  return clearLogin(req, res)
}
