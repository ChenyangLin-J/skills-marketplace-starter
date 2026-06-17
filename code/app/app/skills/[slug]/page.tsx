import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { canManageSkill, checkSkillVisibility, getSkillBySlug, listSkillVersions } from '@/lib/skills'
import { CATEGORIES, type SkillVersion } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'
import { SkillActions } from '@/components/SkillActions'
import { SkillFeedbackPanel } from '@/components/SkillFeedbackPanel'
import { SkillManagePanel } from '@/components/SkillManagePanel'
import { DetailTabs, type DetailTab } from '@/components/DetailTabs'
import { Toc } from '@/components/Toc'
import { TocDrawer } from '@/components/TocDrawer'
import { getCurrentUserFromCookies, userIdOrAnonymous } from '@/lib/auth/session'
import { authorBadge, authorLabel } from '@/lib/author'
import { listSkillFiles, type SkillFileEntry } from '@/lib/skill-files'
import { countO200kTokens, formatTokenCount, skillMarkdownForTokenCount } from '@/lib/token-count'
import { ScrollToTopOnMount } from '@/components/ScrollToTopOnMount'

export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>
type SearchParams = Promise<{ tab?: string; from?: string }>

export default async function DetailPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { slug: raw } = await params
  const sp = await searchParams
  const slug = decodeURIComponent(raw)
  const currentUser = await getCurrentUserFromCookies()
  const skill = getSkillBySlug(slug, userIdOrAnonymous(currentUser))
  if (!skill) notFound()
  if (!checkSkillVisibility(skill, currentUser).allowed) notFound()

  const cat = CATEGORIES.find((c) => c.value === skill.category)
  const fm = skill.frontmatter as { icon?: string; emoji?: string }
  const icon = fm?.icon || fm?.emoji || cat?.emoji || '🧩'
  const author = authorLabel(skill)
  const badge = authorBadge(skill)
  const files = await listSkillFiles(skill.slug)
  const versions = listSkillVersions(skill.slug)
  const canManage = canManageSkill(skill, currentUser)
  const isArchived = skill.status === 'archived'
  const backTarget = getBackTarget(sp.from)
  const skillTokenCount = countO200kTokens(skillMarkdownForTokenCount(skill))

  const readmeNode = skill.readme ? (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{skill.readme}</ReactMarkdown>
  ) : (
    <p style={{ color: 'var(--text-muted)' }}>(No SKILL.md body)</p>
  )

  const tabs: DetailTab[] = [
    {
      key: 'detail',
      label: 'Details',
      panel: (
        <div className="detail-body">
          <div className="detail-body-main markdown-body" data-toc-target="true">
            {readmeNode}
          </div>
          <aside className="detail-body-toc">
            <Toc markdown={skill.readme || ''} />
          </aside>
          <TocDrawer markdown={skill.readme || ''} mobileOnly />
        </div>
      ),
    },
    {
      key: 'files',
      label: `Files (${files.filter((file) => !file.isDirectory).length})`,
      panel: <SkillFilesPanel files={files} />,
    },
    {
      key: 'example',
      label: 'Example',
      panel: (
        <div>
          <h3 style={{ fontSize: 16, marginBottom: 12, fontWeight: 600 }}>Usage example</h3>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 24,
            }}
          >
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              Type this in Claude Code, Codex, or Cursor:
            </p>
            <pre
              style={{
                background: 'var(--bg-soft)',
                padding: 12,
                borderRadius: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              <code>{skill.example || 'No example provided'}</code>
            </pre>
          </div>
          <p
            style={{
              marginTop: 16,
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            Example gallery placeholder: show real usage scenarios from other users.
          </p>
        </div>
      ),
    },
    {
      key: 'comments',
      label: 'Comments (0)',
      devOnly: true,
      panel: (
        <div>
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              padding: 32,
              background: 'var(--bg-soft)',
              borderRadius: 6,
              fontSize: 13,
            }}
          >
            No comments yet.
          </div>
          <div style={{ marginTop: 24 }}>
            <textarea
              placeholder="Write a comment..."
              disabled
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-soft)',
                fontSize: 13,
                fontFamily: 'inherit',
                minHeight: 80,
                resize: 'vertical',
                color: 'var(--text-muted)',
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Comments are a placeholder feature.
              </span>
              <button
                type="button"
                disabled
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: 'var(--bg-soft)',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  cursor: 'not-allowed',
                }}
              >
                Post comment
              </button>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'versions',
      label: `Versions (${versions.length})`,
      panel: <SkillVersionsPanel versions={versions} />,
    },
    {
      key: 'feedback',
      label: 'Feedback',
      panel: (
        <SkillFeedbackPanel
          slug={skill.slug}
          version={skill.version}
          isLoggedIn={!!currentUser}
          canManage={canManage}
        />
      ),
    },
    ...(canManage
      ? [
          {
            key: 'manage',
            label: 'Manage',
            panel: <SkillManagePanel skill={skill} />,
          },
        ]
      : []),
  ]

  return (
    <div
      className={`skill-detail-page skill-detail-${skill.category}`}
      style={{ maxWidth: 1040, margin: '0 auto', padding: 32 }}
    >
      <ScrollToTopOnMount />
      <div className="skill-detail-hero">
        <div className="skill-detail-topbar">
          <Link className="skill-detail-back" href={backTarget.href}>
            <span aria-hidden="true">←</span>
            {backTarget.label}
          </Link>
        </div>

        <header
          className="skill-detail-header"
          style={{
            padding: '24px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
            <div
              className="skill-detail-icon"
              style={{
                fontSize: 36,
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-soft)',
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700 }}>{skill.name}</h1>
            </div>
          </div>

          <div
            className="skill-detail-description"
            style={{
              padding: 14,
              background: 'var(--bg-soft)',
              borderRadius: 6,
              fontSize: 14,
              lineHeight: 1.6,
              color: 'var(--text-primary)',
            }}
          >
            {skill.description}
          </div>

          {isArchived && (
            <div className="skill-archived-banner">
              This Skill is archived. It is hidden from listings and search by default, and install/download requests are rejected.
            </div>
          )}

          <div
            className="skill-detail-meta"
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 16,
              flexWrap: 'wrap',
              fontSize: 13,
              color: 'var(--text-secondary)',
            }}
          >
            <span className="skill-detail-author-meta">
              Author{' '}
              <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>
                {author}
              </strong>
              {badge && (
                <span className={`author-badge ${badge.tone}`} style={{ marginLeft: 4 }}>
                  {badge.label}
                </span>
              )}
            </span>
            <span>
              Category{' '}
              <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>
                {cat?.label ?? skill.category}
              </strong>
            </span>
            <span>
              Version{' '}
              <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>
                v{skill.version}
              </strong>
            </span>
            <span
              title="Estimated with OpenAI o200k_base, including frontmatter and body. Other model tokenizers may differ."
            >
              SKILL.md Tokens{' '}
              <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>
                ~{formatTokenCount(skillTokenCount)}
              </strong>
            </span>
            <span>
              Installs{' '}
              <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>
                {skill.install_count}
              </strong>
            </span>
            <span>
              This week{' '}
              <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>
                +{skill.weekly_install_count}
              </strong>
            </span>
            <span>
              Updated{' '}
              <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>
                {formatRelativeTime(skill.updated_at)}
              </strong>
            </span>
          </div>

          <SkillActions
            slug={skill.slug}
            installAccess={skill.install_access}
            initialLikes={skill.like_count}
            initialLiked={skill.liked_by_me}
            isLoggedIn={!!currentUser}
            isArchived={isArchived}
          />

          {skill.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
              {skill.tags.map((t) => (
                <span key={t} className="tag">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </header>
      </div>

      <div className="skill-detail-tabs" style={{ marginTop: 8 }}>
        <DetailTabs tabs={tabs} defaultKey={sp.tab || 'detail'} />
      </div>
    </div>
  )
}

function getBackTarget(from: string | undefined): { href: string; label: string } {
  if (from === 'mine') return { href: '/mine', label: 'Back to Mine' }
  if (from === 'admin') return { href: '/admin', label: 'Back to Admin' }
  return { href: '/', label: 'Back home' }
}

function SkillVersionsPanel({ versions }: { versions: SkillVersion[] }) {
  if (versions.length === 0) {
    return (
      <div className="skill-files-empty">
        No version history yet.
      </div>
    )
  }

  return (
    <div className="skill-versions-panel">
      <div className="skill-versions-header">
        <div>
          <h3>Version history</h3>
          <p>Install and download use the current version by default. Historical versions are kept as records.</p>
        </div>
        <span>{versions.length} versions</span>
      </div>
      <div className="skill-versions-list">
        {versions.map((version) => (
          <div key={version.id} className="skill-version-row">
            <div className="skill-version-main">
              <strong>v{version.version}</strong>
              {version.is_current && <span className="skill-version-current">Current</span>}
            </div>
            <div className="skill-version-meta">
              <span>{formatRelativeTime(version.uploaded_at)}</span>
              {version.uploaded_by && <span>Uploaded by @{version.uploaded_by}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkillFilesPanel({ files }: { files: SkillFileEntry[] }) {
  if (files.length === 0) {
    return (
      <div className="skill-files-empty">
        Could not read the file list for this Skill.
      </div>
    )
  }

  return (
    <div className="skill-files-panel">
      <div className="skill-files-header">
        <div>
          <h3>File structure</h3>
          <p>From the current package, useful for checking whether the Skill includes scripts, assets, or references.</p>
        </div>
        <span>{files.filter((file) => !file.isDirectory).length} files</span>
      </div>
      <div className="skill-files-list">
        {files.map((file) => (
          <div
            key={file.path}
            className={`skill-file-row${file.isDirectory ? ' directory' : ''}`}
            style={fileRowStyle(file.depth)}
          >
            <span className="skill-file-icon" aria-hidden="true">
              {file.isDirectory ? '▸' : fileIcon(file.name)}
            </span>
            <span className="skill-file-name">{file.name}</span>
            {!file.isDirectory && <span className="skill-file-size">{formatBytes(file.size)}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function fileIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower === 'skill.md' || lower.endsWith('.md')) return 'MD'
  if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) return '{}'
  if (lower.endsWith('.py')) return 'PY'
  if (lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'JS'
  if (lower.endsWith('.sh') || lower.endsWith('.ps1')) return '$'
  return '•'
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function fileRowStyle(depth: number): CSSProperties {
  return { '--indent': `${18 + depth * 18}px` } as CSSProperties
}
