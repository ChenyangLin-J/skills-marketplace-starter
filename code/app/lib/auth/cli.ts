import type { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { publicOrigin } from '@/lib/origin'
import { getUserByOpenId, type MarketplaceUser } from '@/lib/users'
import {
  SESSION_TTL_SECONDS,
  getCurrentUserFromRequest,
  hashAuthToken,
  randomAuthToken,
} from './session'

const CLI_LOGIN_TTL_SECONDS = 10 * 60
const CLI_POLL_INTERVAL_SECONDS = 2

type CliLoginRow = {
  state_hash: string
  device_code_hash: string
  user_open_id: string | null
  expires_at: number
  consumed_at: number | null
  created_at: number
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function bearerToken(req: NextRequest): string | null {
  const value = req.headers.get('authorization') || ''
  const match = value.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function cleanupExpiredCliAuth(now = nowSeconds()): void {
  getDb().prepare('DELETE FROM cli_login_requests WHERE expires_at <= ?').run(now)
  getDb().prepare('DELETE FROM cli_tokens WHERE expires_at <= ?').run(now)
}

export function createCliLoginRequest(req: NextRequest): {
  deviceCode: string
  authorizeUrl: string
  expiresAt: number
  intervalSeconds: number
} {
  const now = nowSeconds()
  cleanupExpiredCliAuth(now)

  const state = randomAuthToken(24)
  const deviceCode = randomAuthToken(32)
  const expiresAt = now + CLI_LOGIN_TTL_SECONDS

  getDb()
    .prepare(
      `INSERT INTO cli_login_requests
        (state_hash, device_code_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(hashAuthToken(state), hashAuthToken(deviceCode), expiresAt, now)

  const authorizeUrl = new URL('/api/auth/cli/authorize', publicOrigin(req))
  authorizeUrl.searchParams.set('state', state)

  return {
    deviceCode,
    authorizeUrl: authorizeUrl.toString(),
    expiresAt,
    intervalSeconds: CLI_POLL_INTERVAL_SECONDS,
  }
}

export function approveCliLoginRequest(
  state: string,
  userOpenId: string,
): 'ok' | 'not_found' | 'expired' | 'consumed' {
  const db = getDb()
  const now = nowSeconds()
  const stateHash = hashAuthToken(state)
  const row = db
    .prepare('SELECT * FROM cli_login_requests WHERE state_hash = ?')
    .get(stateHash) as CliLoginRow | undefined

  if (!row) return 'not_found'
  if (row.expires_at <= now) return 'expired'
  if (row.consumed_at) return 'consumed'

  db.prepare(
    `UPDATE cli_login_requests
     SET user_open_id = ?
     WHERE state_hash = ?`,
  ).run(userOpenId, stateHash)
  return 'ok'
}

function createCliToken(userOpenId: string): { token: string; expiresAt: number } {
  const token = randomAuthToken()
  const now = nowSeconds()
  const expiresAt = now + SESSION_TTL_SECONDS
  getDb()
    .prepare(
      `INSERT INTO cli_tokens (token_hash, user_open_id, expires_at, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(hashAuthToken(token), userOpenId, expiresAt, now, now)
  return { token, expiresAt }
}

export function pollCliLoginRequest(deviceCode: string):
  | { status: 'pending'; expiresAt: number }
  | { status: 'ok'; token: string; expiresAt: number; user: MarketplaceUser }
  | { status: 'expired' | 'not_found' | 'consumed' } {
  const db = getDb()
  const now = nowSeconds()
  const row = db
    .prepare('SELECT * FROM cli_login_requests WHERE device_code_hash = ?')
    .get(hashAuthToken(deviceCode)) as CliLoginRow | undefined

  if (!row) return { status: 'not_found' }
  if (row.expires_at <= now) return { status: 'expired' }
  if (row.consumed_at) return { status: 'consumed' }
  if (!row.user_open_id) return { status: 'pending', expiresAt: row.expires_at }

  const user = getUserByOpenId(row.user_open_id)
  if (!user) return { status: 'not_found' }

  db.prepare(
    `UPDATE cli_login_requests
     SET consumed_at = ?
     WHERE device_code_hash = ?`,
  ).run(now, row.device_code_hash)
  const token = createCliToken(user.open_id)
  return { status: 'ok', token: token.token, expiresAt: token.expiresAt, user }
}

export function getCliUserFromRequest(req: NextRequest): MarketplaceUser | null {
  const token = bearerToken(req)
  if (!token) return null

  const now = nowSeconds()
  const row = getDb()
    .prepare(
      `SELECT user_open_id FROM cli_tokens
       WHERE token_hash = ? AND expires_at > ?`,
    )
    .get(hashAuthToken(token), now) as { user_open_id: string } | undefined
  if (!row) return null

  getDb()
    .prepare('UPDATE cli_tokens SET last_used_at = ? WHERE token_hash = ?')
    .run(now, hashAuthToken(token))
  return getUserByOpenId(row.user_open_id)
}

export function getAuthenticatedUserFromRequest(req: NextRequest): MarketplaceUser | null {
  return getCurrentUserFromRequest(req) || getCliUserFromRequest(req)
}

export function deleteCliTokenFromRequest(req: NextRequest): boolean {
  const token = bearerToken(req)
  if (!token) return false
  const result = getDb()
    .prepare('DELETE FROM cli_tokens WHERE token_hash = ?')
    .run(hashAuthToken(token))
  return result.changes > 0
}
