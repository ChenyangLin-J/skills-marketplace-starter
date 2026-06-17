import Link from 'next/link'
import { CATEGORIES, type Skill } from '@/lib/types'
import { formatRelativeTime } from '@/lib/format'
import { Highlight, descriptionContext } from '@/lib/highlight'
import { authorBadge, authorLabel } from '@/lib/author'
import { skillDisplayDescription, skillDisplayName, skillTechnicalName } from '@/lib/skill-display'

function categoryLabel(cat: string): string {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat
}

function frontmatterIcon(skill: Skill): string {
  const fm = skill.frontmatter as { icon?: string; emoji?: string }
  return fm?.icon || fm?.emoji || CATEGORIES.find((c) => c.value === skill.category)?.emoji || '🧩'
}

export function SkillCard({ skill, q = '' }: { skill: Skill; q?: string }) {
  const displayName = skillDisplayName(skill)
  const technicalName = skillTechnicalName(skill)
  const displayDescription = skillDisplayDescription(skill)
  const desc = q ? descriptionContext(displayDescription, q) : displayDescription
  const author = authorLabel(skill)
  const badge = authorBadge(skill)
  const href = `/skills/${encodeURIComponent(skill.slug)}`
  return (
    <article className="skill-card">
      <Link href={href} className="skill-card-overlay" aria-label={`View ${displayName}`} />
      <div className="skill-card-header">
        <div className="skill-card-icon">{frontmatterIcon(skill)}</div>
        <div className="skill-card-info">
          <div className="skill-card-title-row">
            <span className="skill-card-name">
              <Highlight text={displayName} q={q} />
            </span>
          </div>
          {technicalName && (
            <div className="skill-card-technical-name">
              <Highlight text={technicalName} q={q} />
            </div>
          )}
          <div className="skill-card-author">
            <span>{author}</span>
            {badge && <span className={`author-badge ${badge.tone}`}>{badge.label}</span>}
          </div>
        </div>
        <span className="skill-card-category">{categoryLabel(skill.category)}</span>
      </div>
      <div className="skill-card-desc">
        <Highlight text={desc} q={q} />
      </div>
      <div
        className={`skill-card-tags${skill.tags.length === 0 ? ' empty' : ''}`}
        aria-hidden={skill.tags.length === 0}
      >
        {skill.tags.slice(0, 3).map((t) => (
          <span key={t} className="tag">
            #<Highlight text={t} q={q} />
          </span>
        ))}
      </div>
      <div className="skill-card-footer">
        <span className="skill-card-stat">⬇ {skill.install_count}</span>
        <span className="skill-card-stat">❤ {skill.like_count}</span>
        <span className="skill-card-stat">v{skill.version}</span>
        <span className="skill-card-stat" style={{ marginLeft: 'auto' }}>
          {formatRelativeTime(skill.updated_at)}
        </span>
      </div>
    </article>
  )
}
