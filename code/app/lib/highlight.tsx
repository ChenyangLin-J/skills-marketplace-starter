import React from 'react'

const CTX_BEFORE = 24
const CTX_AFTER = 60

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 把 text 按 q（不分大小写）切成 [前, 命中, 后, 命中, 后...] 渲染,命中处用 <mark> */
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
 * 描述命中片段:
 * - 没命中 → 返回原文
 * - 第一处命中在前 CTX_BEFORE 字符内 → 原文
 * - 否则 → '…' + 命中前 CTX_BEFORE 字符 + 命中 + 后 CTX_AFTER 字符 + '…'
 *   (CSS 仍 line-clamp 2 行兜底)
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
