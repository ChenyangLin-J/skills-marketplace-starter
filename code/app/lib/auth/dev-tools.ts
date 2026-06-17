import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest, hashAuthToken } from '@/lib/auth/session'
import type { MarketplaceUser } from '@/lib/users'

export const DEV_TOOLS_ADMIN_HANDLE = 'demo'
export const DEV_TOOLS_COOKIE = 'agent_skills_devtools_access'

const DEV_TOOLS_TTL_SECONDS = 24 * 60 * 60

function cookieSecure(req?: NextRequest): boolean {
  if (req?.nextUrl.protocol === 'https:') return true
  return process.env.NODE_ENV === 'production'
}

function sign(handle: string, expiresAt: number): string {
  return hashAuthToken(`devtools:${handle}:${expiresAt}`)
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

export function canUseDevTools(user: MarketplaceUser | null): boolean {
  return user?.handle === DEV_TOOLS_ADMIN_HANDLE
}

export function createDevToolsAccessToken(): { token: string; expiresAt: number } {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = now + DEV_TOOLS_TTL_SECONDS
  const signature = sign(DEV_TOOLS_ADMIN_HANDLE, expiresAt)
  return {
    token: `${DEV_TOOLS_ADMIN_HANDLE}.${expiresAt}.${signature}`,
    expiresAt,
  }
}

export function verifyDevToolsAccessToken(value: string | undefined): boolean {
  if (!value) return false
  const [handle, expiresAtRaw, signature, ...rest] = value.split('.')
  if (rest.length > 0) return false
  if (handle !== DEV_TOOLS_ADMIN_HANDLE) return false
  const expiresAt = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAt)) return false
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false
  return timingSafeEqual(signature || '', sign(handle, expiresAt))
}

export function setDevToolsAccessCookie(res: NextResponse, req?: NextRequest): void {
  const { token, expiresAt } = createDevToolsAccessToken()
  res.cookies.set({
    name: DEV_TOOLS_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(req),
    path: '/',
    expires: new Date(expiresAt * 1000),
  })
}

export function canAccessDevToolsFromRequest(req: NextRequest): boolean {
  const currentUser = getCurrentUserFromRequest(req)
  if (canUseDevTools(currentUser)) return true
  return verifyDevToolsAccessToken(req.cookies.get(DEV_TOOLS_COOKIE)?.value)
}

export async function canAccessDevToolsFromCookies(
  currentUser: MarketplaceUser | null,
): Promise<boolean> {
  if (canUseDevTools(currentUser)) return true
  const store = await cookies()
  return verifyDevToolsAccessToken(store.get(DEV_TOOLS_COOKIE)?.value)
}
