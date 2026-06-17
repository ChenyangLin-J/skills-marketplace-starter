import { getDb } from './db'
import { pinyin } from 'pinyin-pro'

export type MarketplaceUser = {
  open_id: string
  union_id?: string
  user_id?: string
  tenant_key?: string
  handle: string
  name: string
  avatar_url?: string
  email?: string
  created_at: number
  updated_at: number
}

export type MarketplaceUserSummary = {
  handle: string
  name: string
  avatar_url?: string
}

export type UserUpsertInput = {
  open_id: string
  union_id?: string
  user_id?: string
  tenant_key?: string
  handleSeed?: string
  name?: string
  en_name?: string
  avatar_url?: string
  email?: string
}

type UserRow = {
  open_id: string
  union_id: string | null
  user_id: string | null
  tenant_key: string | null
  handle: string
  name: string
  avatar_url: string | null
  email: string | null
  created_at: number
  updated_at: number
}

const DEFAULT_HANDLE = 'user'
const HIDDEN_ASSIGNABLE_HANDLES = new Set(['community'])

function toUser(row: UserRow): MarketplaceUser {
  return {
    open_id: row.open_id,
    union_id: row.union_id || undefined,
    user_id: row.user_id || undefined,
    tenant_key: row.tenant_key || undefined,
    handle: row.handle,
    name: row.name,
    avatar_url: row.avatar_url || undefined,
    email: row.email || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function cleanHandle(raw: string | undefined): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function normalizeHandle(raw: string | undefined): string {
  return cleanHandle(raw) || cleanHandle(process.env.AGENT_SKILLS_DEFAULT_HANDLE) || DEFAULT_HANDLE
}

export function nameToPinyinHandle(name: string | undefined): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return ''
  try {
    const converted = pinyin(trimmed, {
      toneType: 'none',
      type: 'array',
      nonZh: 'consecutive',
    })
    const value = Array.isArray(converted) ? converted.join('') : String(converted)
    return cleanHandle(value)
  } catch {
    return ''
  }
}

function handleCandidate(input: UserUpsertInput): string {
  const candidates = [
    input.handleSeed,
    input.email,
    input.en_name,
    nameToPinyinHandle(input.name),
    input.user_id,
    input.open_id,
    DEFAULT_HANDLE,
  ]
  for (const candidate of candidates) {
    const handle = cleanHandle(candidate)
    if (handle) return handle
  }
  return DEFAULT_HANDLE
}

function uniqueHandle(seed: string, openId: string): string {
  const db = getDb()
  const existing = db
    .prepare('SELECT open_id FROM users WHERE handle = ?')
    .get(seed) as { open_id: string } | undefined
  if (!existing || existing.open_id === openId) return seed

  const suffix = openId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toLowerCase()
  return normalizeHandle(`${seed}-${suffix || Date.now().toString(36)}`)
}

export function getUserByOpenId(openId: string): MarketplaceUser | null {
  const row = getDb()
    .prepare('SELECT * FROM users WHERE open_id = ?')
    .get(openId) as UserRow | undefined
  return row ? toUser(row) : null
}

export function getUserByHandle(handle: string): MarketplaceUser | null {
  const normalized = normalizeHandle(handle)
  const row = getDb()
    .prepare('SELECT * FROM users WHERE handle = ?')
    .get(normalized) as UserRow | undefined
  return row ? toUser(row) : null
}

export function listMarketplaceUsers(limit = 100): MarketplaceUserSummary[] {
  const safeLimit = Math.max(1, Math.min(200, Math.floor(limit)))
  const rows = getDb()
    .prepare(
      `SELECT handle, name, avatar_url
       FROM users
       ORDER BY updated_at DESC, name ASC
       LIMIT ?`,
    )
    .all(safeLimit) as Array<{ handle: string; name: string; avatar_url: string | null }>

  return rows
    .filter((row) => !HIDDEN_ASSIGNABLE_HANDLES.has(row.handle) && !row.handle.startsWith('dev-'))
    .map((row) => ({
      handle: row.handle,
      name: row.name,
      avatar_url: row.avatar_url || undefined,
    }))
}

export function upsertUser(input: UserUpsertInput): MarketplaceUser {
  if (!input.open_id) {
    throw new Error('missing open_id')
  }

  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const existing = getUserByOpenId(input.open_id)
  const handle = existing?.handle || uniqueHandle(handleCandidate(input), input.open_id)
  const name = (input.name || input.en_name || handle).trim()

  if (existing) {
    db.prepare(
      `UPDATE users SET
         union_id=@union_id, user_id=@user_id, tenant_key=@tenant_key,
         name=@name, avatar_url=@avatar_url, email=@email, updated_at=@updated_at
       WHERE open_id=@open_id`,
    ).run({
      open_id: input.open_id,
      union_id: input.union_id || null,
      user_id: input.user_id || null,
      tenant_key: input.tenant_key || null,
      name,
      avatar_url: input.avatar_url || null,
      email: input.email || null,
      updated_at: now,
    })
  } else {
    db.prepare(
      `INSERT INTO users
        (open_id, union_id, user_id, tenant_key, handle, name, avatar_url, email, created_at, updated_at)
       VALUES
        (@open_id, @union_id, @user_id, @tenant_key, @handle, @name, @avatar_url, @email, @created_at, @updated_at)`,
    ).run({
      open_id: input.open_id,
      union_id: input.union_id || null,
      user_id: input.user_id || null,
      tenant_key: input.tenant_key || null,
      handle,
      name,
      avatar_url: input.avatar_url || null,
      email: input.email || null,
      created_at: now,
      updated_at: now,
    })
  }

  const user = getUserByOpenId(input.open_id)
  if (!user) throw new Error('failed to upsert user')
  return user
}
