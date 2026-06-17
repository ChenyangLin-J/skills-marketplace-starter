import React from 'react'

const CTX_BEFORE = 24
const CTX_AFTER = 60

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Split text by q case-insensitively and render matches with <mark>. */
export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q || !text) return <>{text}</>
  const re = new RegExp(escapeRegExp(q), 'gi')
  const parts: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(
      <mark key={i++} className="hl">
        {m[0]}
      </mark>
    )
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

/**
 * Description match snippet:
 * - No match: return the original text.
 * - First match within CTX_BEFORE chars: return the original text.
 * - Otherwise: return ellipsis + context before + match + context after + ellipsis.
 *   CSS still line-clamps to two lines as a fallback.
 */
export function descriptionContext(text: string, q: string): string {
  if (!q || !text) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return text
  if (idx <= CTX_BEFORE) return text
  const start = Math.max(0, idx - CTX_BEFORE)
  const end = Math.min(text.length, idx + q.length + CTX_AFTER)
  const head = start > 0 ? '… ' : ''
  const tail = end < text.length ? ' …' : ''
  return head + text.slice(start, end) + tail
}
