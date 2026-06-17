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
      'CLI latest wheel 尚未构建，请先运行 release 脚本'
    )
  }

  return NextResponse.json(release)
}
