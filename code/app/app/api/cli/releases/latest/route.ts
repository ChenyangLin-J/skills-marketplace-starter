import { NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { buildCliRelease } from '@/lib/cli-release'

export const runtime = 'nodejs'

export async function GET() {
  const release = buildCliRelease()
  if (!release) {
    return apiError(
      404,
      'release_not_found',
      'The latest CLI wheel has not been built. Run the release script first.'
    )
  }

  return NextResponse.json(release)
}
