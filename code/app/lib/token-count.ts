import matter from 'gray-matter'
import { getEncoding } from 'js-tiktoken'
import type { Skill } from './types'

let o200kEncoder: ReturnType<typeof getEncoding> | null = null

function getO200kEncoder(): ReturnType<typeof getEncoding> {
  o200kEncoder ??= getEncoding('o200k_base')
  return o200kEncoder
}

export function skillMarkdownForTokenCount(skill: Skill): string {
  return matter.stringify(skill.readme || '', {
    ...skill.frontmatter,
    name: skill.name,
    version: skill.version,
    description: skill.description,
  })
}

export function countO200kTokens(text: string): number {
  return getO200kEncoder().encode(text).length
}

export function formatTokenCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}
