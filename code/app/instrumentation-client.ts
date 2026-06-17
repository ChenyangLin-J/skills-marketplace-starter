type ClientErrorPayload = {
  type: 'client_error' | 'client_unhandled_rejection'
  message: string
  stack?: string
  source?: string
  lineno?: number
  colno?: number
  href: string
  userAgent: string
}

window.addEventListener('error', (event) => {
  reportClientError({
    type: 'client_error',
    message: event.message || 'Client error',
    stack: event.error instanceof Error ? event.error.stack : undefined,
    source: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    href: window.location.href,
    userAgent: window.navigator.userAgent,
  })
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  reportClientError({
    type: 'client_unhandled_rejection',
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    href: window.location.href,
    userAgent: window.navigator.userAgent,
  })
})

function reportClientError(payload: ClientErrorPayload) {
  try {
    const body = JSON.stringify(payload)
    if (window.navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      window.navigator.sendBeacon('/api/alerts/client', blob)
      return
    }
    void fetch('/api/alerts/client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    })
  } catch {
    // Reporting must never break the page.
  }
}
