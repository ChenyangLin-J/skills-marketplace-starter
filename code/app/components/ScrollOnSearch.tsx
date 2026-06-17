'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

const DURATION = 250

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function fastScrollTo(targetY: number) {
  const startY = window.scrollY
  const distance = targetY - startY
  if (Math.abs(distance) < 2) return
  const startTime = performance.now()

  function frame(now: number) {
    const elapsed = now - startTime
    const t = Math.min(elapsed / DURATION, 1)
    window.scrollTo(0, startY + distance * easeOutCubic(t))
    if (t < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/**
 * 搜索时把指定锚点滚到视口顶部。用 250ms ease-out 快速但不突兀。
 */
export function ScrollOnSearch({ targetId }: { targetId: string }) {
  const sp = useSearchParams()
  const q = sp.get('q') || ''
  const lastQ = useRef<string | null>(null)

  useEffect(() => {
    const doScroll = () => {
      const el = document.getElementById(targetId)
      if (!el) return
      const targetY = el.getBoundingClientRect().top + window.scrollY - 80
      fastScrollTo(targetY)
    }

    if (lastQ.current === null) {
      if (q) doScroll()
      lastQ.current = q
      return
    }
    if (q !== lastQ.current) {
      doScroll()
      lastQ.current = q
    }
  }, [q, targetId])

  return null
}
