/**
 * Format Unix timestamp (seconds) to a human relative string like "2 天前".
 * Falls back to YYYY-MM-DD when more than ~30 days ago.
 */
export function formatRelativeTime(unixSeconds: number): string {
  const nowMs = Date.now()
  const tsMs = unixSeconds * 1000
  const diffSec = Math.max(0, Math.floor((nowMs - tsMs) / 1000))

  if (diffSec < 60) return '刚刚'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`
  if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} 天前`

  const d = new Date(tsMs)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
