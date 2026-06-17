'use client'

import { useEffect, useMemo, useState } from 'react'

type Heading = {
  id: string
  text: string
  level: 2 | 3
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseHeadings(markdown: string): Heading[] {
  if (!markdown) return []
  const lines = markdown.split('\n')
  const out: Heading[] = []
  let inFence = false
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*$/)
    if (!m) continue
    const level = m[1].length as 2 | 3
    const text = m[2].trim()
    let id = slugify(text)
    if (!id) continue
    const n = (counts.get(id) ?? 0) + 1
    counts.set(id, n)
    if (n > 1) id = `${id}-${n}`
    out.push({ id, text, level })
  }
  return out
}

export function Toc({ markdown }: { markdown: string }) {
  const headings = useMemo(() => parseHeadings(markdown), [markdown])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (headings.length === 0) return
    // Add ids to h2/h3 rendered from markdown because react-markdown does not add them.
    const main = document.querySelector('[data-toc-target="true"]')
    if (!main) return
    const md = main.querySelectorAll<HTMLHeadingElement>('h2, h3')
    let idx = 0
    md.forEach((el) => {
      if (idx >= headings.length) return
      const expected = headings[idx]
      // Match by order; parse order and render order should be the same.
      if (el.tagName === `H${expected.level}`) {
        el.id = expected.id
        // Add scroll margin so the sticky header does not cover the heading.
        el.style.scrollMarginTop = '88px'
        idx++
      }
    })
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the visible heading closest to the top.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-80px 0px -65% 0px', threshold: 0 },
    )
    md.forEach((el) => {
      if (el.id) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  return (
    <nav className="toc" aria-label="Table of contents">
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
