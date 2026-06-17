'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { InstallAccess } from '@/lib/types'

type InstallTab = 'cli' | 'download' | 'script'

const MARKETPLACE_ORIGIN =
  process.env.NEXT_PUBLIC_AGENT_SKILLS_MARKETPLACE_URL ||
  'http://localhost:3000'

function isWindowsPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const platform = nav.userAgentData?.platform || navigator.platform || ''
  return /win/i.test(platform) || /windows/i.test(navigator.userAgent)
}

export function SkillActions({
  slug,
  installAccess,
  initialLikes,
  initialLiked,
  isLoggedIn,
  isArchived = false,
}: {
  slug: string
  installAccess: InstallAccess
  initialLikes: number
  initialLiked: boolean
  isLoggedIn: boolean
  isArchived?: boolean
}) {
  const [likes, setLikes] = useState(initialLikes)
  const [liked, setLiked] = useState(initialLiked)
  const [pending, setPending] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [installTab, setInstallTab] = useState<InstallTab>('cli')
  const [copiedTab, setCopiedTab] = useState<InstallTab | null>(null)
  const [useWindowsScript] = useState(() => isWindowsPlatform())
  const [shareCopied, setShareCopied] = useState(false)
  const [authHint, setAuthHint] = useState<string | null>(null)

  // Skill name without the @author/ prefix, used as the local extraction folder.
  const bareName = slug.includes('/') ? slug.split('/').slice(-1)[0] : slug

  const cliCmd = `agent-skills install ${slug}`
  const downloadUrl = `/api/skills/${encodeURIComponent(slug)}/download`
  const scriptCmd = useWindowsScript
    ? buildPowerShellScriptCmd(slug)
    : buildShellScriptCmd(slug)
  const requiresInstallLogin = installAccess !== 'anonymous'

  async function copyText(text: string, which: InstallTab) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedTab(which)
      setTimeout(() => setCopiedTab(null), 1500)
    } catch {
      // ignore
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  async function toggleLike() {
    if (isArchived) {
      setAuthHint('This Skill is archived and cannot be liked.')
      return
    }
    if (pending) return
    setPending(true)
    const path = `/api/skills/${encodeURIComponent(slug)}/like`
    const method = liked ? 'DELETE' : 'POST'
    try {
      const res = await fetch(path, { method })
      if (res.ok) {
        const data = (await res.json()) as { like_count: number; liked_by_me: boolean }
        setLikes(data.like_count)
        setLiked(data.liked_by_me)
        setAuthHint(null)
      } else if (res.status === 401) {
        setAuthHint('Sign in before liking this Skill.')
      }
    } finally {
      setPending(false)
    }
  }

  function openInstallModal() {
    if (isArchived) {
      setAuthHint('This Skill is archived and cannot be installed.')
      return
    }
    if (requiresInstallLogin && !isLoggedIn) {
      setAuthHint('Sign in before installing this Skill.')
      return
    }
    setAuthHint(null)
    setModalOpen(true)
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={openInstallModal}
          disabled={isArchived}
          style={{
            background: isArchived ? 'var(--bg-soft)' : 'var(--accent)',
            color: isArchived ? 'var(--text-muted)' : 'white',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 500,
            border: 'none',
            cursor: isArchived ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {isArchived ? 'Archived' : 'Install locally'}
        </button>

        <button
          type="button"
          className={`like-btn${liked ? ' liked' : ''}`}
          onClick={toggleLike}
          disabled={pending}
          style={{ opacity: pending ? 0.6 : 1 }}
        >
          ❤ <span>{likes}</span>
        </button>
        {authHint && (
          <a
            className="auth-inline-link"
            href={`/api/auth/dev-login?next=${encodeURIComponent(window.location.pathname)}`}
          >
            {authHint}
          </a>
        )}

        <button
          type="button"
          onClick={copyShareLink}
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid transparent',
            fontSize: 13,
          }}
        >
          {shareCopied ? 'Link copied' : 'Share'}
        </button>
      </div>

      {modalOpen && createPortal(
        <div
          className="install-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
        >
          <div className="install-modal">
            <h3 style={{ marginBottom: 12, fontSize: 16, fontWeight: 600 }}>
              Install <span style={{ fontFamily: 'var(--font-mono)' }}>{slug}</span>
            </h3>

            <div
              role="tablist"
              style={{
                display: 'flex',
                gap: 4,
                borderBottom: '1px solid var(--border)',
                marginBottom: 16,
              }}
            >
              <InstallTabButton
                active={installTab === 'cli'}
                onClick={() => setInstallTab('cli')}
              >
                CLI
              </InstallTabButton>
              <InstallTabButton
                active={installTab === 'script'}
                onClick={() => setInstallTab('script')}
              >
                One-click script
              </InstallTabButton>
              <InstallTabButton
                active={installTab === 'download'}
                onClick={() => setInstallTab('download')}
              >
                Direct download
              </InstallTabButton>
            </div>

            {installTab === 'cli' && (
              <InstallPanel
                hint="Run this command in your terminal. Recommended because it picks the agent target for you:"
                command={cliCmd}
                copied={copiedTab === 'cli'}
                onCopy={() => copyText(cliCmd, 'cli')}
                footnote={
                  requiresInstallLogin ? (
                    <>
                      Run <code>agent-skills login</code> before installing with the CLI.
                    </>
                  ) : (
                    <>This Skill supports anonymous install.</>
                  )
                }
              />
            )}

            {installTab === 'script' && (
              <InstallPanel
                hint={useWindowsScript ? 'Paste this into PowerShell. No CLI install required:' : 'Paste this into your terminal. No CLI install required:'}
                command={scriptCmd}
                copied={copiedTab === 'script'}
                onCopy={() => copyText(scriptCmd, 'script')}
                multiline
                footnote={
                  requiresInstallLogin ? (
                    <>
                      The script reads your local CLI login and asks for install targets. You can enter <code>1</code> /{' '}
                      <code>12</code> / <code>all</code>.
                    </>
                  ) : (
                    <>
                      The script asks for install targets. You can enter <code>1</code> / <code>12</code> /{' '}
                      <code>all</code>.
                    </>
                  )
                }
              />
            )}

            {installTab === 'download' && (
              <div>
                <p
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: 13,
                    marginBottom: 12,
                  }}
                >
                  {requiresInstallLogin
                    ? 'Download the Skill zip with your current web session:'
                    : 'Download the Skill zip anonymously:'}
                </p>
                <a
                  href={downloadUrl}
                  download={`${bareName}.zip`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--accent)',
                    color: 'white',
                    padding: '10px 16px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  Download zip
                </a>
                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 12,
                  }}
                >
                  After downloading, unzip it into <code>~/.claude/skills/</code> or the matching agent directory.
                  Version and author metadata live in <code>skill-marketplace.json</code>.
                </p>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 16,
              }}
            >
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  border: '1px solid transparent',
                  fontSize: 13,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function InstallTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        padding: '8px 12px',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        marginBottom: -1,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function InstallPanel({
  hint,
  command,
  copied,
  onCopy,
  footnote,
  multiline,
}: {
  hint: string
  command: string
  copied: boolean
  onCopy: () => void
  footnote?: React.ReactNode
  multiline?: boolean
}) {
  return (
    <div>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        {hint}
      </p>
      <pre
        style={{
          background: 'var(--bg-soft)',
          padding: 12,
          borderRadius: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          overflowX: 'auto',
          margin: 0,
          whiteSpace: multiline ? 'pre-wrap' : 'pre',
          wordBreak: multiline ? 'break-all' : 'normal',
        }}
      >
        <code>{command}</code>
      </pre>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: 8,
        }}
      >
        <button
          type="button"
          onClick={onCopy}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {footnote && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 8,
          }}
        >
          {footnote}
        </p>
      )}
    </div>
  )
}

function buildShellScriptCmd(slug: string): string {
  const url = `${MARKETPLACE_ORIGIN}/api/skills/${encodeURIComponent(slug)}/install.sh`
  return `curl -fsSL "${url}" | bash`
}

function buildPowerShellScriptCmd(slug: string): string {
  const url = `${MARKETPLACE_ORIGIN}/api/skills/${encodeURIComponent(slug)}/install.ps1`
  return `irm "${url}" | iex`
}
