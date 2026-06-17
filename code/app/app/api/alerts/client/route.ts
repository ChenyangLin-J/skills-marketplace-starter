import { NextRequest, NextResponse } from 'next/server'
import { sendAlert } from '@/lib/alerts'

export const runtime = 'nodejs'

type ClientErrorBody = {
  type?: unknown
  message?: unknown
  stack?: unknown
  source?: unknown
  lineno?: unknown
  colno?: unknown
  href?: unknown
  userAgent?: unknown
}

export async function POST(req: NextRequest) {
  let body: ClientErrorBody = {}
  try {
    body = (await req.json()) as ClientErrorBody
  } catch {
    return NextResponse.json({ error: 'validation_failed', message: 'JSON body is required' }, { status: 400 })
  }

  const type =
    body.type === 'client_unhandled_rejection' ? 'client_unhandled_rejection' : 'client_error'
  const message = typeof body.message === 'string' && body.message ? body.message : 'Client error'
  const href = typeof body.href === 'string' ? body.href : ''
  const source = typeof body.source === 'string' ? body.source : ''
  const stack = typeof body.stack === 'string' ? body.stack : undefined

  const result = await sendAlert({
    type,
    title: `[Skills Marketplace] ${type}`,
    message: truncate(message, 500),
    details: {
      href: truncate(href, 500),
      source: truncate(source, 500),
      lineno: typeof body.lineno === 'number' ? body.lineno : '',
      colno: typeof body.colno === 'number' ? body.colno : '',
      userAgent: truncate(typeof body.userAgent === 'string' ? body.userAgent : '', 500),
    },
    stack: truncate(stack || '', 1200),
    dedupeKey: [type, message, href, source].join('|'),
  })

  return NextResponse.json(result)
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value
}
