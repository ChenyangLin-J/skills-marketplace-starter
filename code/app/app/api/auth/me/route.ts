import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = getCurrentUserFromRequest(req)
  return NextResponse.json({ user })
}
