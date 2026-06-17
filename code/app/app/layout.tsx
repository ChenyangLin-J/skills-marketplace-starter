import type { Metadata } from 'next'
import './globals.css'
import { DevModeProvider } from '@/components/DevModeContext'
import { DevTools } from '@/components/DevTools'
import { Navbar } from '@/components/Navbar'
import { canAccessDevToolsFromCookies } from '@/lib/auth/dev-tools'
import { getCurrentUserFromCookies } from '@/lib/auth/session'

export const metadata: Metadata = {
  title: 'Skills Marketplace Starter',
  description: 'Self-hosted marketplace for AI agent skills',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const currentUserPromise = getCurrentUserFromCookies()

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <DevModeProvider>
          <Navbar />
          <main>{children}</main>
          <DevToolsGate currentUserPromise={currentUserPromise} />
        </DevModeProvider>
      </body>
    </html>
  )
}

async function DevToolsGate({
  currentUserPromise,
}: {
  currentUserPromise: ReturnType<typeof getCurrentUserFromCookies>
}) {
  const currentUser = await currentUserPromise
  if (!(await canAccessDevToolsFromCookies(currentUser))) return null
  return <DevTools />
}
