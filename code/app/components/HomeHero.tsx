'use client'

import Link from 'next/link'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AnchorScrollLink } from '@/components/AnchorScrollLink'
import { HOME_GUIDE_COMPLETED_STORAGE_KEY } from '@/lib/home-guide-state'

const MARKETPLACE_ORIGIN =
  process.env.NEXT_PUBLIC_AGENT_SKILLS_MARKETPLACE_URL ||
  'http://localhost:3000'
const MAC_INSTALL_COMMAND =
  `export PATH="$HOME/.local/bin:$PATH"; curl -fsSL ${MARKETPLACE_ORIGIN}/install.sh | bash`
const WINDOWS_INSTALL_COMMAND = `irm ${MARKETPLACE_ORIGIN}/install.ps1 | iex`

type Platform = 'mac' | 'windows'
type GuideTab = 'install' | 'use'
type HeroState = 'visible' | 'collapsing' | 'hidden'
type PersistenceMode = 'account' | 'local'

type HomeHeroProps = {
  accountGuideCompleted: boolean
  persistenceMode: PersistenceMode
  skillCount: number
  installCount: number
}

export function HomeHero({
  accountGuideCompleted,
  persistenceMode,
  skillCount,
  installCount,
}: HomeHeroProps) {
  const [heroState, setHeroState] = useState<HeroState>(
    accountGuideCompleted ? 'hidden' : 'visible',
  )

  useEffect(() => {
    if (persistenceMode !== 'local') return undefined
    const timer = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(HOME_GUIDE_COMPLETED_STORAGE_KEY) === '1') {
          setHeroState('hidden')
        }
      } catch {
        // localStorage may be unavailable in restricted browser contexts.
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [persistenceMode])

  function onComplete() {
    try {
      window.localStorage.setItem(HOME_GUIDE_COMPLETED_STORAGE_KEY, '1')
    } catch {
      // The completion still works for the current page even without persistence.
    }
    if (persistenceMode === 'account') {
      void fetch('/api/me/home-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      }).catch(() => {
        // The local fallback above keeps this browser hidden even if account sync fails.
      })
    }
    window.dispatchEvent(new CustomEvent('marketplace-guide-stored'))
    setHeroState('collapsing')
    window.setTimeout(() => setHeroState('hidden'), 640)
  }

  if (heroState === 'hidden') return null

  return (
    <section className={`home-hero${heroState === 'collapsing' ? ' home-hero-collapsing' : ''}`}>
      <div className="home-hero-inner">
        <div className="home-hero-copy">
          <span className="hero-eyebrow">Open source starter kit</span>
          <h1>
            Self-host your
            <br />
            agent skills marketplace
          </h1>
          <p className="hero-lead">
            Publish reusable workflows as Skills, install them into local AI agents, and turn real failures into creator feedback.
          </p>

          <div className="hero-actions">
            <AnchorScrollLink className="hero-btn primary" href="/#explore">
              Explore skills
            </AnchorScrollLink>
            <Link className="hero-btn" href="/docs">
              Read docs
            </Link>
          </div>

          <div className="hero-meta-row">
            <span>{formatCount(skillCount)} Skills</span>
            <span>{formatCount(installCount)} Installs</span>
            <span>Codex / Claude / Cursor</span>
          </div>
        </div>

        <HomeOnboardingGuide onComplete={onComplete} />
      </div>
    </section>
  )
}

function HomeOnboardingGuide({ onComplete }: { onComplete: () => void }) {
  const [platform, setPlatform] = useState<Platform>('mac')
  const [guideTab, setGuideTab] = useState<GuideTab>('install')
  const [copied, setCopied] = useState(false)
  const [copyLabel, setCopyLabel] = useState('Copy install command')
  const [hint, setHint] = useState('')
  const [showManualCommand, setShowManualCommand] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const platformText = `${navigator.userAgent || ''} ${navigator.platform || ''}`.toLowerCase()
      if (platformText.includes('win')) {
        setPlatform('windows')
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function selectPlatform(nextPlatform: Platform) {
    setPlatform(nextPlatform)
    setCopied(false)
    setCopyLabel('Copy install command')
    setHint('')
    setShowManualCommand(false)
  }

  async function onCopyInstall() {
    const command = commandForPlatform(platform)
    let terminalLikelyOpened = false
    const markTerminalLikelyOpened = () => {
      terminalLikelyOpened = true
    }

    try {
      await copyText(command)
      setCopied(true)
      setShowManualCommand(false)

      if (platform === 'windows') {
        window.addEventListener('blur', markTerminalLikelyOpened, { once: true })
        document.addEventListener('visibilitychange', markTerminalLikelyOpened, { once: true })
        window.location.href = 'ms-terminal:'
        setCopyLabel('Copied, opening terminal...')
        setHint('')

        window.setTimeout(() => {
          window.removeEventListener('blur', markTerminalLikelyOpened)
          document.removeEventListener('visibilitychange', markTerminalLikelyOpened)
          if (terminalLikelyOpened || document.visibilityState !== 'visible') {
            setCopyLabel('Copied')
            setHint('If the command did not run, come back and copy it again.')
            return
          }
          setCopyLabel('Copied, paste in terminal')
          setHint('No terminal opened? Open PowerShell, paste the copied command, then press Enter.')
        }, 1500)
        return
      }

      setCopyLabel('Copied, paste in terminal')
      setHint('Open Terminal, paste the copied command, then press Enter.')
    } catch {
      setCopied(false)
      setCopyLabel('Try copying again')
      setHint('Copy the command below manually, then paste it into your terminal.')
      setShowManualCommand(true)
    }
  }

  const command = commandForPlatform(platform)
  const terminalHelp =
    platform === 'windows'
      ? 'On Windows, open the Start menu, search PowerShell, then open it.'
      : 'On macOS, press Command + Space and search Terminal.'

  return (
    <aside className="home-onboarding-panel">
      <div className="home-onboarding-shell">
        <div className="home-onboarding-card">
          <div className={`home-guide-pane${guideTab === 'install' ? ' active' : ''}`}>
            <div className="home-onboarding-head">
              <div>
                <div className="home-onboarding-kicker">First run</div>
                <h2>Install the marketplace helper into your agent</h2>
                <p>No CLI background required. Copy, paste, press Enter.</p>
              </div>
              <span className="home-onboarding-time">~2 min</span>
            </div>

            <div className="home-system-switch" aria-label="Choose your operating system">
              <button
                type="button"
                className={`home-system-option${platform === 'mac' ? ' active' : ''}`}
                onClick={() => selectPlatform('mac')}
                aria-pressed={platform === 'mac'}
              >
                Mac / Linux
              </button>
              <button
                type="button"
                className={`home-system-option${platform === 'windows' ? ' active' : ''}`}
                onClick={() => selectPlatform('windows')}
                aria-pressed={platform === 'windows'}
              >
                Windows
              </button>
            </div>

            <div className="home-download-action">
              <button
                type="button"
                className={`home-copy-install${copied ? ' copied' : ''}`}
                onClick={onCopyInstall}
              >
                {copied ? (
                  <Check size={15} strokeWidth={2.4} aria-hidden="true" />
                ) : (
                  <Copy size={15} strokeWidth={2.4} aria-hidden="true" />
                )}
                <span>{copyLabel}</span>
              </button>
              <p className={hint ? 'home-download-helper active' : 'home-download-helper'} aria-live="polite">
                {hint || 'We will try to open a terminal. If it does not open, the next step tells you where to paste.'}
              </p>
              {showManualCommand && (
                <div className="home-manual-command">
                  <div>If copy fails, select this command manually:</div>
                  <code>{command}</code>
                </div>
              )}
            </div>

            <div className="home-plain-steps">
              <GuideStep number="1" title="Open Terminal" description={terminalHelp} />
              <GuideStep
                number="2"
                title="Paste the copied command, then press Enter"
                description="When the installer asks for a target, choose the agent you use: Codex, Claude, or Cursor."
              />
              <GuideStep
                number="3"
                title="Open your agent and ask one thing"
                description="If it does not react in the current chat, start a fresh agent session and try again."
              />
            </div>

            <div className="home-example-strip">
              <div className="home-example-title">After install, try asking:</div>
              <div className="home-example-list">
                <span>What skills are available?</span>
                <span>I need to write a project report</span>
                <span>This Skill did not trigger. Send feedback.</span>
              </div>
            </div>

            <div className="home-onboarding-foot">
              <span>This starter flow is also available in the docs.</span>
              <button type="button" onClick={onComplete}>
                Done
              </button>
            </div>
          </div>

          <div className={`home-guide-pane${guideTab === 'use' ? ' active' : ''}`}>
            <div className="home-onboarding-head">
              <div>
                <div className="home-onboarding-kicker">What it enables</div>
                <h2>Give agents the context they keep missing</h2>
                <p>Search, install, use, and improve Skills from the same local workflow.</p>
              </div>
              <span className="home-onboarding-time">Ask directly</span>
            </div>

            <div className="home-use-intro">
              <div className="home-prompt-list">
                <PromptItem
                  marker="1"
                  title="“What skills are available?”"
                  description="The agent can use the guide Skill to query the marketplace and explain what each Skill is for."
                />
                <PromptItem
                  marker="2"
                  title="“I need to write a project report.”"
                  description="The agent can search for report-writer, explain the fit, and ask before installing it."
                />
                <PromptItem
                  marker="3"
                  title="“Turn this workflow into a Skill.”"
                  description="skill-creator helps convert triggers, steps, examples, and boundaries into SKILL.md."
                />
                <PromptItem
                  marker="4"
                  title="“This Skill did not trigger. Send feedback.”"
                  description="The CLI feedback loop gives maintainers concrete examples they can fix."
                />
                <PromptItem
                  marker="5"
                  title="“Summarize these feedback items into an update plan.”"
                  description="Creators can improve trigger wording, examples, references, then publish a new version."
                />
              </div>

              <div className="home-use-tags">
                <span>discover</span>
                <span>install</span>
                <span>feedback</span>
                <span>iterate</span>
                <span>publish</span>
                <span>local agents</span>
              </div>
            </div>

            <div className="home-onboarding-foot">
              <span>Install the guide first, then let your agent find the right capability.</span>
              <button type="button" onClick={onComplete}>
                Got it
              </button>
            </div>
          </div>
        </div>

        <div className="home-guide-rail" aria-label="Switch starter guide content">
          <button
            type="button"
            className={guideTab === 'install' ? 'active' : ''}
            onClick={() => setGuideTab('install')}
            aria-pressed={guideTab === 'install'}
          >
            Install guide
          </button>
          <button
            type="button"
            className={guideTab === 'use' ? 'active' : ''}
            onClick={() => setGuideTab('use')}
            aria-pressed={guideTab === 'use'}
          >
            What it enables
          </button>
        </div>
      </div>
    </aside>
  )
}

function GuideStep({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="home-guide-step">
      <span>{number}</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}

function PromptItem({
  marker,
  title,
  description,
}: {
  marker: string
  title: string
  description: string
}) {
  return (
    <div className="home-prompt-item">
      <span>{marker}</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  )
}

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) {
    throw new Error('copy failed')
  }
}

function commandForPlatform(platform: Platform): string {
  return platform === 'windows' ? WINDOWS_INSTALL_COMMAND : MAC_INSTALL_COMMAND
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}
