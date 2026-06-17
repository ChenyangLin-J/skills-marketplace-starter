'use client'

import { useEffect, useMemo, useState } from 'react'
import { attachIds, parseHeadings } from '@/lib/toc'

/**
 * Right-side drawer TOC. Collapsed by default, expands on hover/click.
 * mobileOnly=true shows it only below viewport width 1300.
 */
export function TocDrawer({
  markdown,
  mobileOnly = false,
}: {
  markdown: string
  mobileOnly?: boolean
}) {
  const headings = useMemo(() => parseHeadings(markdown), [markdown])
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [show, setShow] = useState(true)

  useEffect(() => {
    if (!mobileOnly) return
    const check = () => setShow(window.innerWidth < 1300)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [mobileOnly])

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
  if (!show) return null

  return (
    <div
      className={`toc-drawer${open ? ' open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="toc-drawer-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Collapse contents' : 'Expand contents'}
      >
        <span style={{ fontSize: 16 }}>📑</span>
        <span className="toc-drawer-label">Contents</span>
      </button>
      <nav className="toc-drawer-panel" aria-label="Table of contents">
        <div className="toc-title">📑 Contents</div>
        <ul className="toc-list">
          {headings.map((h) => (
            <li
              key={h.id}
              className={`toc-item toc-h${h.level}${activeId === h.id ? ' active' : ''}`}
            >
              <a href={`#${h.id}`} onClick={() => setOpen(false)}>
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
