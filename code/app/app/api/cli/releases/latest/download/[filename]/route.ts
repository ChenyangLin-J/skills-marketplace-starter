import fs from 'node:fs'
import path from 'node:path'
import { apiError } from '@/lib/api'
import { findLatestWheel } from '@/lib/cli-release'

export const runtime = 'nodejs'

export async function GET() {
  const wheelPath = findLatestWheel()
  if (!wheelPath || !fs.existsSync(wheelPath)) {
    return apiError(
      404,
      'release_not_found',
      'The latest CLI wheel has not been built. Run the release script first.'
    )
  }

  const buf = fs.readFileSync(wheelPath)
  const filename = path.basename(wheelPath)

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
    },
  })
}
