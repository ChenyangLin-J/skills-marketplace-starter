'use client'

import { useEffect, useState } from 'react'
import type { SkillFeedback } from '@/lib/types'

export function SkillFeedbackPanel({
  slug,
  version,
  isLoggedIn,
  canManage,
}: {
  slug: string
  version: string
  isLoggedIn: boolean
  canManage: boolean
}) {
  const [message, setMessage] = useState('')
  const [context, setContext] = useState('')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedbackItems, setFeedbackItems] = useState<SkillFeedback[]>([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoggedIn || !canManage) return
    let cancelled = false
    async function loadFeedback() {
      setFeedbackLoading(true)
      setFeedbackError(null)
      try {
        const res = await fetch(`/api/skills/${encodeURIComponent(slug)}/feedback`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setFeedbackError(data.message || data.error || 'Failed to load feedback.')
          return
        }
        setFeedbackItems(data.items || [])
      } catch (err) {
        if (!cancelled) setFeedbackError(String(err))
      } finally {
        if (!cancelled) setFeedbackLoading(false)
      }
    }
    void loadFeedback()
    return () => {
      cancelled = true
    }
  }, [canManage, isLoggedIn, slug])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoggedIn) {
      setError('Sign in before submitting feedback.')
      return
    }
    setPending(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(slug)}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'suggestion',
          message,
          context,
          version,
          source: 'web',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || 'Failed to submit feedback.')
        return
      }
      setResult(`Feedback submitted #${data.id}`)
      if (canManage) {
        setFeedbackItems((items) => [data as SkillFeedback, ...items])
      }
      setMessage('')
      setContext('')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="skill-feedback-panel" onSubmit={submit}>
      <div className="skill-feedback-header">
        <div>
          <h3>Feedback</h3>
          <p>Report issues, suggestions, questions, blocked usage, or real usage notes.</p>
        </div>
        {!isLoggedIn && (
          <a href={`/api/auth/dev-login?next=${encodeURIComponent(`/skills/${slug}`)}`}>
            Demo login
          </a>
        )}
      </div>

      <div className="skill-feedback-body">
        <label className="skill-feedback-field">
          <span>Feedback</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write to the creator: what failed, what should improve, or how you actually used this Skill."
            required
          />
        </label>

        <label className="skill-feedback-field optional">
          <span>Additional context (optional)</span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste an error log, command snippet, or any context you are comfortable sharing."
          />
        </label>
      </div>

      {(result || error) && (
        <div className={error ? 'skill-feedback-error' : 'skill-feedback-message'}>
          {error || result}
        </div>
      )}

      <div className="skill-feedback-actions">
        <button type="submit" disabled={pending || !isLoggedIn}>
          {pending ? 'Submitting...' : 'Submit feedback'}
        </button>
      </div>

      {canManage && (
        <div className="skill-feedback-owner">
          <div className="skill-feedback-owner-header">
            <div>
              <h4>Received feedback</h4>
              <p>Feedback submitted from Web and CLI appears here.</p>
            </div>
            <span>{feedbackItems.length} items</span>
          </div>
          {feedbackLoading ? (
            <div className="skill-feedback-empty">Loading feedback...</div>
          ) : feedbackError ? (
            <div className="skill-feedback-error inline">{feedbackError}</div>
          ) : feedbackItems.length === 0 ? (
            <div className="skill-feedback-empty">No feedback yet.</div>
          ) : (
            <div className="skill-feedback-list">
              {feedbackItems.map((item) => (
                <article key={item.id} className="skill-feedback-item">
                  <div className="skill-feedback-item-meta">
                    <strong>{item.user_handle ? `@${item.user_handle}` : item.user_id}</strong>
                    <span>{item.source === 'cli' ? 'CLI' : 'Web'}</span>
                    {item.version && <span>v{item.version}</span>}
                    <span>{formatFeedbackTime(item.created_at)}</span>
                  </div>
                  <p>{item.message}</p>
                  {item.context && <pre>{item.context}</pre>}
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  )
}

function formatFeedbackTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
