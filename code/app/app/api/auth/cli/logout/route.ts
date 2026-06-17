import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { deleteCliTokenFromRequest } from '@/lib/auth/cli'

export const runtime = 'nodejs'

export async function DELETE(req: NextRequest) {
  const deleted = deleteCliTokenFromRequest(req)
  if (!deleted) {
    return apiError(401, 'unauthorized', 'CLI is not logged in or the login has expired')
  }
  return NextResponse.json({ ok: true })
}
