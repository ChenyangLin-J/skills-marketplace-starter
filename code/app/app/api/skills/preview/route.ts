import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/cli'
import { isValidName, parseSkillZipDraft, SkillParseError } from '@/lib/parse-skill'

export const runtime = 'nodejs'

function cleanName(raw: string): string {
  return raw
    .trim()
    .replace(/\.zip$/i, '')
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function displayNameFromName(name: string): string {
  return name
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function compactDescription(description: string): string {
  const firstLine = description
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || ''
  return firstLine.length > 110 ? `${firstLine.slice(0, 107)}...` : firstLine
}

function frontmatterText(fm: Record<string, unknown>, key: string): string {
  const value = fm[key]
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(req: NextRequest) {
  const currentUser = getAuthenticatedUserFromRequest(req)
  if (!currentUser) return apiError(401, 'unauthorized', 'Log in before previewing a Skill.')

  const ct = req.headers.get('content-type') || ''
  if (!ct.includes('multipart/form-data')) {
    return apiError(400, 'validation_failed', 'multipart/form-data is required')
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!file || !(file instanceof File)) {
    return apiError(400, 'validation_failed', 'Missing file')
  }

  let draft
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    draft = await parseSkillZipDraft(buf)
  } catch (e) {
    if (e instanceof SkillParseError) {
      return apiError(400, e.code, e.message, e.details)
    }
    return apiError(500, 'server_error', String(e))
  }

  const displayName = frontmatterText(draft.frontmatter, 'display_name')
  const displayDescription = frontmatterText(draft.frontmatter, 'display_description')
  const suggestedName = draft.name || cleanName(file.name)
  const suggestedDisplayName = displayName || displayNameFromName(suggestedName)
  const suggestedDisplayDescription =
    displayDescription || compactDescription(draft.description)
  const errors: Record<string, string> = {}
  if (draft.name && !isValidName(draft.name)) {
    errors.name = 'name must match [a-z0-9-] and be 1-50 characters'
  }

  return NextResponse.json({
    metadata: {
      name: draft.name,
      description: draft.description,
      version: draft.version,
      display_name: displayName,
      display_description: displayDescription,
    },
    suggestions: {
      name: suggestedName,
      display_name: suggestedDisplayName,
      display_description: suggestedDisplayDescription,
    },
    missing: {
      name: !draft.name,
      description: !draft.description,
      display_name: !displayName,
      display_description: !displayDescription,
    },
    errors,
  })
}
