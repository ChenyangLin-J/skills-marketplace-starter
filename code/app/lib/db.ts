import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { seedSkillsIfEmpty } from './seed-skills'

function resolveDataDir(): string {
  const configured = process.env.AGENT_SKILLS_DATA_DIR?.trim()
  return configured ? path.resolve(configured) : path.resolve(process.cwd(), 'data')
}

const DATA_DIR = resolveDataDir()
const DB_PATH = path.join(DATA_DIR, 'skills.db')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const PLATFORM_OWNER_HANDLE = 'community'
const EXTERNAL_AUTHORS = [
  'anthropic',
  'coreyhaines',
  'firebase',
  'mattpocock',
  'obra',
  'supabase',
  'vercel-labs',
]
const EXTERNAL_AUTHOR_SQL = EXTERNAL_AUTHORS.map((author) => `'${author}'`).join(', ')

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT UNIQUE NOT NULL,
      author       TEXT NOT NULL,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL,
      category     TEXT NOT NULL,
      tags         TEXT,
      version      TEXT NOT NULL,
      zip_path     TEXT NOT NULL,
      readme       TEXT,
      frontmatter  TEXT,
      example      TEXT,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
    CREATE INDEX IF NOT EXISTS idx_skills_author   ON skills(author);
    CREATE INDEX IF NOT EXISTS idx_skills_updated  ON skills(updated_at DESC);

    CREATE TABLE IF NOT EXISTS installs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_slug  TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      agent       TEXT,
      version     TEXT,
      source      TEXT,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_installs_slug ON installs(skill_slug);
    CREATE INDEX IF NOT EXISTS idx_installs_user ON installs(user_id);

    CREATE TABLE IF NOT EXISTS likes (
      skill_slug  TEXT NOT NULL,
      user_id     TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      PRIMARY KEY (skill_slug, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_likes_slug ON likes(skill_slug);

    CREATE TABLE IF NOT EXISTS users (
      open_id     TEXT PRIMARY KEY,
      union_id    TEXT,
      user_id     TEXT,
      tenant_key  TEXT,
      handle      TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      avatar_url  TEXT,
      email       TEXT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash    TEXT PRIMARY KEY,
      user_open_id  TEXT NOT NULL,
      expires_at    INTEGER NOT NULL,
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_open_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS cli_login_requests (
      state_hash       TEXT PRIMARY KEY,
      device_code_hash TEXT UNIQUE NOT NULL,
      user_open_id     TEXT,
      expires_at       INTEGER NOT NULL,
      consumed_at      INTEGER,
      created_at       INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cli_login_device ON cli_login_requests(device_code_hash);
    CREATE INDEX IF NOT EXISTS idx_cli_login_expires ON cli_login_requests(expires_at);

    CREATE TABLE IF NOT EXISTS cli_tokens (
      token_hash    TEXT PRIMARY KEY,
      user_open_id  TEXT NOT NULL,
      expires_at    INTEGER NOT NULL,
      created_at    INTEGER NOT NULL,
      last_used_at  INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_cli_tokens_user ON cli_tokens(user_open_id);
    CREATE INDEX IF NOT EXISTS idx_cli_tokens_expires ON cli_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS skill_versions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_slug    TEXT NOT NULL,
      version       TEXT NOT NULL,
      zip_path      TEXT NOT NULL,
      readme        TEXT,
      frontmatter   TEXT,
      example       TEXT,
      uploaded_by   TEXT,
      uploaded_at   INTEGER NOT NULL,
      metadata_json TEXT,
      UNIQUE(skill_slug, version)
    );
    CREATE INDEX IF NOT EXISTS idx_skill_versions_slug ON skill_versions(skill_slug);
    CREATE INDEX IF NOT EXISTS idx_skill_versions_uploaded ON skill_versions(uploaded_at DESC);

    CREATE TABLE IF NOT EXISTS skill_access_grants (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_slug     TEXT NOT NULL,
      principal_type TEXT NOT NULL,
      principal      TEXT NOT NULL,
      created_by     TEXT,
      created_at     INTEGER NOT NULL,
      UNIQUE(skill_slug, principal_type, principal)
    );
    CREATE INDEX IF NOT EXISTS idx_skill_access_grants_slug ON skill_access_grants(skill_slug);
    CREATE INDEX IF NOT EXISTS idx_skill_access_grants_principal ON skill_access_grants(principal_type, principal);

    CREATE TABLE IF NOT EXISTS feedback (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_slug   TEXT NOT NULL,
      user_id      TEXT NOT NULL,
      user_handle  TEXT,
      kind         TEXT NOT NULL,
      message      TEXT NOT NULL,
      context      TEXT,
      agent        TEXT,
      version      TEXT,
      cli_version  TEXT,
      source       TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'open',
      created_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_slug ON feedback(skill_slug);
    CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback(user_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);

    CREATE TABLE IF NOT EXISTS user_preferences (
      user_open_id TEXT NOT NULL,
      key          TEXT NOT NULL,
      value        TEXT NOT NULL,
      updated_at   INTEGER NOT NULL,
      PRIMARY KEY (user_open_id, key)
    );
    CREATE INDEX IF NOT EXISTS idx_user_preferences_user ON user_preferences(user_open_id);
  `)

  ensureSkillsColumns(db)
  seedSkillsIfEmpty(db, { dataDir: DATA_DIR, uploadsDir: UPLOADS_DIR })
  backfillSkillVersions(db)

  _db = db
  return db
}

export function dataDir() {
  return DATA_DIR
}

export function uploadsDir() {
  return UPLOADS_DIR
}

function backfillSkillVersions(db: Database.Database) {
  const rows = db
    .prepare(
      `SELECT slug, author, version, zip_path, readme, frontmatter, example, updated_at
       FROM skills`
    )
    .all() as Array<{
      slug: string
      author: string
      version: string
      zip_path: string
      readme: string | null
      frontmatter: string | null
      example: string | null
      updated_at: number
    }>

  if (rows.length === 0) return

  const insert = db.prepare(
    `INSERT OR IGNORE INTO skill_versions
      (skill_slug, version, zip_path, readme, frontmatter, example, uploaded_by, uploaded_at, metadata_json)
     VALUES
      (@skill_slug, @version, @zip_path, @readme, @frontmatter, @example, @uploaded_by, @uploaded_at, @metadata_json)`
  )

  const tx = db.transaction(() => {
    for (const row of rows) {
      insert.run({
        skill_slug: row.slug,
        version: row.version,
        zip_path: row.zip_path,
        readme: row.readme,
        frontmatter: row.frontmatter,
        example: row.example,
        uploaded_by: row.author,
        uploaded_at: row.updated_at,
        metadata_json: JSON.stringify({ backfilled_from: 'skills' }),
      })
    }
  })
  tx()
}

function ensureSkillsColumns(db: Database.Database) {
  addColumnIfMissing(db, 'skills', 'status', "TEXT NOT NULL DEFAULT 'active'")
  addColumnIfMissing(db, 'skills', 'archived_at', 'INTEGER')
  addColumnIfMissing(db, 'skills', 'owner_handle', 'TEXT')
  addColumnIfMissing(db, 'skills', 'source', "TEXT NOT NULL DEFAULT 'user'")
  addColumnIfMissing(db, 'skills', 'install_access', "TEXT NOT NULL DEFAULT 'company'")
  addColumnIfMissing(db, 'skills', 'visibility', "TEXT NOT NULL DEFAULT 'listed'")

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
    CREATE INDEX IF NOT EXISTS idx_skills_owner ON skills(owner_handle);
    CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source);
    CREATE INDEX IF NOT EXISTS idx_skills_install_access ON skills(install_access);
    CREATE INDEX IF NOT EXISTS idx_skills_visibility ON skills(visibility);
  `)

  db.prepare(
    `UPDATE skills
     SET install_access = 'company'
     WHERE install_access IS NULL
        OR install_access = ''
        OR install_access NOT IN ('anonymous', 'company', 'restricted')`
  ).run()

  db.prepare(
    `UPDATE skills
     SET visibility = 'listed'
     WHERE visibility IS NULL
        OR visibility = ''
        OR visibility NOT IN ('listed', 'unlisted', 'restricted', 'match_install_access')`
  ).run()

  db.prepare(
    `UPDATE skills
     SET install_access = 'anonymous', visibility = 'listed'
     WHERE slug = '@community/marketplace-guide'`
  ).run()

  db.prepare(
    `UPDATE skills
     SET source = CASE
       WHEN author = 'community' THEN 'official'
       WHEN author IN (${EXTERNAL_AUTHOR_SQL}) THEN 'external'
       ELSE 'user'
     END
     WHERE source IS NULL OR source = '' OR source = 'user'`
  ).run()

  db.prepare(
    `UPDATE skills
     SET owner_handle = CASE
       WHEN author = 'community' THEN @platform_owner
       WHEN author IN (${EXTERNAL_AUTHOR_SQL}) THEN @platform_owner
       ELSE author
     END
     WHERE owner_handle IS NULL
        OR owner_handle = ''
        OR author = 'community'
        OR author IN (${EXTERNAL_AUTHOR_SQL})`
  ).run({ platform_owner: PLATFORM_OWNER_HANDLE })
}

function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  definition: string,
) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (rows.some((row) => row.name === column)) return
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
}
