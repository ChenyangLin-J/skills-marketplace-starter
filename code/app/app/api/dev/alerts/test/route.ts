import { NextRequest, NextResponse } from 'next/server'
import { sendAlert } from '@/lib/alerts'
import { canAccessDevToolsFromRequest } from '@/lib/auth/dev-tools'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!canAccessDevToolsFromRequest(req)) {
    return NextResponse.json(
      { error: 'not_found', message: 'dev alert test is unavailable' },
      { status: 404 },
    )
  }

  const result = await sendAlert({
    type: 'dev_test',
    title: '[Skills Marketplace] Dev test alert',
    message: 'This is a test alert from Dev Tools.',
    details: {
      source: 'DevTools',
      route: '/api/dev/alerts/test',
    },
    force: true,
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
