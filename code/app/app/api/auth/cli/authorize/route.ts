import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api'
import { approveCliLoginRequest } from '@/lib/auth/cli'
import { getCurrentUserFromRequest } from '@/lib/auth/session'
import { publicOrigin } from '@/lib/origin'

export const runtime = 'nodejs'

function html(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #faf7ef; color: #2b2620; }
      main { max-width: 420px; padding: 32px; background: #fffdf8; border: 1px solid #eadfce; border-radius: 8px; box-shadow: 0 18px 50px rgba(73, 54, 27, .12); }
      h1 { margin: 0 0 12px; font-size: 20px; }
      p { margin: 0; line-height: 1.7; color: #665f55; }
    </style>
  </head>
  <body><main><h1>${title}</h1><p>${body}</p></main></body>
</html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get('state') || ''
  if (!state) return apiError(400, 'validation_failed', 'Missing state')

  const currentUser = getCurrentUserFromRequest(req)
  if (!currentUser) {
    const nextPath = `/api/auth/cli/authorize?state=${encodeURIComponent(state)}`
    const loginUrl = new URL('/api/auth/dev-login', publicOrigin(req))
    loginUrl.searchParams.set('next', nextPath)
    return Response.redirect(loginUrl, 302)
  }

  const result = approveCliLoginRequest(state, currentUser.open_id)
  if (result === 'ok') {
    return html('CLI login successful', 'You can return to the terminal and continue using agent-skills.')
  }

  return html(
    'CLI login failed',
    'This login request expired or was already used. Return to the terminal and run agent-skills login again.',
    400,
  )
}
