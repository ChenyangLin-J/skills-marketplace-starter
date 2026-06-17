import type { Skill } from './types'

const EXTERNAL_AUTHORS = new Set([
  'anthropic',
  'coreyhaines',
  'firebase',
  'mattpocock',
  'obra',
  'supabase',
  'vercel-labs',
])

export type AuthorBadge = {
  label: '官方' | '外部'
  tone: 'official' | 'external'
}

export function authorLabel(skill: Pick<Skill, 'author' | 'author_name'>): string {
  const name = skill.author_name?.trim()
  if (name && name !== skill.author) return `@${name}`
  return `@${skill.author}`
}

export function authorBadge(skill: Pick<Skill, 'author' | 'source'>): AuthorBadge | null {
  if (skill.source === 'official') return { label: '官方', tone: 'official' }
  if (skill.source === 'external') return { label: '外部', tone: 'external' }
  if (skill.author === 'community') return { label: '官方', tone: 'official' }
  if (EXTERNAL_AUTHORS.has(skill.author)) return { label: '外部', tone: 'external' }
  return null
}
