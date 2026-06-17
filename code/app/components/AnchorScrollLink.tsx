'use client'

import Link from 'next/link'
import type { MouseEvent, ReactNode } from 'react'

export function AnchorScrollLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: ReactNode
}) {
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (typeof window === 'undefined') return
    const url = new URL(href, window.location.href)
    if (url.pathname !== window.location.pathname || !url.hash) return

    const target = document.querySelector(url.hash)
    if (!target) return

    event.preventDefault()
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.history.replaceState(null, '', url.hash)
  }

  return (
    <Link href={href} className={className} onClick={onClick} scroll={false}>
      {children}
    </Link>
  )
}
