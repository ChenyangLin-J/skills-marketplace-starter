import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export type TutorialAudience = 'user' | 'creator' | 'all'

export type Tutorial = {
  slug: string
  title: string
  description: string
  audience: TutorialAudience
  difficulty: string
  duration: string
  category: string
  order: number
  screenshot?: string
  videoPlaceholder?: string
  body: string
}

const TUTORIAL_DIR = path.join(process.cwd(), 'content', 'tutorials')

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asNumber(value: unknown, fallback = 999): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asAudience(value: unknown): TutorialAudience {
  if (value === 'user' || value === 'creator' || value === 'all') return value
  return 'all'
}

function readTutorialFile(filename: string): Tutorial {
  const fullPath = path.join(TUTORIAL_DIR, filename)
  const raw = fs.readFileSync(fullPath, 'utf8')
  const parsed = matter(raw)
  const slug = filename.replace(/\.md$/, '')

  return {
    slug,
    title: asString(parsed.data.title, slug),
    description: asString(parsed.data.description),
    audience: asAudience(parsed.data.audience),
    difficulty: asString(parsed.data.difficulty, 'beginner'),
    duration: asString(parsed.data.duration, '5 min'),
    category: asString(parsed.data.category, '基础教程'),
    order: asNumber(parsed.data.order),
    screenshot: asString(parsed.data.screenshot) || undefined,
    videoPlaceholder: asString(parsed.data.videoPlaceholder) || undefined,
    body: parsed.content.trim(),
  }
}

export function listTutorials(): Tutorial[] {
  if (!fs.existsSync(TUTORIAL_DIR)) return []

  return fs
    .readdirSync(TUTORIAL_DIR)
    .filter((filename) => filename.endsWith('.md'))
    .map(readTutorialFile)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}

export function getTutorialBySlug(slug: string): Tutorial | null {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, '')
  const filename = `${safeSlug}.md`
  const fullPath = path.join(TUTORIAL_DIR, filename)
  if (!fs.existsSync(fullPath)) return null
  return readTutorialFile(filename)
}

export function getAdjacentTutorials(slug: string): {
  previous: Tutorial | null
  next: Tutorial | null
} {
  const tutorials = listTutorials()
  const index = tutorials.findIndex((tutorial) => tutorial.slug === slug)
  return {
    previous: index > 0 ? tutorials[index - 1] : null,
    next: index >= 0 && index < tutorials.length - 1 ? tutorials[index + 1] : null,
  }
}
