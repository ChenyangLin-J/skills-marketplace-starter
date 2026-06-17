import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { listMarketplaceUsers } from '@/lib/users'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', 'Log in before viewing users.')

  return NextResponse.json({ items: listMarketplaceUsers() })
}
