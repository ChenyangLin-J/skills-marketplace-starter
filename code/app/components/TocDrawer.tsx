'use client'

import { useEffect, useMemo, useState } from 'react'
import { attachIds, parseHeadings } from '@/lib/toc'

/**
 * 右侧抽屉式 TOC:默认收起成一个小标签,hover/点击展开。
 * mobileOnly=true 时仅在 viewport < 1300 显示(B 方案用)
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
        aria-label={open ? '收起目录' : '展开目录'}
      >
        <span style={{ fontSize: 16 }}>📑</span>
        <span className="toc-drawer-label">目录</span>
      </button>
      <nav className="toc-drawer-panel" aria-label="目录">
        <div className="toc-title">📑 目录</div>
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
