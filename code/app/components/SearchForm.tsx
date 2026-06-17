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

  // Search state comes from the URL, not the current input value.
  // This keeps the clear button stable while the user is typing.
  const hasActiveSearch = !!initialQuery

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const usp = new URLSearchParams(sp.toString())
    if (q.trim()) usp.set('q', q.trim())
    else usp.delete('q')
    if (category) usp.set('category', category)
    usp.delete('page')
    const qs = usp.toString()
    startTransition(() => {
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
        placeholder="Search skills by name, description, or tags"
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
        aria-label="Clear search"
        className={`clear-btn${hasActiveSearch ? ' visible' : ''}`}
        tabIndex={hasActiveSearch ? 0 : -1}
      >
        <span className="clear-btn-inner">Clear</span>
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
        Search
      </button>
    </form>
  )
}
