/**
 * Format Unix timestamp (seconds) to a human relative string like "2d ago".
 * Falls back to YYYY-MM-DD when more than ~30 days ago.
 */
export function formatRelativeTime(unixSeconds: number): string {
  const nowMs = Date.now()
  const tsMs = unixSeconds * 1000
  const diffSec = Math.max(0, Math.floor((nowMs - tsMs) / 1000))

  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)}d ago`

  const d = new Date(tsMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
