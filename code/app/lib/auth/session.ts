import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserByOpenId, type MarketplaceUser } from '@/lib/users'

export const SESSION_COOKIE = 'agent_skills_session'
export const OAUTH_STATE_COOKIE = 'agent_skills_oauth_state'
export const ANONYMOUS_USER_ID = 'anonymous'

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60
const OAUTH_STATE_TTL_SECONDS = 10 * 60

type StatePayload = {
  nonce: string
  next: string
}

function secret(): string {
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('missing_session_secret')
  }
  return process.env.SESSION_SECRET || 'agent-skills-local-dev-session-secret'
}

export function hashAuthToken(token: string): string {
  return crypto.createHmac('sha256', secret()).update(token).digest('hex')
}

export function randomAuthToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

function cookieSecure(req?: NextRequest): boolean {
  if (req?.nextUrl.protocol === 'https:') return true
  return process.env.NODE_ENV === 'production'
}

export function createSession(userOpenId: string): { token: string; expiresAt: number } {
  const token = randomAuthToken()
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + SESSION_TTL_SECONDS
  getDb()
    .prepare(
      `INSERT INTO sessions (token_hash, user_open_id, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(hashAuthToken(token), userOpenId, expiresAt, now)
  return { token, expiresAt }
}

export function deleteSession(token: string | undefined): void {
  if (!token) return
  getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashAuthToken(token))
}

export function setSessionCookie(
  res: NextResponse,
  token: string,
  expiresAt: number,
  req?: NextRequest,
): void {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
    expires: new Date(expiresAt * 1000),
  })
}

export function clearSessionCookie(res: NextResponse, req?: NextRequest): void {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
    maxAge: 0,
  })
}

export function createOAuthState(nextPath: string): { state: string; cookieValue: string } {
  const state = randomAuthToken(24)
  const payload: StatePayload = {
    nonce: state,
    next: sanitizeNextPath(nextPath),
  }
  return {
    state,
    cookieValue: Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url'),
  }
}

export function setOAuthStateCookie(
  res: NextResponse,
  value: string,
  req?: NextRequest,
): void {
  res.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
    maxAge: OAUTH_STATE_TTL_SECONDS,
  })
}

export function readOAuthStateCookie(value: string | undefined): StatePayload | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof parsed?.nonce !== 'string') return null
    return {
      nonce: parsed.nonce,
      next: sanitizeNextPath(parsed.next),
    }
  } catch {
    return null
  }
}

export function clearOAuthStateCookie(res: NextResponse, req?: NextRequest): void {
  res.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
    maxAge: 0,
  })
}

export function sanitizeNextPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  if (!value.startsWith('/')) return '/'
  if (value.startsWith('//')) return '/'
  return normalizeSkillNextPath(value).slice(0, 300) || '/'
}

function normalizeSkillNextPath(path: string): string {
  const prefix = '/skills/'
  if (!path.startsWith(prefix)) return path

  const suffix = path.slice(prefix.length)
  const hashIndex = suffix.indexOf('#')
  const beforeHash = hashIndex >= 0 ? suffix.slice(0, hashIndex) : suffix
  const hash = hashIndex >= 0 ? suffix.slice(hashIndex) : ''
  const queryIndex = beforeHash.indexOf('?')
  const slug = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex) : ''

  if (!slug.includes('/')) return path
  return `${prefix}${encodeURIComponent(slug)}${query}${hash}`
}

function userFromSessionToken(token: string | undefined): MarketplaceUser | null {
  if (!token) return null
  const now = Math.floor(Date.now() / 1000)
  const row = getDb()
    .prepare(
      `SELECT user_open_id FROM sessions
       WHERE token_hash = ? AND expires_at > ?`,
    )
    .get(hashAuthToken(token), now) as { user_open_id: string } | undefined
  return row ? getUserByOpenId(row.user_open_id) : null
}

export function getCurrentUserFromRequest(req: NextRequest): MarketplaceUser | null {
  return userFromSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
}

export async function getCurrentUserFromCookies(): Promise<MarketplaceUser | null> {
  const store = await cookies()
  return userFromSessionToken(store.get(SESSION_COOKIE)?.value)
}

export function userIdOrAnonymous(user: MarketplaceUser | null): string {
  return user?.open_id || ANONYMOUS_USER_ID
}
