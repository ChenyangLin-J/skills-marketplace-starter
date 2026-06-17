'use client'

import { useState } from 'react'

const MARKETPLACE_ORIGIN =
  process.env.NEXT_PUBLIC_AGENT_SKILLS_MARKETPLACE_URL ||
  'http://localhost:3000'
const INSTALL_CMD =
  `export PATH="$HOME/.local/bin:$PATH"; curl -fsSL ${MARKETPLACE_ORIGIN}/install.sh | bash`

export function CliInstallHint() {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', maxWidth: '100%' }}>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          background: 'var(--bg-soft)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 14px',
          fontSize: 13,
          maxWidth: '100%',
        }}
      >
        <span style={{ color: 'var(--text-secondary)' }}>First time here?</span>
        <code
          style={{
            background: 'transparent',
            padding: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text-primary)',
            overflowWrap: 'anywhere',
            whiteSpace: 'normal',
          }}
        >
          {INSTALL_CMD}
        </code>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy command"
          style={{
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: copied ? 'var(--success)' : 'var(--text-secondary)',
            borderRadius: 4,
            padding: '2px 10px',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
