const DEFAULT_MARKETPLACE_ORIGIN = 'http://localhost:3000'

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

export function publicOrigin(req: Request): string {
  const url = new URL(req.url)
  const forwardedHost = req.headers.get('x-forwarded-host')
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const host = forwardedHost || req.headers.get('host') || url.host
  const proto = forwardedProto || url.protocol.replace(':', '') || 'http'

  return `${proto}://${host}`
}

export function marketplaceOrigin(): string {
  return normalizeOrigin(
    process.env.AGENT_SKILLS_MARKETPLACE_URL ||
      process.env.NEXT_PUBLIC_AGENT_SKILLS_MARKETPLACE_URL ||
      DEFAULT_MARKETPLACE_ORIGIN
  )
}
