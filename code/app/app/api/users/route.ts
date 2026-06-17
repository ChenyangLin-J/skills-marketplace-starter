import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { listMarketplaceUsers } from '@/lib/users'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', '请先登录后再查看人员列表')

  return NextResponse.json({ items: listMarketplaceUsers() })
}
