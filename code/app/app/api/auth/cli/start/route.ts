import { NextRequest, NextResponse } from 'next/server'
import { createCliLoginRequest } from '@/lib/auth/cli'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const login = createCliLoginRequest(req)
  return NextResponse.json({
    device_code: login.deviceCode,
    authorize_url: login.authorizeUrl,
    expires_at: login.expiresAt,
    interval_seconds: login.intervalSeconds,
  })
}
