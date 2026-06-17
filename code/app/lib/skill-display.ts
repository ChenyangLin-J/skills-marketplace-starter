import type { Skill } from './types'

const DISPLAY_NAME_BY_SLUG: Record<string, string> = {
  '@community/marketplace-guide': 'Marketplace starter guide',
  '@community/skill-creator': 'Skill authoring coach',
  '@demo/hello-world': 'Hello world example',
  '@demo/report-writer': 'Report writing assistant',
}

const DESCRIPTION_BY_SLUG: Record<string, string> = {
  '@community/marketplace-guide': 'Helps agents search, install, update, and report feedback with agent-skills.',
  '@community/skill-creator': 'Turns team knowledge into a clear, triggerable SKILL.md.',
  '@demo/hello-world': 'A minimal sample skill for testing install and update flows.',
  '@demo/report-writer': 'Helps structure notes, analysis, or findings into a useful report.',
}

export function getSkillDisplayName(slug: string, fallback: string): string {
  return DISPLAY_NAME_BY_SLUG[slug] || humanizeName(fallback)
}

export function getSkillShortDescription(slug: string, fallback: string): string {
  return DESCRIPTION_BY_SLUG[slug] || compactDescription(fallback)
}

export function skillDisplayName(skill: Pick<Skill, 'slug' | 'name' | 'frontmatter'>): string {
  const fm = skill.frontmatter as Record<string, unknown>
  const displayName = frontmatterString(fm, [
    'display_name',
    'displayName',
    'title',
    'title_zh',
    'name_zh',
  ])
  return displayName || getSkillDisplayName(skill.slug, skill.name)
}

export function skillDisplayDescription(
  skill: Pick<Skill, 'slug' | 'description' | 'frontmatter'>,
): string {
  const fm = skill.frontmatter as Record<string, unknown>
  const displayDescription = frontmatterString(fm, [
    'display_description',
    'displayDescription',
    'summary',
    'summary_zh',
    'description_zh',
  ])
  return displayDescription || getSkillShortDescription(skill.slug, skill.description)
}

export function skillTechnicalName(skill: Pick<Skill, 'slug' | 'name'>): string {
  const displayName = getSkillDisplayName(skill.slug, skill.name)
  return displayName === skill.name ? '' : skill.name
}

function humanizeName(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function compactDescription(value: string): string {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value
}

function frontmatterString(fm: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = fm[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}
