'use client'

import { useMemo, useState } from 'react'

export type AccessUserSummary = {
  handle: string
  name: string
  avatar_url?: string
}

export function AccessGrantList({
  handles,
  editable = false,
  onRemove,
}: {
  handles: string[]
  editable?: boolean
  onRemove?: (handle: string) => void
}) {
  if (handles.length === 0) {
    return <p className="skill-access-grant-empty">No selected users yet.</p>
  }

  return (
    <ul className="skill-access-grant-list" aria-label="Selected users">
      {handles.map((handle) => (
        <li key={handle}>
          <span>@{handle}</span>
          {editable && onRemove && (
            <button type="button" onClick={() => onRemove(handle)} aria-label={`Remove ${handle}`}>
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

function filteredUsers(
  users: AccessUserSummary[],
  selectedHandles: string[],
  query: string,
): AccessUserSummary[] {
  const normalizedQuery = query.trim().replace(/^@/, '').toLowerCase()
  return users
    .filter((user) => !selectedHandles.includes(user.handle))
    .filter((user) => {
      if (!normalizedQuery) return true
      return (
        user.handle.toLowerCase().includes(normalizedQuery) ||
        user.name.toLowerCase().includes(normalizedQuery)
      )
    })
    .slice(0, 6)
}

export function AccessGrantEditor({
  handles,
  users,
  inputValue,
  placeholder = 'Enter a handle or search users',
  onInputChange,
  onCommitInput,
  onAdd,
  onRemove,
}: {
  handles: string[]
  users: AccessUserSummary[]
  inputValue: string
  placeholder?: string
  onInputChange: (value: string) => void
  onCommitInput: () => void
  onAdd: (handle: string) => void
  onRemove: (handle: string) => void
}) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const suggestions = useMemo(
    () => filteredUsers(users, handles, inputValue),
    [handles, inputValue, users],
  )

  return (
    <div className="skill-access-grant-editor">
      <AccessGrantList handles={handles} editable onRemove={onRemove} />
      <div className="skill-access-grant-box">
        <input
          value={inputValue}
          onChange={(event) => {
            onInputChange(event.target.value)
            setSuggestionsOpen(true)
          }}
          onFocus={() => setSuggestionsOpen(true)}
          onClick={() => setSuggestionsOpen(true)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' ||
              event.key === ',' ||
              event.key === '，' ||
              event.key === ' '
            ) {
              event.preventDefault()
              onCommitInput()
              setSuggestionsOpen(true)
            } else if (event.key === 'Backspace' && inputValue === '' && handles.length > 0) {
              onRemove(handles[handles.length - 1])
            } else if (event.key === 'Escape') {
              setSuggestionsOpen(false)
            }
          }}
          onBlur={() => {
            onCommitInput()
            setSuggestionsOpen(false)
          }}
          placeholder={placeholder}
          aria-label="Add selected user"
        />
        {suggestionsOpen && (
          <div className="skill-access-suggestions" role="listbox" aria-label="User suggestions">
            {suggestions.length > 0 ? (
              suggestions.map((user) => (
                <button
                  key={user.handle}
                  type="button"
                  className="skill-access-suggestion"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onAdd(user.handle)
                    onInputChange('')
                    setSuggestionsOpen(false)
                  }}
                >
                  <span className="skill-access-user-main">
                    <strong>{user.name || user.handle}</strong>
                    <em>@{user.handle}</em>
                  </span>
                  <small>Add</small>
                </button>
              ))
            ) : (
              <div className="skill-access-suggestion-empty">No matching users. You can enter a handle directly.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
