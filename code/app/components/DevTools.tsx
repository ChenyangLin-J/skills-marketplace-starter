'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDevMode } from './DevModeContext'
import { HOME_GUIDE_COMPLETED_STORAGE_KEY } from '@/lib/home-guide-state'

type CurrentUser = {
  name?: string
  handle?: string
}

/**
 * Floating Dev Tools entry in the lower-right corner.
 * Used to toggle placeholders and the local web login state.
 */
export function DevTools() {
  const { showPlaceholders, setShowPlaceholders, hydrated } = useDevMode()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [authEnabled, setAuthEnabled] = useState(false)
  const [authLabel, setAuthLabel] = useState('Not signed in')
  const [authPending, setAuthPending] = useState(false)
  const [authError, setAuthError] = useState('')
  const [heroResetLabel, setHeroResetLabel] = useState('Clear completion state and refresh the homepage')
  const [alertTestLabel, setAlertTestLabel] = useState('Send test alert')
  const [alertTestPending, setAlertTestPending] = useState(false)

  const refreshAuthState = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = (await res.json()) as { user?: CurrentUser | null }
      const user = data.user || null
      setAuthEnabled(!!user)
      setAuthLabel(
        user
          ? `${user.name || user.handle || 'Signed in'}${user.handle ? ` · @${user.handle}` : ''}`
          : 'Not signed in',
      )
      setAuthError('')
    } catch {
      setAuthError('Could not read login state')
    }
  }, [])

  async function setDevAuthEnabled(enabled: boolean) {
    setAuthPending(true)
    setAuthError('')
    try {
      if (enabled) {
        const res = await fetch('/api/dev/tools/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login: true }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } else {
        await fetch('/api/dev/tools/session', { method: 'POST' }).catch(() => null)
        const res = await fetch('/api/auth/logout', { method: 'POST' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      }
      await refreshAuthState()
      router.refresh()
    } catch {
      setAuthError(enabled ? 'Dev login failed' : 'Logout failed')
    } finally {
      setAuthPending(false)
    }
  }

  function togglePanel() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen) void refreshAuthState()
  }

  async function restoreHero() {
    try {
      window.localStorage.removeItem(HOME_GUIDE_COMPLETED_STORAGE_KEY)
      const res = await fetch('/api/me/home-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: false }),
      })
      if (res.ok) {
        setHeroResetLabel('Account state cleared. Refreshing...')
      } else if (res.status === 401) {
        setHeroResetLabel('Local state cleared. Refreshing...')
      } else {
        setHeroResetLabel('Could not clear account state. Refreshing...')
      }
    } catch {
      setHeroResetLabel('Clear failed, but the page will still refresh')
    }
    window.setTimeout(() => {
      window.location.href = '/'
    }, 120)
  }

  async function sendTestAlert() {
    setAlertTestPending(true)
    setAlertTestLabel('Sending...')
    try {
      const res = await fetch('/api/dev/alerts/test', { method: 'POST' })
      const data = (await res.json()) as { sent?: boolean; configured?: boolean; reason?: string }
      if (!res.ok) {
        setAlertTestLabel(`Send failed: ${data.reason || `HTTP ${res.status}`}`)
      } else if (!data.configured) {
        setAlertTestLabel('ALERT_WEBHOOK_URL is not configured')
      } else if (data.sent) {
        setAlertTestLabel('Test alert sent')
      } else {
        setAlertTestLabel(data.reason || 'Not sent')
      }
    } catch {
      setAlertTestLabel('Send failed')
    } finally {
      setAlertTestPending(false)
    }
  }

  // Avoid hydration drift: buttons and state depend on localStorage.
  if (!hydrated) return null

  return (
    <>
      {/* Gear button */}
      <button
        type="button"
        aria-label="Dev tools"
        title="Dev tools"
        onClick={togglePanel}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: open ? 'var(--bg-hover)' : 'var(--bg)',
          color: 'var(--text-secondary)',
          fontSize: 20,
          lineHeight: 1,
          boxShadow: 'var(--shadow-md, 0 2px 8px rgba(15,15,15,0.08))',
          cursor: 'pointer',
          zIndex: 100,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ⚙
      </button>

      {/* Drawer from the lower-right corner */}
      {open && (
        <div
          role="dialog"
          aria-label="Dev tools panel"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 72,
            width: 280,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(15,15,15,0.12)',
            padding: 16,
            zIndex: 101,
            fontSize: 13,
            color: 'var(--text-primary)',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>🛠️ Dev Tools</span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: 16,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>

          {/* Toggle row */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '6px 0',
              cursor: 'pointer',
            }}
          >
            <span>Show planned placeholders</span>
            <DevToggle
              checked={showPlaceholders}
              onChange={(v) => setShowPlaceholders(v)}
            />
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 0 6px',
              cursor: authPending ? 'wait' : 'pointer',
              borderTop: '1px solid var(--border)',
              marginTop: 8,
            }}
          >
            <span>Web login</span>
            <DevToggle
              checked={authEnabled}
              disabled={authPending}
              onChange={(v) => void setDevAuthEnabled(v)}
            />
          </label>

          <div
            style={{
              fontSize: 12,
              color: authError ? 'var(--danger, #b42318)' : 'var(--text-muted)',
              lineHeight: 1.5,
            }}
          >
            {authError || authLabel}
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border)',
              marginTop: 10,
              paddingTop: 10,
            }}
          >
            <button
              type="button"
              onClick={() => void restoreHero()}
              style={{
                width: '100%',
                minHeight: 32,
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-soft)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 550,
                cursor: 'pointer',
              }}
            >
              Restore homepage hero
            </button>
            <div
              style={{
                marginTop: 6,
                color: 'var(--text-muted)',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {heroResetLabel}
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border)',
              marginTop: 10,
              paddingTop: 10,
            }}
          >
            <button
              type="button"
              disabled={alertTestPending}
              onClick={() => void sendTestAlert()}
              style={{
                width: '100%',
                minHeight: 32,
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-soft)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 550,
                cursor: alertTestPending ? 'wait' : 'pointer',
                opacity: alertTestPending ? 0.75 : 1,
              }}
            >
              Test alert
            </button>
            <div
              style={{
                marginTop: 6,
                color: 'var(--text-muted)',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {alertTestLabel}
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            Placeholder settings are stored in localStorage. Web login switches the current browser cookie.
          </div>
        </div>
      )}
    </>
  )
}

function DevToggle({
  checked,
  disabled = false,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        border: 'none',
        background: checked ? 'var(--accent)' : 'var(--border-strong, #d3d3d1)',
        position: 'relative',
        cursor: disabled ? 'wait' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'white',
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
