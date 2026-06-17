import type { Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const error = normalizeError(err)
  const { sendAlert } = await import('./lib/alerts')
  await sendAlert({
    type: 'request_error',
    title: '[Skills Marketplace] Unhandled request error',
    message: error.message,
    details: {
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      routerKind: context.routerKind,
      digest: error.digest,
    },
    stack: error.stack,
    dedupeKey: [
      'request_error',
      request.method,
      request.path,
      context.routePath,
      error.message,
      error.digest,
    ].join('|'),
  })
}

function normalizeError(err: unknown): { message: string; stack?: string; digest?: string } {
  if (err instanceof Error) {
    return {
      message: err.message || String(err),
      stack: err.stack,
      digest: 'digest' in err && typeof err.digest === 'string' ? err.digest : undefined,
    }
  }
  return { message: String(err) }
}
