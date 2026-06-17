type AlertDetails = Record<string, unknown>

export type AlertPayload = {
  type: string
  title?: string
  status?: number
  error?: string
  message: string
  details?: AlertDetails
  stack?: string
  dedupeKey?: string
  force?: boolean
}

type AlertResult = {
  ok: boolean
  sent: boolean
  deduped?: boolean
  configured: boolean
  channel?: 'webhook'
  reason?: string
  status?: number
}

const DEFAULT_DEDUPE_WINDOW_MS = 5 * 60 * 1000
const dedupeCache = new Map<string, number>()

export function notifyApiError(input: {
  status: number
  error: string
  message: string
  details?: AlertDetails
  stack?: string
}) {
  void sendAlert({
    type: 'api_error',
    title: `[Skills Marketplace] API ${input.status} · ${input.error}`,
    status: input.status,
    error: input.error,
    message: input.message,
    details: input.details,
    stack: input.stack,
    dedupeKey: [
      'api_error',
      input.status,
      input.error,
      input.message,
      stableJson(input.details),
    ].join('|'),
  })
}

export async function sendAlert(payload: AlertPayload): Promise<AlertResult> {
  const webhook = process.env.ALERT_WEBHOOK_URL?.trim()
  if (!webhook) {
    if (process.env.ALERT_LOG_ONLY === '1') {
      console.error(formatAlertText(payload))
    }
    return {
      ok: true,
      sent: false,
      configured: false,
      reason: 'ALERT_WEBHOOK_URL not configured',
    }
  }

  const dedupeKey = payload.dedupeKey || [payload.type, payload.title, payload.message].join('|')
  if (!payload.force && isDeduped(dedupeKey)) {
    return { ok: true, sent: false, deduped: true, configured: true, reason: 'deduped' }
  }
  rememberDedupe(dedupeKey)

  const text = formatAlertText(payload)
  const body = {
    text,
    payload: {
      type: payload.type,
      title: payload.title,
      status: payload.status,
      error: payload.error,
      message: payload.message,
      details: payload.details,
      timestamp: new Date().toISOString(),
    },
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const reason = await res.text().catch(() => '')
      console.error('[alerts] webhook failed', res.status, reason.slice(0, 500))
      return {
        ok: false,
        sent: false,
        configured: true,
        channel: 'webhook',
        status: res.status,
        reason,
      }
    }
    return { ok: true, sent: true, configured: true, channel: 'webhook', status: res.status }
  } catch (err) {
    console.error('[alerts] webhook error', err)
    return { ok: false, sent: false, configured: true, channel: 'webhook', reason: String(err) }
  }
}

function formatAlertText(payload: AlertPayload): string {
  const lines = [
    payload.title || `[Skills Marketplace] ${payload.type}`,
    '',
    `Type: ${payload.type}`,
    `Time: ${new Date().toISOString()}`,
  ]

  if (process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV) {
    lines.push(`Env: ${process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV}`)
  }
  if (payload.status) lines.push(`Status: ${payload.status}`)
  if (payload.error) lines.push(`Error: ${payload.error}`)
  lines.push(`Message: ${payload.message}`)

  const detailLines = formatDetails(payload.details)
  if (detailLines.length > 0) {
    lines.push('', 'Details:', ...detailLines)
  }

  const stack = trimStack(payload.stack)
  if (stack) {
    lines.push('', 'Stack:', stack)
  }

  return lines.join('\n')
}

function formatDetails(details?: AlertDetails): string[] {
  if (!details) return []
  return Object.entries(details).map(([key, value]) => {
    const rendered =
      typeof value === 'string' ? value : JSON.stringify(value, null, 0) || String(value)
    return `- ${key}: ${rendered}`
  })
}

function trimStack(stack?: string): string {
  if (!stack) return ''
  return stack
    .split('\n')
    .slice(1, 7)
    .map((line) => line.trim())
    .join('\n')
}

function isDeduped(key: string): boolean {
  cleanupDedupe()
  const lastSentAt = dedupeCache.get(key)
  if (!lastSentAt) return false
  return Date.now() - lastSentAt < dedupeWindowMs()
}

function rememberDedupe(key: string) {
  dedupeCache.set(key, Date.now())
}

function cleanupDedupe() {
  const now = Date.now()
  const windowMs = dedupeWindowMs()
  for (const [key, sentAt] of dedupeCache) {
    if (now - sentAt >= windowMs) dedupeCache.delete(key)
  }
}

function dedupeWindowMs(): number {
  const raw = Number(process.env.ALERT_DEDUPE_MS)
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_DEDUPE_WINDOW_MS
}

function stableJson(value: unknown): string {
  if (!value || typeof value !== 'object') return String(value || '')
  const ordered = Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = (value as Record<string, unknown>)[key]
      return acc
    }, {})
  return JSON.stringify(ordered)
}
