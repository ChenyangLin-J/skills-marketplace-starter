import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCliUserFromRequest } from '@/lib/auth/cli'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const user = getCliUserFromRequest(req)
  if (!user) {
    return apiError(401, 'unauthorized', 'CLI 未登录，请先运行 agent-skills login')
  }
  return NextResponse.json({ user })
}
