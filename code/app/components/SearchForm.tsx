'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

type Props = {
  initialQuery: string
  category: string
}

export function SearchForm({ initialQuery, category }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [q, setQ] = useState(initialQuery)
  const [, startTransition] = useTransition()

  // 是否处于"已搜索"状态:由 URL 决定,而非 input 当前值。
  // 这样按钮只在提交搜索后出现,实时打字不闪。
  const hasActiveSearch = !!initialQuery

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const usp = new URLSearchParams(sp.toString())
    if (q.trim()) usp.set('q', q.trim())
    else usp.delete('q')
    if (category) usp.set('category', category)
    usp.delete('page') // 任何搜索/清除都重置回第 1 页
    const qs = usp.toString()
    startTransition(() => {
      // scroll: false 阻止 Next 默认的滚动重置;ScrollOnSearch 监听 q 变化后会丝滑滚到 #explore
      router.push(qs ? `/?${qs}` : '/', { scroll: false })
    })
  }

  function onClear() {
    setQ('')
    const usp = new URLSearchParams(sp.toString())
    usp.delete('q')
    if (category) usp.set('category', category)
    usp.delete('page')
    const qs = usp.toString()
    startTransition(() => {
      router.push(qs ? `/?${qs}` : '/', { scroll: false })
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}
    >
      <input
        name="q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索 skill（名字 / 描述 / 标签）"
        style={{
          flex: 1,
          padding: '8px 14px',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--bg-soft)',
          fontSize: 14,
        }}
      />
      <button
        type="button"
        onClick={onClear}
        aria-label="清除搜索"
        className={`clear-btn${hasActiveSearch ? ' visible' : ''}`}
        tabIndex={hasActiveSearch ? 0 : -1}
      >
        <span className="clear-btn-inner">✕ 清除</span>
      </button>
      <button
        type="submit"
        style={{
          padding: '8px 14px',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--bg)',
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        搜索
      </button>
    </form>
  )
}
