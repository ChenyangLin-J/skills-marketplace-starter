'use client'

import { useEffect, useMemo, useState } from 'react'
import { attachIds, parseHeadings } from '@/lib/toc'

/**
 * Sticky TOC fixed on the right side without taking layout space.
 * Hidden when viewport width is below viewportMin.
 */
export function TocFixed({
  markdown,
  viewportMin = 1300,
}: {
  markdown: string
  viewportMin?: number
}) {
  const headings = useMemo(() => parseHeadings(markdown), [markdown])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [wide, setWide] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const check = () => setWide(window.innerWidth >= viewportMin)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [viewportMin])

  useEffect(() => {
    if (headings.length === 0) return
    const tagged = attachIds(headings)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -65% 0px', threshold: 0 },
    )
    tagged.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null
  if (!wide) return null

  return (
    <nav className="toc-fixed" aria-label="Table of contents">
      <div className="toc-title">📑 Contents</div>
      <ul className="toc-list">
        {headings.map((h) => (
          <li
            key={h.id}
            className={`toc-item toc-h${h.level}${activeId === h.id ? ' active' : ''}`}
          >
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
