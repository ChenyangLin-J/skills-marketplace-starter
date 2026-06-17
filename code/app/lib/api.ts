import { NextResponse } from 'next/server'
import { notifyApiError } from './alerts'

export function apiError(
  status: number,
  error: string,
  message: string,
  details?: Record<string, unknown>
) {
  const body: Record<string, unknown> = { error, message }
  if (details) body.details = details
  notifyApiError({
    status,
    error,
    message,
    details,
    stack: new Error().stack,
  })
  return NextResponse.json(body, { status })
}

export function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
