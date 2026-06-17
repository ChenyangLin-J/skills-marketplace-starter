import fs from 'node:fs'
import path from 'node:path'
import type Database from 'better-sqlite3'
import AdmZip from 'adm-zip'
import matter from 'gray-matter'

type SeedConfig = {
  dataDir: string
  uploadsDir: string
}

type SeedSkill = {
  dir: string
  author: 'community' | 'demo'
  category: string
  tags: string[]
  source: 'official' | 'user'
  example: string
}

const SEED_SKILLS: SeedSkill[] = [
  {
    dir: 'marketplace-guide',
    author: 'community',
    category: 'tool',
    tags: ['marketplace', 'cli', 'onboarding'],
    source: 'official',
    example: 'What skills are available?',
  },
  {
    dir: 'skill-creator',
    author: 'community',
    category: 'tool',
    tags: ['skill-authoring', 'templates'],
    source: 'official',
    example: 'Help me turn this workflow into a reusable Skill.',
  },
  {
    dir: 'hello-world',
    author: 'demo',
    category: 'tool',
    tags: ['demo', 'test'],
    source: 'user',
    example: 'Run the hello-world Skill.',
  },
  {
    dir: 'report-writer',
    author: 'demo',
    category: 'business',
    tags: ['reports', 'writing'],
    source: 'user',
    example: 'I need to write a project report.',
  },
]

export function seedSkillsIfEmpty(db: Database.Database, config: SeedConfig) {
  if (process.env.AGENT_SKILLS_DISABLE_AUTO_SEED === '1') return

  const row = db.prepare('SELECT COUNT(*) AS count FROM skills').get() as { count: number }
  if (row.count > 0) return

  const seedDir = resolveSeedDir()
  if (!seedDir || !fs.existsSync(seedDir)) return

  const now = Math.floor(Date.now() / 1000)
  ensureSeedUsers(db, now)

  const insertSkill = db.prepare(
    `INSERT INTO skills
      (slug, author, owner_handle, source, name, description, category, tags, status,
       install_access, visibility, version, zip_path, readme, frontmatter, example, created_at, updated_at)
     VALUES
      (@slug, @author, @owner_handle, @source, @name, @description, @category, @tags, 'active',
       'anonymous', 'listed', @version, @zip_path, @readme, @frontmatter, @example, @created_at, @updated_at)`
  )
  const insertVersion = db.prepare(
    `INSERT INTO skill_versions
      (skill_slug, version, zip_path, readme, frontmatter, example, uploaded_by, uploaded_at, metadata_json)
     VALUES
      (@skill_slug, @version, @zip_path, @readme, @frontmatter, @example, @uploaded_by, @uploaded_at, @metadata_json)`
  )

  const tx = db.transaction(() => {
    for (const seed of SEED_SKILLS) {
      const skillDir = path.join(seedDir, seed.dir)
      const skillPath = path.join(skillDir, 'SKILL.md')
      if (!fs.existsSync(skillPath)) continue

      const raw = fs.readFileSync(skillPath, 'utf8')
      const parsed = matter(raw)
      const fm = parsed.data as Record<string, unknown>
      const name = asString(fm.name, seed.dir)
      const description = asString(fm.description, `${name} seed Skill`)
      const version = asString(fm.version, '0.1.0')
      const slug = `@${seed.author}/${name}`
      const zipPath = writeSeedZip(skillDir, config.uploadsDir, seed.author, name, version)
      const frontmatter = JSON.stringify(fm)
      const tags = JSON.stringify(seed.tags)

      insertSkill.run({
        slug,
        author: seed.author,
        owner_handle: seed.author,
        source: seed.source,
        name,
        description,
        category: seed.category,
        tags,
        version,
        zip_path: zipPath,
        readme: parsed.content,
        frontmatter,
        example: seed.example,
        created_at: now,
        updated_at: now,
      })
      insertVersion.run({
        skill_slug: slug,
        version,
        zip_path: zipPath,
        readme: parsed.content,
        frontmatter,
        example: seed.example,
        uploaded_by: seed.author,
        uploaded_at: now,
        metadata_json: JSON.stringify({ category: seed.category, tags: seed.tags, seeded: true }),
      })
    }
  })

  tx()
}

function resolveSeedDir(): string | null {
  const configured = process.env.AGENT_SKILLS_SEED_DIR?.trim()
  if (configured) return path.resolve(configured)

  const candidates = [
    path.resolve(process.cwd(), '../../skills'),
    path.resolve(process.cwd(), 'skills'),
    path.resolve(process.cwd(), '../skills'),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function ensureSeedUsers(db: Database.Database, now: number) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO users
      (open_id, union_id, user_id, tenant_key, handle, name, avatar_url, email, created_at, updated_at)
     VALUES
      (@open_id, NULL, NULL, 'local', @handle, @name, NULL, @email, @created_at, @updated_at)`
  )
  insert.run({
    open_id: 'local_community',
    handle: 'community',
    name: 'Community',
    email: 'community@example.com',
    created_at: now,
    updated_at: now,
  })
  insert.run({
    open_id: 'local_demo',
    handle: 'demo',
    name: 'Demo User',
    email: 'demo@example.com',
    created_at: now,
    updated_at: now,
  })
}

function writeSeedZip(
  skillDir: string,
  uploadsDir: string,
  author: string,
  name: string,
  version: string,
): string {
  const destDir = path.join(uploadsDir, `@${author}`, name)
  fs.mkdirSync(destDir, { recursive: true })
  const zipPath = path.join(destDir, `${version}.zip`)

  const zip = new AdmZip()
  addDirToZip(zip, skillDir, '')
  zip.writeZip(zipPath)
  return zipPath
}

function addDirToZip(zip: AdmZip, dir: string, prefix: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      addDirToZip(zip, fullPath, prefix ? `${prefix}/${entry.name}` : entry.name)
    } else if (entry.isFile()) {
      zip.addLocalFile(fullPath, prefix)
    }
  }
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}
