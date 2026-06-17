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
          <span className="hero-eyebrow">Take the best with you</span>
          <h1>
            把团队能力，
            <br />
            装进你的Agent
          </h1>
          <p className="hero-lead">
            把常用流程、工具调用、方法论和自动化脚本做成 Skill，一键调用，让你的 AI 工作流更顺手。
          </p>

          <div className="hero-actions">
            <AnchorScrollLink className="hero-btn primary" href="/#explore">
              浏览发布墙
            </AnchorScrollLink>
            <Link className="hero-btn" href="/docs">
              阅读教程
            </Link>
          </div>

          <div className="hero-meta-row">
            <span>{formatCount(skillCount)} Skills</span>
            <span>{formatCount(installCount)} Installs</span>
            <span>Claude Code / Codex / Cursor</span>
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
  const [copyLabel, setCopyLabel] = useState('复制安装内容')
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
    setCopyLabel('复制安装内容')
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
        setCopyLabel('已复制，正在尝试打开终端...')
        setHint('')

        window.setTimeout(() => {
          window.removeEventListener('blur', markTerminalLikelyOpened)
          document.removeEventListener('visibilitychange', markTerminalLikelyOpened)
          if (terminalLikelyOpened || document.visibilityState !== 'visible') {
            setCopyLabel('已复制')
            setHint('如果终端没有运行命令，请回到这里重新复制。')
            return
          }
          setCopyLabel('已复制，打开终端粘贴')
          setHint('没有自动打开？请手动打开 PowerShell，粘贴刚才复制的内容运行。')
        }, 1500)
        return
      }

      setCopyLabel('已复制，打开终端粘贴')
      setHint('已复制。现在打开终端，粘贴刚才复制的内容并按回车。')
    } catch {
      setCopied(false)
      setCopyLabel('重试复制')
      setHint('请选中下面这段安装内容复制，再打开终端粘贴运行。')
      setShowManualCommand(true)
    }
  }

  const command = commandForPlatform(platform)
  const terminalHelp =
    platform === 'windows'
      ? 'Windows 点开始菜单，搜索 PowerShell，然后打开它。'
      : 'Mac 按 Command + 空格，搜索 Terminal 或“终端”。'

  return (
    <aside className="home-onboarding-panel">
      <div className="home-onboarding-shell">
        <div className="home-onboarding-card">
          <div className={`home-guide-pane${guideTab === 'install' ? ' active' : ''}`}>
            <div className="home-onboarding-head">
              <div>
                <div className="home-onboarding-kicker">第一次使用</div>
                <h2>先把市场助手装到你的 AI 工具里</h2>
                <p>不用理解命令行，跟着复制、粘贴、回车就行。</p>
              </div>
              <span className="home-onboarding-time">约 2 分钟</span>
            </div>

            <div className="home-system-switch" aria-label="选择你的电脑系统">
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
                {hint || '能自动打开就会打开；没有打开也没关系，下一步会告诉你去哪粘贴。'}
              </p>
              {showManualCommand && (
                <div className="home-manual-command">
                  <div>如果复制失败，请选中下面这段内容复制：</div>
                  <code>{command}</code>
                </div>
              )}
            </div>

            <div className="home-plain-steps">
              <GuideStep number="1" title="打开终端" description={terminalHelp} />
              <GuideStep
                number="2"
                title="粘贴刚复制的内容，然后按回车"
                description="看到让你选择工具时，选你平时用的 Codex / Claude / Cursor。"
              />
              <GuideStep
                number="3"
                title="打开你的 AI 工具，问一句试试"
                description="如果没反应，重开一个新会话再问。"
              />
            </div>

            <div className="home-example-strip">
              <div className="home-example-title">装好以后可以这样问：</div>
              <div className="home-example-list">
                <span>Skills 市场有什么？</span>
                <span>我要写一份项目报告</span>
                <span>这个 Skill 不触发，帮我反馈</span>
              </div>
            </div>

            <div className="home-onboarding-foot">
              <span>这套入门说明会放进教程里。</span>
              <button type="button" onClick={onComplete}>
                已完成
              </button>
            </div>
          </div>

          <div className={`home-guide-pane${guideTab === 'use' ? ' active' : ''}`}>
            <div className="home-onboarding-head">
              <div>
                <div className="home-onboarding-kicker">我们能做什么</div>
                <h2>把常用能力装进你的 Agent</h2>
                <p>不用记入口和流程，直接让 AI 按团队方式做事。</p>
              </div>
              <span className="home-onboarding-time">装好就问</span>
            </div>

            <div className="home-use-intro">
              <div className="home-prompt-list">
                <PromptItem
                  marker="问"
                  title="“Skills 市场有什么？”"
                  description="Agent 会先用 guide 查询市场，再帮你理解有哪些能力。"
                />
                <PromptItem
                  marker="装"
                  title="“我要写一份项目报告”"
                  description="Agent 可以搜索 report-writer，说明用途，并询问是否安装。"
                />
                <PromptItem
                  marker="用"
                  title="“把这套经验做成 Skill”"
                  description="用 skill-creator 把触发场景、步骤和示例写成 SKILL.md。"
                />
                <PromptItem
                  marker="反馈"
                  title="“这个 Skill 不触发，帮我反馈给作者”"
                  description="用 CLI feedback 回流问题，作者可以集中查看和处理。"
                />
                <PromptItem
                  marker="改"
                  title="“把这批反馈整理成 Skill 更新方案”"
                  description="根据反馈修改触发词、示例和 reference，再发布新版。"
                />
              </div>

              <div className="home-use-tags">
                <span>查市场</span>
                <span>装能力</span>
                <span>提反馈</span>
                <span>整理反馈</span>
                <span>更新 Skill</span>
                <span>写报告</span>
              </div>
            </div>

            <div className="home-onboarding-foot">
              <span>先装 guide，再让 Agent 带你找能力。</span>
              <button type="button" onClick={onComplete}>
                已了解
              </button>
            </div>
          </div>
        </div>

        <div className="home-guide-rail" aria-label="切换首页新手内容">
          <button
            type="button"
            className={guideTab === 'install' ? 'active' : ''}
            onClick={() => setGuideTab('install')}
            aria-pressed={guideTab === 'install'}
          >
            安装教学
          </button>
          <button
            type="button"
            className={guideTab === 'use' ? 'active' : ''}
            onClick={() => setGuideTab('use')}
            aria-pressed={guideTab === 'use'}
          >
            我们能做什么
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
