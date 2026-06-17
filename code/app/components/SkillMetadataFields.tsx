'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { CATEGORIES, type Category } from '@/lib/types'
import { emojiInputError } from '@/lib/emoji'

export const MAX_TAGS = 5

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#/, '')
}

export function mergePendingTag(tags: string[], raw: string, maxTags = MAX_TAGS): string[] {
  const tag = normalizeTag(raw)
  if (!tag || tags.includes(tag) || tags.length >= maxTags) return tags
  return [...tags, tag]
}

export function FormField({
  label,
  help,
  required,
  children,
  className,
}: {
  label: string
  help?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`metadata-field${className ? ` ${className}` : ''}`}>
      <label className="metadata-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {help && <div className="metadata-help">{help}</div>}
    </div>
  )
}

export function CategorySelect({
  value,
  onChange,
  disabled = false,
  placeholder = '请选择...',
}: {
  value: Category | ''
  onChange: (value: Category | '') => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <select
      className="metadata-input"
      value={value}
      onChange={(e) => onChange(e.target.value as Category | '')}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {CATEGORIES.map((item) => (
        <option key={item.value} value={item.value}>
          {item.emoji} {item.label}
        </option>
      ))}
    </select>
  )
}

export function TagInput({
  tags,
  onChange,
  disabled = false,
  maxTags = MAX_TAGS,
  pendingValue,
  onPendingValueChange,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  disabled?: boolean
  maxTags?: number
  pendingValue?: string
  onPendingValueChange?: (value: string) => void
}) {
  const [innerInput, setInnerInput] = useState('')
  const input = pendingValue ?? innerInput
  const setInput = onPendingValueChange ?? setInnerInput

  function commit(raw: string) {
    const nextTags = mergePendingTag(tags, raw, maxTags)
    if (nextTags !== tags) onChange(nextTags)
  }

  function remove(tag: string) {
    onChange(tags.filter((item) => item !== tag))
  }

  return (
    <div className={`tag-input-box${disabled ? ' disabled' : ''}`}>
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          #{tag}
          {!disabled && (
            <button
              type="button"
              className="tag-chip-x"
              onClick={() => remove(tag)}
              aria-label={`删除标签 ${tag}`}
            >
              x
            </button>
          )}
        </span>
      ))}
      {!disabled && tags.length < maxTags && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === '，' || e.key === ' ') {
              e.preventDefault()
              commit(input)
              setInput('')
            } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
              onChange(tags.slice(0, -1))
            }
          }}
          onBlur={() => {
            if (input.trim()) {
              commit(input)
              setInput('')
            }
          }}
          placeholder={tags.length === 0 ? '例: sql / bq / 数据' : ''}
          className="tag-input"
        />
      )}
    </div>
  )
}

export function ExampleTextarea({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <textarea
      className="metadata-input metadata-textarea metadata-mono"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={'例:\nSkills 市场有什么？\n会优先使用 marketplace-guide 查看当前 Skills Marketplace...'}
    />
  )
}

export function EmojiInput({
  value,
  onChange,
  disabled = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const error = emojiInputError(value)
  return (
    <>
      <input
        className={`metadata-input${error ? ' invalid' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={12}
        placeholder="可选，例如 🧭"
      />
      {error && <div className="metadata-error-text">{error}</div>}
    </>
  )
}
