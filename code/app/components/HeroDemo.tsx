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
          把团队能力，<br />装进你的 Agent
        </h1>
        <p className="hd-lead">
          让 Claude / Codex / Cursor 直接用上团队沉淀的方法、模板和工作流，
          一行命令装好。
        </p>

        <div className="hd-install">
          <div className="hd-install-tabs" role="tablist" aria-label="选择系统">
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
              aria-label="复制安装命令"
            >
              {copied ? (
                <>
                  <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                  已复制
                </>
              ) : (
                <>
                  <Copy size={14} strokeWidth={2.4} aria-hidden="true" />
                  复制
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
            {showSteps ? '收起安装步骤' : '第一次用？看 3 步说明'}
          </button>

          {showSteps && (
            <ol className="hd-steps">
              <li>
                <strong>打开终端</strong>
                <span>
                  {platform === 'windows'
                    ? 'Windows 搜索 PowerShell 打开'
                    : 'Mac 按 ⌘ + 空格，搜索 Terminal'}
                </span>
              </li>
              <li>
                <strong>粘贴命令，回车</strong>
                <span>选择你的 AI 工具（Claude / Codex / Cursor）</span>
              </li>
              <li>
                <strong>问一句试试</strong>
                <span>“Skills 市场有什么？”</span>
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
            浏览发布墙 →
          </Link>
        </div>
      </div>
    </section>
  )
}

const FEATURES: { tag: string; title: string; desc: string }[] = [
  {
    tag: '问',
    title: '"Skills 市场有什么？"',
    desc: 'Agent 先查市场，再解释每个 Skill 适合什么场景。',
  },
  {
    tag: '装',
    title: '"我要写一份项目报告"',
    desc: 'Agent 搜索 report-writer，说明用途，并询问是否安装。',
  },
  {
    tag: '用',
    title: '"把这套经验做成 Skill"',
    desc: '用 skill-creator 梳理触发词、步骤、示例和边界。',
  },
  {
    tag: '反馈',
    title: '"这个 Skill 不触发，帮我反馈"',
    desc: 'CLI feedback 回流问题，作者集中查看和处理。',
  },
  {
    tag: '改',
    title: '"把反馈整理成 Skill 更新方案"',
    desc: '根据真实反馈修改触发词、示例和 reference。',
  },
  {
    tag: '查',
    title: '"哪些 Skill 需要更新？"',
    desc: 'CLI 检查本地安装版本，并同步 marketplace 的新版。',
  },
]

export function HeroDemoFeatures() {
  return (
    <section className="hd-features" aria-labelledby="hd-features-title">
      <div className="hd-features-head">
        <h2 id="hd-features-title">装好以后可以这样用</h2>
        <p>不用记入口和流程，直接让 AI 按团队方式做事。</p>
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
