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
          setFeedbackError(data.message || data.error || '读取反馈失败')
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
      setError('请先登录后再提交反馈')
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
        setError(data.message || data.error || '提交失败')
        return
      }
      setResult(`已提交反馈 #${data.id}`)
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
          <h3>反馈</h3>
          <p>问题、建议、提问、使用卡住的地方或真实使用情况都可以写。</p>
        </div>
        {!isLoggedIn && (
          <a href={`/api/auth/dev-login?next=${encodeURIComponent(`/skills/${slug}`)}`}>
            Demo login
          </a>
        )}
      </div>

      <div className="skill-feedback-body">
        <label className="skill-feedback-field">
          <span>反馈内容</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="直接写给作者：哪里不好用、希望怎么改、或者你实际怎么用了这个 Skill。"
            required
          />
        </label>

        <label className="skill-feedback-field optional">
          <span>补充上下文（可选）</span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="粘贴错误日志、调用片段或你愿意提供的上下文。"
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
          {pending ? '提交中...' : '提交反馈'}
        </button>
      </div>

      {canManage && (
        <div className="skill-feedback-owner">
          <div className="skill-feedback-owner-header">
            <div>
              <h4>收到的反馈</h4>
              <p>Web 和 CLI 提交的反馈都会显示在这里。</p>
            </div>
            <span>{feedbackItems.length} 条</span>
          </div>
          {feedbackLoading ? (
            <div className="skill-feedback-empty">正在读取反馈...</div>
          ) : feedbackError ? (
            <div className="skill-feedback-error inline">{feedbackError}</div>
          ) : feedbackItems.length === 0 ? (
            <div className="skill-feedback-empty">还没有收到反馈。</div>
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
  return new Date(seconds * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
