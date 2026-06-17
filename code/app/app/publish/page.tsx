'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type Category, type InstallAccess, type SkillVisibility } from '@/lib/types'
import { type AccessOption } from '@/lib/access-labels'
import { useDevMode } from '@/components/DevModeContext'
import {
  AccessGrantEditor,
  type AccessUserSummary,
} from '@/components/SkillAccessControls'
import { SkillPackagePicker } from '@/components/SkillPackagePicker'
import {
  CategorySelect,
  ExampleTextarea,
  FormField,
  MAX_TAGS,
  TagInput,
  mergePendingTag,
} from '@/components/SkillMetadataFields'

type SourceKey = 'upload' | 'gitlab' | 'paste'

type OverwriteInfo = {
  slug: string
  previousVersion: string
  nextVersion: string
}

type VersionConflictInfo = {
  slug: string
  currentVersion: string
  suggestedVersion: string
}

type PreviewState = {
  loading: boolean
  error: string | null
  missing: Record<string, boolean>
  errors: Record<string, string>
  version: string
}

type PublishAudience = 'company' | 'restricted' | 'anonymous' | 'unlisted'

const SKILL_NAME_RE = /^[a-z0-9-]{1,50}$/

const PUBLISH_AUDIENCE_OPTIONS: Array<AccessOption<PublishAudience>> = [
  { value: 'company', label: 'Signed-in users', detail: 'Default. Visible and installable after login.' },
  { value: 'restricted', label: 'Selected users', detail: 'Only you and selected users can view and install it.' },
  { value: 'anonymous', label: 'Public install', detail: 'Anyone can install without logging in.' },
  { value: 'unlisted', label: 'Unlisted link', detail: 'Hidden from lists. People with the link can use it after login.' },
]

function normalizeGrantHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@/, '')
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function appendGrant(handles: string[], raw: string): string[] {
  const handle = normalizeGrantHandle(raw)
  if (!handle || handles.includes(handle)) return handles
  return [...handles, handle]
}

function publishAudience(
  installAccess: InstallAccess,
  visibility: SkillVisibility,
): PublishAudience {
  if (installAccess === 'restricted' && visibility === 'restricted') return 'restricted'
  if (installAccess === 'anonymous' && visibility === 'listed') return 'anonymous'
  if (installAccess === 'company' && visibility === 'unlisted') return 'unlisted'
  return 'company'
}

function AccessOptionGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<AccessOption<T>>
  onChange: (value: T) => void
}) {
  return (
    <div className="skill-access-options">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`skill-access-option${value === option.value ? ' selected' : ''}`}
          onClick={() => onChange(option.value)}
        >
          <strong>{option.label}</strong>
          <span>{option.detail}</span>
        </button>
      ))}
    </div>
  )
}

export default function PublishPage() {
  const router = useRouter()
  const { showPlaceholders, hydrated } = useDevMode()
  const showDevSources = hydrated && showPlaceholders
  const [source, setSource] = useState<SourceKey>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<Category | ''>('business')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [example, setExample] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [overwrite, setOverwrite] = useState<OverwriteInfo | null>(null)
  const [versionConflict, setVersionConflict] = useState<VersionConflictInfo | null>(null)
  const [versionInput, setVersionInput] = useState('')
  const [installAccess, setInstallAccess] = useState<InstallAccess>('company')
  const [visibility, setVisibility] = useState<SkillVisibility>('listed')
  const [grantHandles, setGrantHandles] = useState<string[]>([])
  const [grantInput, setGrantInput] = useState('')
  const [accessUsers, setAccessUsers] = useState<AccessUserSummary[]>([])
  const [skillName, setSkillName] = useState('')
  const [skillDescription, setSkillDescription] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [displayDescription, setDisplayDescription] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({
    loading: false,
    error: null,
    missing: {},
    errors: {},
    version: '',
  })
  const audience = publishAudience(installAccess, visibility)
  const grantsMatter = audience === 'restricted'

  function setAudience(next: PublishAudience) {
    if (next === 'restricted') {
      setInstallAccess('restricted')
      setVisibility('restricted')
      return
    }
    if (next === 'anonymous') {
      setInstallAccess('anonymous')
      setVisibility('listed')
      return
    }
    if (next === 'unlisted') {
      setInstallAccess('company')
      setVisibility('unlisted')
      return
    }
    setInstallAccess('company')
    setVisibility('listed')
  }

  useEffect(() => {
    let cancelled = false
    async function loadUsers() {
      try {
        const res = await fetch('/api/users')
        const data = await res.json()
        if (cancelled || !res.ok) return
        const users = Array.isArray(data.items)
          ? data.items
              .map((user: { handle?: string; name?: string }) => ({
                handle: normalizeGrantHandle(user.handle || ''),
                name: String(user.name || user.handle || '').trim(),
              }))
              .filter((user: AccessUserSummary) => user.handle)
          : []
        setAccessUsers(users)
      } catch {
        if (!cancelled) setAccessUsers([])
      }
    }
    void loadUsers()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function previewPackage() {
      if (!file) {
        setSkillName('')
        setSkillDescription('')
        setDisplayName('')
        setDisplayDescription('')
        setPreview({ loading: false, error: null, missing: {}, errors: {}, version: '' })
        return
      }

      setPreview({ loading: true, error: null, missing: {}, errors: {}, version: '' })
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/skills/preview', { method: 'POST', body: fd })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          const detailMsg = data.details
            ? Object.entries(data.details)
                .map(([k, v]) => `${k}: ${v}`)
                .join('; ')
            : ''
          setPreview({
            loading: false,
            error: [data.message || data.error, detailMsg].filter(Boolean).join(' · '),
            missing: {},
            errors: {},
            version: '',
          })
          return
        }

        setSkillName(String(data.metadata?.name || data.suggestions?.name || ''))
        setSkillDescription(String(data.metadata?.description || ''))
        setDisplayName(String(data.metadata?.display_name || data.suggestions?.display_name || ''))
        setDisplayDescription(
          String(data.metadata?.display_description || data.suggestions?.display_description || ''),
        )
        setPreview({
          loading: false,
          error: null,
          missing: data.missing || {},
          errors: data.errors || {},
          version: String(data.metadata?.version || ''),
        })
      } catch (err) {
        if (!cancelled) {
          setPreview({
            loading: false,
            error: String(err),
            missing: {},
            errors: {},
            version: '',
          })
        }
      }
    }
    void previewPackage()
    return () => {
      cancelled = true
    }
  }, [file])

  async function submitPublish(versionOverride?: string) {
    setError(null)

    if (source !== 'upload') {
      setError('This source is planned for v1.5. Please use Upload file for now.')
      return
    }
    if (!file) {
      setError('Choose a zip file.')
      return
    }
    if (preview.loading) {
      setError('Reading SKILL.md. Please wait.')
      return
    }
    if (preview.error) {
      setError(preview.error)
      return
    }
    if (!skillName.trim()) {
      setError('Add the SKILL.md name.')
      return
    }
    if (!SKILL_NAME_RE.test(skillName.trim())) {
      setError('name must use lowercase letters, numbers, and hyphens, 1-50 characters.')
      return
    }
    const finalDescription = displayDescription.trim() || skillDescription.trim()
    if (!finalDescription) {
      setError('Describe what this Skill does.')
      return
    }
    if (!category) {
      setError('Choose a category.')
      return
    }

    const finalTags = mergePendingTag(tags, tagInput, MAX_TAGS)
    const finalGrants = grantsMatter ? appendGrant(grantHandles, grantInput) : []

    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', skillName.trim())
    fd.append('description', finalDescription)
    if (displayName.trim()) fd.append('display_name', displayName.trim())
    fd.append('display_description', finalDescription)
    fd.append('category', category)
    if (finalTags.length > 0) fd.append('tags', finalTags.join(','))
    if (example.trim()) fd.append('example', example.trim())
    if (versionOverride?.trim()) fd.append('version', versionOverride.trim())
    fd.append('install_access', installAccess)
    fd.append('visibility', visibility)
    fd.append('grants', finalGrants.join(','))

    setPending(true)
    try {
      const res = await fetch('/api/skills', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'version_conflict') {
          const details = data.details || {}
          const suggested = String(details.suggested_version || '')
          setVersionInput(suggested)
          setVersionConflict({
            slug: String(details.slug || ''),
            currentVersion: String(details.current_version || ''),
            suggestedVersion: suggested,
          })
          return
        }
        const detailMsg = data.details
          ? Object.entries(data.details)
              .map(([k, v]) => `${k}: ${v}`)
              .join(';')
          : ''
        setError([data.message || data.error, detailMsg].filter(Boolean).join(' · '))
        return
      }
      if (data.is_overwrite) {
        setVersionConflict(null)
        setOverwrite({
          slug: data.slug,
          previousVersion: data.previous_version || '?',
          nextVersion: data.version || '?',
        })
        setPending(false)
        return
      }
      router.push(`/skills/${encodeURIComponent(data.slug)}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setPending(false)
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitPublish()
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 32 }}>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          marginBottom: 16,
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}
      >
        ← Back home
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Publish a Skill</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Share reusable agent context with your workspace. The whole flow takes about five minutes.
      </p>

      <form
        onSubmit={onSubmit}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 32,
        }}
      >
        {/* Source selection: tabs are only visible in dev mode while upload is the active source. */}
        <FormField label="Source">
          {showDevSources && (
            <div className="source-tabs">
              <button
                type="button"
                className={`source-tab${source === 'upload' ? ' active' : ''}`}
                onClick={() => setSource('upload')}
              >
                Upload file
              </button>
              <button
                type="button"
                className={`source-tab${source === 'gitlab' ? ' active' : ''}`}
                onClick={() => setSource('gitlab')}
              >
                Git URL
              </button>
              <button
                type="button"
                className={`source-tab${source === 'paste' ? ' active' : ''}`}
                onClick={() => setSource('paste')}
              >
                Paste content
              </button>
            </div>
          )}

          {source === 'upload' && (
            <SkillPackagePicker value={file} onChange={setFile} onError={setError} />
          )}

          {source === 'gitlab' && (
            <div>
              <input
                type="text"
                placeholder="https://github.com/your-org/your-skill"
                disabled
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-soft)',
                  fontSize: 14,
                  color: 'var(--text-muted)',
                }}
              />
              <div
                style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}
              >
                Pull SKILL.md and assets from a repository, with optional push sync ·{' '}
                <strong>planned for v1.5</strong>
              </div>
            </div>
          )}

          {source === 'paste' && (
            <div>
              <textarea
                placeholder={'---\nname: my-skill\ndescription: ...\n---\n\n# My Skill\n...'}
                disabled
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-soft)',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  minHeight: 120,
                  resize: 'vertical',
                  color: 'var(--text-muted)',
                }}
              />
              <div
                style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}
              >
                Paste a complete SKILL.md directly · <strong>planned for v1.5</strong>
              </div>
            </div>
          )}
        </FormField>

        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid var(--border)' }} />

        {file && (
          <div className="publish-metadata-panel publish-core-panel">
            <div className="publish-metadata-head">
              <div>
                <h3>Confirm publish details</h3>
                <p>
                  The package was read automatically. Confirm the information people will use to understand it.
                </p>
              </div>
              {preview.version && <span>v{preview.version}</span>}
            </div>

            {preview.loading ? (
              <div className="publish-metadata-note">Reading SKILL.md...</div>
            ) : preview.error ? (
              <div className="publish-metadata-error">{preview.error}</div>
            ) : (
              <>
                <FormField
                  label="Display name"
                  help="A clear human-readable name for the marketplace card."
                  required
                >
                  <input
                    className="metadata-input"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Data dictionary and SQL guide"
                    maxLength={40}
                  />
                </FormField>

                <FormField
                  label="What does this Skill do?"
                  help={
                    preview.missing.description
                      ? 'Explain the use case in plain language.'
                      : 'Explain the use case and when to use it in plain language.'
                  }
                  required
                >
                  <textarea
                    className="metadata-input metadata-textarea"
                    value={displayDescription}
                    onChange={(event) => {
                      setDisplayDescription(event.target.value)
                      setSkillDescription(event.target.value)
                    }}
                    placeholder="Helps analysts write structured reports with conclusions, evidence, and follow-up actions."
                  />
                </FormField>

                <FormField label="Who can use it?" help="Controls who can view and install it. You can change this later.">
                  <AccessOptionGroup
                    value={audience}
                    options={PUBLISH_AUDIENCE_OPTIONS}
                    onChange={setAudience}
                  />
                </FormField>

                {grantsMatter && (
                  <FormField label="Allowed users" help="Enter handles, then press Enter, Space, or comma to add them.">
                    <div className="skill-access-grant-panel">
                      <AccessGrantEditor
                        handles={grantHandles}
                        users={accessUsers}
                        inputValue={grantInput}
                        onInputChange={setGrantInput}
                        onCommitInput={() => {
                          if (!grantInput.trim()) return
                          setGrantHandles(appendGrant(grantHandles, grantInput))
                          setGrantInput('')
                        }}
                        onRemove={(handle) =>
                          setGrantHandles(grantHandles.filter((item) => item !== handle))
                        }
                        onAdd={(handle) => setGrantHandles(appendGrant(grantHandles, handle))}
                        placeholder="Enter a handle or search users, for example demo"
                      />
                    </div>
                  </FormField>
                )}

                <div className="publish-advanced">
                  <button
                    type="button"
                    className="publish-advanced-toggle"
                    onClick={() => setAdvancedOpen((open) => !open)}
                    aria-expanded={advancedOpen}
                  >
                    <span>{advancedOpen ? 'Hide display details' : 'More display details'}</span>
                    <em>{advancedOpen ? '↑' : '↓'}</em>
                  </button>

                  {advancedOpen && (
                    <div className="publish-advanced-body">
                      <div className="publish-metadata-grid">
                        <FormField label="Category" help="Defaults to business knowledge. You can adjust it later.">
                          <CategorySelect value={category} onChange={setCategory} />
                        </FormField>

                        <FormField label="Tags" help={`Up to ${MAX_TAGS}. Press Enter, Space, or comma to add.`}>
                          <TagInput
                            tags={tags}
                            onChange={setTags}
                            pendingValue={tagInput}
                            onPendingValueChange={setTagInput}
                          />
                        </FormField>
                      </div>

                      <FormField
                        label="Usage example"
                        help="Optional. A concrete scenario that makes the Skill easy to understand."
                      >
                        <ExampleTextarea value={example} onChange={setExample} />
                      </FormField>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: 12,
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
            marginTop: 24,
          }}
        >
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{
              padding: '10px 20px',
              border: '1px solid transparent',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || source !== 'upload'}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: 6,
              background:
                pending || source !== 'upload'
                  ? 'var(--bg-soft)'
                  : 'var(--accent)',
              color:
                pending || source !== 'upload' ? 'var(--text-muted)' : 'white',
              fontSize: 14,
              fontWeight: 500,
              cursor: source !== 'upload' ? 'not-allowed' : pending ? 'wait' : 'pointer',
            }}
          >
            {pending ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </form>

      {overwrite && (
        <div className="install-modal-backdrop" onClick={() => setOverwrite(null)}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>✅ New version published</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
              <code>{overwrite.slug}</code> was updated to the current marketplace version.
            </p>
            <div
              style={{
                background: 'var(--bg-soft)',
                padding: 12,
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 16,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Version:{' '}
              <strong>
                v{overwrite.previousVersion}
                {overwrite.previousVersion !== overwrite.nextVersion
                  ? ` → v${overwrite.nextVersion}`
                  : '(unchanged)'}
              </strong>
              <div style={{ color: 'var(--text-muted)', marginTop: 4, fontFamily: 'inherit' }}>
                Previous zip files are kept on the server by version.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setOverwrite(null)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Stay here
              </button>
              <button
                type="button"
                onClick={() => router.push(`/skills/${encodeURIComponent(overwrite.slug)}`)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                View details →
              </button>
            </div>
          </div>
        </div>
      )}

      {versionConflict && (
        <div className="install-modal-backdrop" onClick={() => setVersionConflict(null)}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>⚠️ Version already exists</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
              <code>{versionConflict.slug}</code> already has v{versionConflict.currentVersion}.
              Enter a new version number to publish.
            </p>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
              New version
            </label>
            <input
              value={versionInput}
              onChange={(e) => setVersionInput(e.target.value)}
              placeholder={versionConflict.suggestedVersion || '0.1.1'}
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg)',
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                marginBottom: 8,
              }}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6, marginBottom: 16 }}>
              The saved zip will use this value in <code>SKILL.md</code>. Update your local source too.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setVersionConflict(null)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !versionInput.trim()}
                onClick={() => void submitPublish(versionInput)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: pending || !versionInput.trim() ? 'var(--bg-soft)' : 'var(--accent)',
                  color: pending || !versionInput.trim() ? 'var(--text-muted)' : 'white',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: pending || !versionInput.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {pending ? 'Publishing...' : 'Publish with new version'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
