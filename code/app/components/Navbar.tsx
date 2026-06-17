'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useDevMode } from './DevModeContext'
import { AnchorScrollLink } from './AnchorScrollLink'

const NAV_ITEMS = [
  { key: 'wall', label: 'Explore', href: '/#explore' },
  { key: 'docs', label: 'Docs', href: '/docs' },
  { key: 'publish', label: 'Publish', href: '/publish' },
] as const

const DEV_NAV_ITEMS = [
  { key: 'dashboard', label: 'Data', href: '/dashboard' },
] as const

type CurrentUser = {
  handle: string
  name: string
  avatar_url?: string
}

function isActive(pathname: string, href: string): boolean {
  if (href.startsWith('/#')) return false
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

export function Navbar() {
  const pathname = usePathname()
  const { showPlaceholders, hydrated } = useDevMode()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [guideStored, setGuideStored] = useState(false)
  const showDev = hydrated && showPlaceholders
  const userLabel = user?.name || user?.handle || 'User'
  const isAdmin = user?.handle === 'demo'

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setUser(data?.user || null)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let timer: number | undefined
    function onGuideStored() {
      setGuideStored(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setGuideStored(false), 3600)
    }
    window.addEventListener('marketplace-guide-stored', onGuideStored)
    return () => {
      window.removeEventListener('marketplace-guide-stored', onGuideStored)
      window.clearTimeout(timer)
    }
  }, [])

  return (
    <header className="navbar">
      <Link href="/" className="navbar-brand">
        <span className="market-logo" aria-hidden="true" />
        <span className="navbar-wordmark">
          <strong>Skills Marketplace</strong>
          <span>Starter</span>
        </span>
      </Link>
      <nav className="navbar-actions">
        {NAV_ITEMS.map((it) => {
          const isDocsStored = it.key === 'docs' && guideStored
          const label = isDocsStored ? 'Saved to docs' : it.label
          const className = `navbar-link${isActive(pathname, it.href) ? ' active' : ''}${
            isDocsStored ? ' guide-stored' : ''
          }`

          return it.href.includes('#') ? (
            <AnchorScrollLink
              key={it.key}
              href={it.href}
              className={className}
            >
              {label}
            </AnchorScrollLink>
          ) : (
            <Link
              key={it.key}
              href={it.href}
              className={className}
            >
              {label}
            </Link>
          )
        })}
        {showDev &&
          DEV_NAV_ITEMS.map((it) => (
            <Link
              key={it.key}
              href={it.href}
              className={`navbar-link dev${isActive(pathname, it.href) ? ' active' : ''}`}
              title="v1.5 preview"
            >
              {it.label}
            </Link>
          ))}
        {isAdmin && (
          <Link
            href="/admin"
            className={`navbar-link${isActive(pathname, '/admin') ? ' active' : ''}`}
          >
            Admin
          </Link>
        )}
        {user ? (
          <>
            <Link
              href="/mine"
              className={`navbar-link${isActive(pathname, '/mine') ? ' active' : ''}`}
            >
              Mine
            </Link>
            <Link className="navbar-user-name" href="/mine">
              {userLabel}
            </Link>
            <a className="navbar-avatar" href="/api/auth/logout" title={`${userLabel} · Sign out`}>
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar_url} alt={userLabel} />
              ) : (
                Array.from(userLabel)[0] || 'U'
              )}
            </a>
          </>
        ) : (
          <a
            className="navbar-login"
            href={`/api/auth/dev-login?next=${encodeURIComponent(pathname || '/')}`}
          >
            Demo login
          </a>
        )}
      </nav>
    </header>
  )
}
