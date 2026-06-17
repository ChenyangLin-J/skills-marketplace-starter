import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { pollCliLoginRequest } from '@/lib/auth/cli'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let body: { device_code?: string } = {}
  try {
    body = (await req.json()) as { device_code?: string }
  } catch {
    return apiError(400, 'validation_failed', 'JSON body is required')
  }

  const deviceCode = String(body.device_code || '').trim()
  if (!deviceCode) {
    return apiError(400, 'validation_failed', 'Missing device_code')
  }

  const result = pollCliLoginRequest(deviceCode)
  if (result.status === 'pending') {
    return NextResponse.json(
      { status: 'pending', expires_at: result.expiresAt },
      { status: 202 },
    )
  }
  if (result.status !== 'ok') {
    return apiError(400, `cli_login_${result.status}`, 'The CLI login request expired. Run agent-skills login again.')
  }

  return NextResponse.json({
    status: 'ok',
    token: result.token,
    expires_at: result.expiresAt,
    user: result.user,
  })
}
