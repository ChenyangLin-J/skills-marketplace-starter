'use client'

import Link from 'next/link'
import { CATEGORIES, type Skill } from '@/lib/types'
import { HeroInstallCommand } from '@/components/HeroInstallCommand'
import { authorBadge, authorLabel } from '@/lib/author'
import { skillDisplayDescription, skillDisplayName } from '@/lib/skill-display'

type HeroPublishWallProps = {
  skills: Skill[]
}

export function HeroPublishWall({ skills }: HeroPublishWallProps) {
  const featured = skills[0]
  const rest = skills.slice(1, 4)

  if (!featured) {
    return (
      <div className="hero-publish-wall empty">
        <div className="hero-wall-card tall">
          <div className="hero-card-kicker">Featured Skill</div>
          <h2>Waiting for the first Skill</h2>
          <p>Published Skills will appear here automatically.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="hero-publish-wall">
      <HeroWallCard skill={featured} featured />
      {rest.map((skill, idx) => (
        <HeroWallCard key={skill.slug} skill={skill} offset={idx === 0} />
      ))}
    </div>
  )
}

function HeroWallCard({
  skill,
  featured,
  offset,
}: {
  skill: Skill
  featured?: boolean
  offset?: boolean
}) {
  const href = `/skills/${encodeURIComponent(skill.slug)}`
  const author = authorLabel(skill)
  const badge = authorBadge(skill)
  const displayName = skillDisplayName(skill)

  if (featured) {
    return (
      <article className="hero-wall-card tall">
        <Link href={href} className="hero-card-overlay-link" aria-label={`View ${displayName}`} />
        <div className="hero-card-content">
          <div className="hero-feature-top">
            <span className="hero-feature-label">Featured Skill</span>
            <span className="hero-feature-author">
              <span>{author}</span>
              {badge && <span className={`author-badge ${badge.tone}`}>{badge.label}</span>}
            </span>
          </div>
          <h2>{displayName}</h2>
          <p>{heroSummary(skill)}</p>
        </div>
        <HeroInstallCommand command={`agent-skills install ${skill.slug}`} />
      </article>
    )
  }

  return (
    <Link href={href} className={`hero-wall-card${offset ? ' offset' : ''}`}>
      <div className="hero-wall-row">
        <div className="hero-skill-icon">{frontmatterIcon(skill)}</div>
        <div className="hero-wall-main">
          <div className="hero-wall-name">{displayName}</div>
          <div className="hero-wall-desc">{skillDisplayDescription(skill)}</div>
        </div>
      </div>
      <div className="hero-wall-meta">
        <span>{author}</span>
        {badge && <span className={`author-badge ${badge.tone}`}>{badge.label}</span>}
      </div>
    </Link>
  )
}

function frontmatterIcon(skill: Skill): string {
  const fm = skill.frontmatter as { icon?: string; emoji?: string }
  return fm?.icon || fm?.emoji || CATEGORIES.find((c) => c.value === skill.category)?.emoji || '🧩'
}

function heroSummary(skill: Skill): string {
  const fm = skill.frontmatter as {
    heroDescription?: string
    summary?: string
    short_description?: string
    tagline?: string
  }
  return compactText(
    fm.heroDescription || skillDisplayDescription(skill),
    96
  )
}

function compactText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  const cut = text.lastIndexOf(' ', maxLength)
  return `${text.slice(0, cut > 64 ? cut : maxLength).trim()}...`
}
