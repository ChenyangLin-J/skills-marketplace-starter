'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CATEGORIES,
  type Category,
  type InstallAccess,
  type Skill,
  type SkillVisibility,
} from '@/lib/types'
import { emojiInputError } from '@/lib/emoji'
import { skillDisplayDescription, skillDisplayName } from '@/lib/skill-display'
import {
  INSTALL_ACCESS_OPTIONS,
  VISIBILITY_OPTIONS,
  installAccessLabel,
  type AccessOption,
  visibilityLabel,
} from '@/lib/access-labels'
import { SkillPackagePicker } from '@/components/SkillPackagePicker'
import {
  AccessGrantEditor,
  AccessGrantList,
  type AccessUserSummary,
} from '@/components/SkillAccessControls'
import {
  CategorySelect,
  EmojiInput,
  ExampleTextarea,
  FormField,
  TagInput,
} from '@/components/SkillMetadataFields'

type Props = {
  skill: Pick<
    Skill,
    | 'slug'
    | 'name'
    | 'author'
    | 'version'
    | 'description'
    | 'category'
    | 'tags'
    | 'example'
    | 'frontmatter'
    | 'status'
    | 'install_access'
    | 'visibility'
  >
}

function categoryLabel(category: Category): string {
  const item = CATEGORIES.find((c) => c.value === category)
  return item ? `${item.emoji} ${item.label}` : category
}

function suggestPatchVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/)
  if (!match) return `${version}.1`
  const patch = Number(match[3]) + 1
  return `${match[1]}.${match[2]}.${patch}${match[4] || ''}`
}

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

function sameHandles(a: string[], b: string[]): boolean {
  const left = [...a].sort().join('\u0000')
  const right = [...b].sort().join('\u0000')
  return left === right
}

function frontmatterText(fm: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = fm[key]
    if (typeof value === 'string') return value.trim()
  }
  return ''
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

export function SkillManagePanel({ skill }: Props) {
  const router = useRouter()
  const fm = skill.frontmatter as Record<string, unknown> & { icon?: string; emoji?: string }
  const initialIcon = fm.icon || fm.emoji || ''
  const initialDisplayName = frontmatterText(fm, ['display_name', 'displayName', 'title_zh', 'name_zh'])
  const initialDisplayDescription = frontmatterText(fm, [
    'display_description',
    'displayDescription',
    'summary_zh',
    'short_description_zh',
  ])

  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [displayDescription, setDisplayDescription] = useState(initialDisplayDescription)
  const [description, setDescription] = useState(skill.description)
  const [category, setCategory] = useState<Category | ''>(skill.category)
  const [tags, setTags] = useState(skill.tags)
  const [example, setExample] = useState(skill.example || '')
  const [icon, setIcon] = useState(initialIcon)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [versionFormOpen, setVersionFormOpen] = useState(false)
  const [versionFile, setVersionFile] = useState<File | null>(null)
  const [versionInput, setVersionInput] = useState(suggestPatchVersion(skill.version))
  const [versionPending, setVersionPending] = useState(false)
  const [versionMessage, setVersionMessage] = useState<string | null>(null)
  const [versionError, setVersionError] = useState<string | null>(null)
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)
  const [accessEditing, setAccessEditing] = useState(false)
  const [accessInstall, setAccessInstall] = useState<InstallAccess>(skill.install_access)
  const [accessVisibility, setAccessVisibility] = useState<SkillVisibility>(skill.visibility)
  const [grantHandles, setGrantHandles] = useState<string[]>([])
  const [grantDraftHandles, setGrantDraftHandles] = useState<string[]>([])
  const [accessUsers, setAccessUsers] = useState<AccessUserSummary[]>([])
  const [grantInput, setGrantInput] = useState('')
  const [accessPending, setAccessPending] = useState(false)
  const [accessMessage, setAccessMessage] = useState<string | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [accessLoaded, setAccessLoaded] = useState(false)

  const iconError = emojiInputError(icon)
  const isDirty =
    displayName !== initialDisplayName ||
    displayDescription !== initialDisplayDescription ||
    description !== skill.description ||
    category !== skill.category ||
    tags.join('\u0000') !== skill.tags.join('\u0000') ||
    example !== (skill.example || '') ||
    icon !== initialIcon
  const accessDirty =
    accessInstall !== skill.install_access ||
    accessVisibility !== skill.visibility ||
    !sameHandles(grantDraftHandles, grantHandles)
  const grantsMatter =
    accessInstall === 'restricted' ||
    accessVisibility === 'restricted'

  useEffect(() => {
    let cancelled = false
    async function loadAccess() {
      setAccessLoaded(false)
      try {
        const res = await fetch(`/api/skills/${encodeURIComponent(skill.slug)}/access`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setAccessError(data.message || data.error || '读取权限失败')
          return
        }
        const handles = Array.isArray(data.grants)
          ? data.grants.map((grant: { principal?: string }) => String(grant.principal || '')).filter(Boolean)
          : []
        setAccessInstall(data.install_access || skill.install_access)
        setAccessVisibility(data.visibility || skill.visibility)
        setGrantHandles(handles)
        setGrantDraftHandles(handles)
        setAccessUsers(
          Array.isArray(data.users)
            ? data.users
                .map((user: { handle?: string; name?: string; avatar_url?: string }) => ({
                  handle: normalizeGrantHandle(user.handle || ''),
                  name: String(user.name || user.handle || '').trim(),
                  avatar_url: user.avatar_url,
                }))
                .filter((user: AccessUserSummary) => user.handle)
            : [],
        )
        setAccessLoaded(true)
      } catch {
        if (!cancelled) setAccessError('读取权限失败')
      }
    }
    void loadAccess()
    return () => {
      cancelled = true
    }
  }, [skill.install_access, skill.slug, skill.visibility])

  function resetDraft() {
    setDisplayName(initialDisplayName)
    setDisplayDescription(initialDisplayDescription)
    setDescription(skill.description)
    setCategory(skill.category)
    setTags(skill.tags)
    setExample(skill.example || '')
    setIcon(initialIcon)
    setError(null)
    setMessage(null)
  }

  function resetAccessDraft() {
    setAccessInstall(skill.install_access)
    setAccessVisibility(skill.visibility)
    setGrantDraftHandles(grantHandles)
    setGrantInput('')
    setAccessError(null)
    setAccessMessage(null)
  }

  function commitGrant(raw: string) {
    const handle = normalizeGrantHandle(raw)
    if (!handle) {
      setGrantInput('')
      return
    }
    if (!grantDraftHandles.includes(handle)) {
      setGrantDraftHandles([...grantDraftHandles, handle])
    }
    setGrantInput('')
  }

  async function saveAccess() {
    setAccessPending(true)
    setAccessMessage(null)
    setAccessError(null)
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.slug)}/access`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          install_access: accessInstall,
          visibility: accessVisibility,
          grants: grantDraftHandles,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAccessError(data.message || data.error || '保存权限失败')
        return
      }
      const handles = Array.isArray(data.grants)
        ? data.grants.map((grant: { principal?: string }) => String(grant.principal || '')).filter(Boolean)
        : grantDraftHandles
      setGrantHandles(handles)
      setGrantDraftHandles(handles)
      setAccessMessage('权限已保存')
      setAccessEditing(false)
      router.refresh()
    } finally {
      setAccessPending(false)
    }
  }

  async function save() {
    if (!category) {
      setError('请选择分类')
      return
    }
    if (iconError) {
      setError(iconError)
      return
    }

    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.slug)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          display_description: displayDescription,
          description,
          category,
          tags,
          example,
          icon,
          emoji: '',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || '保存失败')
        return
      }
      setMessage('已保存')
      setEditing(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  async function archiveOrRestore() {
    const archived = skill.status === 'archived'
    setPending(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch(
        archived
          ? `/api/skills/${encodeURIComponent(skill.slug)}/restore`
          : `/api/skills/${encodeURIComponent(skill.slug)}`,
        { method: archived ? 'POST' : 'DELETE' },
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || (archived ? '恢复失败' : '下架失败'))
        return
      }
      setMessage(archived ? '已恢复' : '已下架')
      setConfirmArchiveOpen(false)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  async function publishNewVersion(e: React.FormEvent) {
    e.preventDefault()
    if (!versionFile) {
      setVersionError('请选择 zip 文件')
      return
    }
    const nextVersion = versionInput.trim()
    if (!nextVersion) {
      setVersionError('请填写新版本号')
      return
    }

    setVersionPending(true)
    setVersionMessage(null)
    setVersionError(null)
    try {
      const fd = new FormData()
      fd.append('file', versionFile)
      fd.append('version', nextVersion)
      const res = await fetch(`/api/skills/${encodeURIComponent(skill.slug)}/versions`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'version_conflict' && data.details?.suggested_version) {
          setVersionInput(String(data.details.suggested_version))
        }
        setVersionError(data.message || data.error || '发布新版本失败')
        return
      }
      setVersionMessage(`已发布 v${data.version}`)
      setVersionFile(null)
      setVersionFormOpen(false)
      setVersionInput(suggestPatchVersion(data.version || nextVersion))
      router.refresh()
    } finally {
      setVersionPending(false)
    }
  }

  return (
    <div className="skill-manage-panel">
      <div className="skill-manage-header">
        <div>
          <h3>管理</h3>
          <p>先确认当前展示信息，需要修改时再进入编辑。</p>
        </div>
        <div className="skill-manage-header-actions">
          <span className={`skill-status ${skill.status}`}>
            {skill.status === 'archived' ? '已下架' : '上架中'}
          </span>
          {!editing && (
            <button type="button" className="skill-manage-edit" onClick={() => setEditing(true)}>
              编辑
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="skill-manage-edit-form">
          <div className="skill-manage-locked">
            <div>
              <span>名称</span>
              <strong>{skill.name}</strong>
            </div>
            <div>
              <span>Slug</span>
              <strong>{skill.slug}</strong>
            </div>
            <div>
              <span>版本</span>
              <strong>v{skill.version}</strong>
            </div>
          </div>

          <FormField label="卡片标题" help="首页卡片展示给普通用户看的名字；不修改 Skill ID">
            <input
              className="metadata-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={skillDisplayName(skill)}
              maxLength={40}
            />
          </FormField>

          <FormField label="卡片短描述" help="首页卡片优先展示；留空时使用下方触发描述">
            <textarea
              className="metadata-input metadata-textarea"
              value={displayDescription}
              onChange={(e) => setDisplayDescription(e.target.value)}
              placeholder={skillDisplayDescription(skill)}
              maxLength={120}
            />
          </FormField>

          <FormField label="触发描述" help="Agent 判断什么时候使用这个 Skill 的描述" required>
            <textarea
              className="metadata-input metadata-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          <div className="skill-manage-meta-grid">
            <FormField label="分类" required>
              <CategorySelect value={category} onChange={setCategory} />
            </FormField>
            <FormField label="图标" help="可选，只能输入一个 emoji">
              <EmojiInput value={icon} onChange={setIcon} />
            </FormField>
            <FormField label="标签" help="最多 5 个，回车 / 空格 / 逗号添加">
              <TagInput tags={tags} onChange={setTags} />
            </FormField>
          </div>

          <FormField label="使用示例" help="可选。真实使用场景，让人一眼看懂能干什么">
            <ExampleTextarea value={example} onChange={setExample} />
          </FormField>

          {(message || error) && (
            <div className={error ? 'skill-manage-error' : 'skill-manage-message'}>
              {error || message}
            </div>
          )}

          <div className="skill-manage-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => {
                resetDraft()
                setEditing(false)
              }}
              disabled={pending}
            >
              取消
            </button>
            <button type="button" onClick={save} disabled={pending || !isDirty || !!iconError}>
              {pending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <div className="skill-manage-summary">
          <div className="skill-manage-summary-row">
            <span>卡片标题</span>
            <strong>{skillDisplayName(skill)}</strong>
          </div>
          <div className="skill-manage-summary-row wide">
            <span>卡片短描述</span>
            <p>{skillDisplayDescription(skill)}</p>
          </div>
          <div className="skill-manage-summary-row wide">
            <span>触发描述</span>
            <p>{skill.description}</p>
          </div>
          <div className="skill-manage-summary-row">
            <span>分类</span>
            <strong>{categoryLabel(skill.category)}</strong>
          </div>
          <div className="skill-manage-summary-row">
            <span>图标</span>
            <strong>{initialIcon || '未设置'}</strong>
          </div>
          <div className="skill-manage-summary-row wide">
            <span>标签</span>
            <div className="skill-manage-tag-list">
              {skill.tags.length > 0 ? skill.tags.map((tag) => <em key={tag}>#{tag}</em>) : '未设置'}
            </div>
          </div>
          <div className="skill-manage-summary-row wide">
            <span>使用示例</span>
            <p>{skill.example || '未设置'}</p>
          </div>
        </div>
      )}

      <div className="skill-manage-access">
        <div className="skill-manage-section-heading">
          <div>
            <h4>权限</h4>
            <p>控制谁能看到这个 Skill，以及谁能下载和安装。</p>
          </div>
          {!accessEditing && (
            <button
              type="button"
              className="skill-manage-edit"
              onClick={() => {
                setAccessEditing(true)
                setAccessMessage(null)
                setAccessError(null)
              }}
            >
              编辑权限
            </button>
          )}
        </div>

        {accessEditing ? (
          <div className="skill-access-form">
            <FormField label="安装权限">
              <AccessOptionGroup
                value={accessInstall}
                options={INSTALL_ACCESS_OPTIONS}
                onChange={setAccessInstall}
              />
            </FormField>
            <FormField label="可见性">
              <AccessOptionGroup
                value={accessVisibility}
                options={VISIBILITY_OPTIONS}
                onChange={setAccessVisibility}
              />
            </FormField>
            {grantsMatter && (
              <FormField label="指定人员" help="输入 handle 后按回车 / 空格 / 逗号添加">
                <div className="skill-access-grant-panel">
                  <AccessGrantEditor
                    handles={grantDraftHandles}
                    users={accessUsers}
                    inputValue={grantInput}
                    onInputChange={setGrantInput}
                    onCommitInput={() => {
                      if (grantInput.trim()) commitGrant(grantInput)
                    }}
                    onRemove={(handle) =>
                      setGrantDraftHandles(grantDraftHandles.filter((item) => item !== handle))
                    }
                    onAdd={(handle) => {
                      if (!grantDraftHandles.includes(handle)) {
                        setGrantDraftHandles([...grantDraftHandles, handle])
                      }
                    }}
                    placeholder="输入 handle 或搜索人员，例如 demo"
                  />
                </div>
              </FormField>
            )}
            {(accessMessage || accessError) && (
              <div className={accessError ? 'skill-manage-error' : 'skill-manage-message'}>
                {accessError || accessMessage}
              </div>
            )}
            <div className="skill-manage-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  resetAccessDraft()
                  setAccessEditing(false)
                }}
                disabled={accessPending}
              >
                取消
              </button>
              <button type="button" onClick={saveAccess} disabled={accessPending || !accessDirty}>
                {accessPending ? '保存中...' : '保存权限'}
              </button>
            </div>
          </div>
        ) : (
          <div className="skill-access-summary">
            <div>
              <span>安装权限</span>
              <strong>{installAccessLabel(accessInstall)}</strong>
            </div>
            <div>
              <span>可见性</span>
              <strong>{visibilityLabel(accessVisibility)}</strong>
            </div>
            {grantsMatter && (
              <div className="wide">
                <span>指定人员</span>
                {!accessLoaded ? <p>读取中...</p> : <AccessGrantList handles={grantHandles} />}
              </div>
            )}
            {(accessMessage || accessError) && (
              <div className={accessError ? 'skill-manage-error wide' : 'skill-manage-message wide'}>
                {accessError || accessMessage}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="skill-manage-lifecycle">
        <div>
          <h4>版本与上下架</h4>
          <p>
            {skill.status === 'archived'
              ? '发布新版本会更新默认安装版本；恢复后会重新进入列表和搜索。'
              : '发布新版本会更新默认安装版本；下架后列表和搜索默认不展示。'}
          </p>
        </div>
        <div className="skill-manage-lifecycle-actions">
          <button
            type="button"
            className="version"
            onClick={() => {
              setVersionFormOpen(true)
              setVersionMessage(null)
              setVersionError(null)
            }}
            disabled={pending || versionPending || versionFormOpen}
          >
            发布新版本
          </button>
          <button
            type="button"
            className={skill.status === 'archived' ? 'restore' : 'archive'}
            onClick={() => {
              if (skill.status === 'archived') void archiveOrRestore()
              else setConfirmArchiveOpen(true)
            }}
            disabled={pending || versionPending}
          >
            {skill.status === 'archived' ? '恢复上架' : '下架'}
          </button>
        </div>

        {(versionMessage || (versionError && !versionFormOpen)) && (
          <div className={versionError ? 'skill-manage-error' : 'skill-manage-message'}>
            {versionError || versionMessage}
          </div>
        )}

        {versionFormOpen && (
          <form className="skill-version-publish-form" onSubmit={publishNewVersion}>
            <FormField label="新版本包" help="上传同名 Skill 的 zip 包；name 必须保持不变" required>
              <SkillPackagePicker
                value={versionFile}
                onChange={setVersionFile}
                onError={setVersionError}
                disabled={versionPending}
              />
            </FormField>
            <FormField label="新版本号" required>
              <input
                className="metadata-input"
                value={versionInput}
                onChange={(event) => setVersionInput(event.target.value)}
                placeholder={suggestPatchVersion(skill.version)}
              />
            </FormField>
            {(versionMessage || versionError) && (
              <div className={versionError ? 'skill-manage-error' : 'skill-manage-message'}>
                {versionError || versionMessage}
              </div>
            )}
            <div className="skill-version-publish-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setVersionFormOpen(false)
                  setVersionFile(null)
                  setVersionError(null)
                  setVersionMessage(null)
                }}
                disabled={versionPending}
              >
                取消
              </button>
              <button type="submit" disabled={versionPending || !versionFile || !versionInput.trim()}>
                {versionPending ? '发布中...' : '确认发布'}
              </button>
            </div>
          </form>
        )}
      </div>

      {confirmArchiveOpen && (
        <div className="install-modal-backdrop" onClick={() => setConfirmArchiveOpen(false)}>
          <div className="install-modal skill-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="skill-confirm-icon">下架</div>
            <h3>确认下架这个 Skill？</h3>
            <p>
              下架后首页和搜索默认不展示，安装和下载会被拒绝；你仍然可以从已下架入口回到详情页恢复。
            </p>
            <div className="skill-confirm-actions">
              <button type="button" className="secondary" onClick={() => setConfirmArchiveOpen(false)}>
                取消
              </button>
              <button
                type="button"
                className="archive"
                onClick={() => void archiveOrRestore()}
                disabled={pending}
              >
                {pending ? '下架中...' : '确认下架'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
