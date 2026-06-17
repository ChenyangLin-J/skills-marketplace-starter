'use client'

import Link from 'next/link'
import { Check, Copy, ChevronDown } from 'lucide-react'
import { useState } from 'react'

const MARKETPLACE_ORIGIN =
  process.env.NEXT_PUBLIC_AGENT_SKILLS_MARKETPLACE_URL ||
  'http://localhost:3000'
const MAC_INSTALL_COMMAND =
  `export PATH="$HOME/.local/bin:$PATH"; curl -fsSL ${MARKETPLACE_ORIGIN}/install.sh | bash`
const WINDOWS_INSTALL_COMMAND = `irm ${MARKETPLACE_ORIGIN}/install.ps1 | iex`

type Platform = 'mac' | 'windows'

type HeroDemoProps = {
  skillCount: number
  installCount: number
}

export function HeroDemo({ skillCount, installCount }: HeroDemoProps) {
  const [platform, setPlatform] = useState<Platform>(() => {
    if (typeof navigator === 'undefined') return 'mac'
    const platformText = `${navigator.userAgent || ''} ${navigator.platform || ''}`.toLowerCase()
    return platformText.includes('win') ? 'windows' : 'mac'
  })
  const [copied, setCopied] = useState(false)
  const [showSteps, setShowSteps] = useState(false)

  const command = platform === 'windows' ? WINDOWS_INSTALL_COMMAND : MAC_INSTALL_COMMAND

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // ignore
    }
  }

  return (
    <section className="hd-hero">
      <div className="hd-hero-inner">
        <span className="hd-eyebrow">Skills Marketplace Starter</span>
        <h1 className="hd-title">
          Put team know-how<br />inside your agents
        </h1>
        <p className="hd-lead">
          Let Claude, Codex, and Cursor use your team&apos;s methods, templates,
          and workflows with one install command.
        </p>

        <div className="hd-install">
          <div className="hd-install-tabs" role="tablist" aria-label="Choose system">
            <button
              role="tab"
              aria-selected={platform === 'mac'}
              className={platform === 'mac' ? 'active' : ''}
              onClick={() => setPlatform('mac')}
            >
              Mac / Linux
            </button>
            <button
              role="tab"
              aria-selected={platform === 'windows'}
              className={platform === 'windows' ? 'active' : ''}
              onClick={() => setPlatform('windows')}
            >
              Windows
            </button>
          </div>

          <div className="hd-install-bar">
            <span className="hd-install-prompt">$</span>
            <code className="hd-install-code">{command}</code>
            <button
              type="button"
              className={`hd-install-copy${copied ? ' copied' : ''}`}
              onClick={onCopy}
              aria-label="Copy install command"
            >
              {copied ? (
                <>
                  <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy size={14} strokeWidth={2.4} aria-hidden="true" />
                  Copy
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            className={`hd-steps-toggle${showSteps ? ' open' : ''}`}
            onClick={() => setShowSteps((v) => !v)}
            aria-expanded={showSteps}
          >
            <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
            {showSteps ? 'Hide setup steps' : 'First time? See 3 setup steps'}
          </button>

          {showSteps && (
            <ol className="hd-steps">
              <li>
                <strong>Open your terminal</strong>
                <span>
                  {platform === 'windows'
                    ? 'Search for PowerShell on Windows'
                    : 'Press Command + Space on Mac, then search Terminal'}
                </span>
              </li>
              <li>
                <strong>Paste the command and press Enter</strong>
                <span>Choose your AI tool: Claude, Codex, or Cursor</span>
              </li>
              <li>
                <strong>Ask one question</strong>
                <span>&quot;What skills are available?&quot;</span>
              </li>
            </ol>
          )}
        </div>

        <div className="hd-meta">
          <div className="hd-meta-stats">
            <span>
              <strong>{formatCount(skillCount)}</strong> Skills
            </span>
            <span className="hd-meta-dot">·</span>
            <span>
              <strong>{formatCount(installCount)}</strong> Installs
            </span>
          </div>
          <Link className="hd-meta-link" href="/#explore">
            Browse Skills →
          </Link>
        </div>
      </div>
    </section>
  )
}

const FEATURES: { tag: string; title: string; desc: string }[] = [
  {
    tag: 'Ask',
    title: '"What skills are available?"',
    desc: 'The agent checks the marketplace first, then explains when each Skill fits.',
  },
  {
    tag: 'Install',
    title: '"I need to write a project report"',
    desc: 'The agent searches for report-writing Skills, summarizes the fit, and asks before installing.',
  },
  {
    tag: 'Create',
    title: '"Turn this workflow into a Skill"',
    desc: 'Use a Skill creator workflow to shape triggers, steps, examples, and boundaries.',
  },
  {
    tag: 'Feedback',
    title: '"This Skill did not trigger"',
    desc: 'CLI feedback sends concrete issues back to creators for follow-up.',
  },
  {
    tag: 'Improve',
    title: '"Turn feedback into a Skill update"',
    desc: 'Use real usage feedback to improve triggers, examples, and references.',
  },
  {
    tag: 'Sync',
    title: '"Which Skills need updates?"',
    desc: 'The CLI checks local installed versions and syncs newer marketplace versions.',
  },
]

export function HeroDemoFeatures() {
  return (
    <section className="hd-features" aria-labelledby="hd-features-title">
      <div className="hd-features-head">
        <h2 id="hd-features-title">Use it like this after setup</h2>
        <p>No one has to memorize entry points. Agents can discover the right workflow.</p>
      </div>
      <div className="hd-features-grid">
        {FEATURES.map((f) => (
          <article key={f.tag} className="hd-feature">
            <span className="hd-feature-tag">{f.tag}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}
