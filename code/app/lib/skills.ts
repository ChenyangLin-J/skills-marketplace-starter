import { getDb } from './db'
import { ANONYMOUS_USER_ID } from './auth/session'
import type {
  InstallAccess,
  Skill,
  SkillAccessGrant,
  SkillFeedback,
  SkillSource,
  SkillStatus,
  SkillVisibility,
  SkillVersion,
  Category,
} from './types'
import { normalizeHandle, type MarketplaceUser } from './users'

type Row = {
  slug: string
  author: string
  author_name: string | null
  owner_handle: string | null
  name: string
  description: string
  category: string
  tags: string | null
  status: string
  archived_at: number | null
  source: string | null
  install_access: string | null
  visibility: string | null
  version: string
  zip_path: string
  readme: string | null
  frontmatter: string | null
  example: string | null
  created_at: number
  updated_at: number
  install_count: number
  weekly_install_count: number
  like_count: number
  liked_by_me: number
}

const BASE_SELECT = `
  SELECT
    s.slug, s.author, u.name AS author_name, s.owner_handle,
    s.name, s.description, s.category, s.tags, s.status, s.archived_at, s.source,
    s.install_access, s.visibility, s.version,
    s.zip_path, s.readme, s.frontmatter, s.example, s.created_at, s.updated_at,
    COALESCE(i.cnt, 0) AS install_count,
    COALESCE(iw.cnt, 0) AS weekly_install_count,
    COALESCE(l.cnt, 0) AS like_count,
    CASE WHEN ml.skill_slug IS NULL THEN 0 ELSE 1 END AS liked_by_me
  FROM skills s
  LEFT JOIN users u
    ON u.handle = s.author
  LEFT JOIN (SELECT skill_slug, COUNT(*) cnt FROM installs GROUP BY skill_slug) i
    ON s.slug = i.skill_slug
  LEFT JOIN (
    SELECT skill_slug, COUNT(*) cnt FROM installs
    WHERE created_at > (CAST(strftime('%s', 'now') AS INTEGER) - 7*86400)
    GROUP BY skill_slug
  ) iw ON s.slug = iw.skill_slug
  LEFT JOIN (SELECT skill_slug, COUNT(*) cnt FROM likes    GROUP BY skill_slug) l
    ON s.slug = l.skill_slug
  LEFT JOIN likes ml
    ON ml.skill_slug = s.slug AND ml.user_id = @user_id
`

function toSkill(row: Row): Skill {
  return {
    slug: row.slug,
    author: row.author,
    author_name: row.author_name || undefined,
    owner_handle: row.owner_handle || row.author,
    name: row.name,
    description: row.description,
    category: row.category as Category,
    tags: row.tags ? JSON.parse(row.tags) : [],
    status: (row.status || 'active') as SkillStatus,
    archived_at: row.archived_at || undefined,
    source: (row.source || 'user') as SkillSource,
    install_access: (row.install_access || 'company') as InstallAccess,
    visibility: (row.visibility || 'listed') as SkillVisibility,
    version: row.version,
    readme: row.readme || '',
    example: row.example || undefined,
    frontmatter: row.frontmatter ? JSON.parse(row.frontmatter) : {},
    install_count: row.install_count,
    weekly_install_count: row.weekly_install_count,
    like_count: row.like_count,
    liked_by_me: row.liked_by_me === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export type ListOpts = {
  q?: string
  /** 默认搜 name/description/tags；fulltext=true 时连 SKILL.md 全文一起搜 */
  fulltext?: boolean
  category?: string
  sort?: string
  limit?: number
  offset?: number
  includeArchived?: boolean
  ownerHandle?: string
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; status: 401 | 403; code: 'unauthorized' | 'forbidden'; message: string }

export const INSTALL_ACCESS_VALUES: InstallAccess[] = ['anonymous', 'company', 'restricted']
export const SKILL_VISIBILITY_VALUES: SkillVisibility[] = [
  'listed',
  'unlisted',
  'restricted',
  'match_install_access',
]

function normalizedViewerHandle(user: Pick<MarketplaceUser, 'handle'> | null | undefined): string {
  return (user?.handle || '').trim()
}

function restrictedAccessSql(viewerHandle: string): string {
  if (!viewerHandle) return '0'
  return `(
    s.author = @viewer_handle
    OR COALESCE(s.owner_handle, s.author) = @viewer_handle
    OR EXISTS (
      SELECT 1
      FROM skill_access_grants sag
      WHERE sag.skill_slug = s.slug
        AND sag.principal_type = 'handle'
        AND sag.principal = @viewer_handle
    )
  )`
}

function visibleListSql(viewerHandle: string): string {
  const canAccessRestricted = restrictedAccessSql(viewerHandle)
  return `(
    COALESCE(s.visibility, 'listed') = 'listed'
    OR (
      COALESCE(s.visibility, 'listed') = 'restricted'
      AND ${canAccessRestricted}
    )
    OR (
      COALESCE(s.visibility, 'listed') = 'match_install_access'
      AND (
        COALESCE(s.install_access, 'company') = 'anonymous'
        OR (
          COALESCE(s.install_access, 'company') = 'company'
          AND @is_logged_in = 1
        )
        OR (
          COALESCE(s.install_access, 'company') = 'restricted'
          AND ${canAccessRestricted}
        )
      )
    )
  )`
}

function hasRestrictedAccess(
  skill: Pick<Skill, 'slug' | 'author' | 'owner_handle'>,
  user: Pick<MarketplaceUser, 'handle'> | null,
): boolean {
  const viewerHandle = normalizedViewerHandle(user)
  if (!viewerHandle) return false
  if (viewerHandle === skill.author) return true
  if (viewerHandle === (skill.owner_handle || skill.author)) return true
  const row = getDb()
    .prepare(
      `SELECT 1 AS ok
       FROM skill_access_grants
       WHERE skill_slug = @skill_slug
         AND principal_type = 'handle'
         AND principal = @principal`
    )
    .get({ skill_slug: skill.slug, principal: viewerHandle }) as { ok: number } | undefined
  return !!row
}

export function canAccessRestrictedSkill(
  skill: Pick<Skill, 'slug' | 'author' | 'owner_handle'>,
  user: Pick<MarketplaceUser, 'handle'> | null,
): boolean {
  return hasRestrictedAccess(skill, user)
}

export function checkSkillInstallAccess(
  skill: Pick<Skill, 'slug' | 'author' | 'owner_handle' | 'install_access'>,
  user: Pick<MarketplaceUser, 'handle'> | null,
): AccessDecision {
  if (skill.install_access === 'anonymous') return { allowed: true }
  if (!user) {
    return {
      allowed: false,
      status: 401,
      code: 'unauthorized',
      message: '请先登录后再下载或安装这个 Skill',
    }
  }
  if (skill.install_access === 'company') return { allowed: true }
  if (hasRestrictedAccess(skill, user)) return { allowed: true }
  return {
    allowed: false,
    status: 403,
    code: 'forbidden',
    message: '你当前账号没有安装这个 Skill 的权限',
  }
}

export function checkSkillVisibility(
  skill: Pick<Skill, 'slug' | 'author' | 'owner_handle' | 'status' | 'install_access' | 'visibility'>,
  user: Pick<MarketplaceUser, 'handle'> | null,
): AccessDecision {
  if (skill.status === 'archived') return { allowed: true }
  if (skill.visibility === 'listed' || skill.visibility === 'unlisted') return { allowed: true }
  if (skill.visibility === 'restricted') {
    if (!user) {
      return {
        allowed: false,
        status: 401,
        code: 'unauthorized',
        message: '请先登录后再查看这个 Skill',
      }
    }
    if (hasRestrictedAccess(skill, user)) return { allowed: true }
    return {
      allowed: false,
      status: 403,
      code: 'forbidden',
      message: '你当前账号没有查看这个 Skill 的权限',
    }
  }
  return checkSkillInstallAccess(skill, user)
}

export type OwnerSkillStats = {
  totalSkills: number
  activeSkills: number
  archivedSkills: number
  installCount: number
  likeCount: number
  openFeedbackCount: number
}

export type OwnerFeedback = SkillFeedback & {
  skill_name: string
  skill_status: SkillStatus
}

export function listSkills(
  opts: ListOpts,
  viewerId: string = ANONYMOUS_USER_ID,
  viewerHandle?: string,
): { items: Skill[]; total: number } {
  const db = getDb()
  const where: string[] = []
  const params: Record<string, unknown> = {
    user_id: viewerId,
    is_logged_in: viewerHandle ? 1 : 0,
  }

  if (opts.includeArchived) {
    if (opts.ownerHandle) {
      where.push('COALESCE(s.owner_handle, s.author) = @owner_handle')
      params.owner_handle = opts.ownerHandle
    }
  } else {
    where.push("COALESCE(s.status, 'active') = 'active'")
    if (viewerHandle) params.viewer_handle = viewerHandle
    where.push(visibleListSql(viewerHandle || ''))
  }

  if (opts.category) {
    where.push('s.category = @category')
    params.category = opts.category
  }
  if (opts.q && opts.q.trim()) {
    if (opts.fulltext) {
      // 全文：name / description / tags(json string) / readme 都搜
      where.push(
        "(s.name LIKE @q OR s.description LIKE @q OR COALESCE(s.tags,'') LIKE @q OR COALESCE(s.readme,'') LIKE @q)"
      )
    } else {
      // 默认：只搜 name / description / tags
      where.push(
        "(s.name LIKE @q OR s.description LIKE @q OR COALESCE(s.tags,'') LIKE @q)"
      )
    }
    params.q = `%${opts.q.trim()}%`
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  let orderBy = 'install_count DESC, s.updated_at DESC'
  switch (opts.sort) {
    case 'weekly':
      orderBy = 'weekly_install_count DESC, install_count DESC, s.updated_at DESC'
      break
    case 'likes':
      orderBy = 'like_count DESC, s.updated_at DESC'
      break
    case 'updated':
      orderBy = 's.updated_at DESC'
      break
    case 'created':
      orderBy = 's.created_at DESC'
      break
  }

  const limit = Math.max(1, Math.min(opts.limit ?? 50, 100))
  const offset = Math.max(0, opts.offset ?? 0)

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM skills s ${whereSql}`)
    .get(params) as { c: number }

  const rows = db
    .prepare(
      `${BASE_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset }) as Row[]

  return { items: rows.map(toSkill), total: totalRow.c }
}

export function getOwnerSkillStats(ownerHandle: string): OwnerSkillStats {
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total_skills,
         SUM(CASE WHEN COALESCE(s.status, 'active') = 'active' THEN 1 ELSE 0 END) AS active_skills,
         SUM(CASE WHEN COALESCE(s.status, 'active') = 'archived' THEN 1 ELSE 0 END) AS archived_skills,
         COALESCE(SUM((SELECT COUNT(*) FROM installs i WHERE i.skill_slug = s.slug)), 0) AS install_count,
         COALESCE(SUM((SELECT COUNT(*) FROM likes l WHERE l.skill_slug = s.slug)), 0) AS like_count,
         COALESCE((
           SELECT COUNT(*)
           FROM feedback f
           JOIN skills fs ON fs.slug = f.skill_slug
           WHERE COALESCE(fs.owner_handle, fs.author) = @owner_handle
             AND COALESCE(f.status, 'open') = 'open'
         ), 0) AS open_feedback_count
       FROM skills s
       WHERE COALESCE(s.owner_handle, s.author) = @owner_handle`
    )
    .get({ owner_handle: ownerHandle }) as {
      total_skills: number | null
      active_skills: number | null
      archived_skills: number | null
      install_count: number | null
      like_count: number | null
      open_feedback_count: number | null
    }

  return {
    totalSkills: row.total_skills ?? 0,
    activeSkills: row.active_skills ?? 0,
    archivedSkills: row.archived_skills ?? 0,
    installCount: row.install_count ?? 0,
    likeCount: row.like_count ?? 0,
    openFeedbackCount: row.open_feedback_count ?? 0,
  }
}

export function getMarketplaceStats(): { skillCount: number; installCount: number } {
  const db = getDb()
  const skillRow = db
    .prepare("SELECT COUNT(*) AS c FROM skills WHERE COALESCE(status, 'active') = 'active'")
    .get() as { c: number }
  const installRow = db.prepare('SELECT COUNT(*) AS c FROM installs').get() as { c: number }
  return {
    skillCount: skillRow.c,
    installCount: installRow.c,
  }
}

export function getSkillBySlug(
  slug: string,
  viewerId: string = ANONYMOUS_USER_ID,
): Skill | null {
  const db = getDb()
  const row = db
    .prepare(`${BASE_SELECT} WHERE s.slug = @slug`)
    .get({ slug, user_id: viewerId }) as Row | undefined
  return row ? toSkill(row) : null
}

export function canManageSkill(
  skill: Pick<Skill, 'author' | 'owner_handle'>,
  user: { handle: string } | null,
): boolean {
  if (!user) return false
  return user.handle === skill.author || user.handle === (skill.owner_handle || skill.author)
}

export function normalizeAccessHandle(raw: string): string {
  return normalizeHandle(raw.replace(/^@/, ''))
}

export function listSkillAccessGrants(slug: string): SkillAccessGrant[] {
  const rows = getDb()
    .prepare(
      `SELECT id, skill_slug, principal_type, principal, created_by, created_at
       FROM skill_access_grants
       WHERE skill_slug = @skill_slug
         AND principal_type = 'handle'
       ORDER BY principal ASC`
    )
    .all({ skill_slug: slug }) as Array<{
      id: number
      skill_slug: string
      principal_type: 'handle'
      principal: string
      created_by: string | null
      created_at: number
    }>

  return rows.map((row) => ({
    id: row.id,
    skill_slug: row.skill_slug,
    principal_type: row.principal_type,
    principal: row.principal,
    created_by: row.created_by || undefined,
    created_at: row.created_at,
  }))
}

export function updateSkillAccess(
  slug: string,
  input: {
    install_access?: InstallAccess
    visibility?: SkillVisibility
  },
): Skill | null {
  const current = getSkillBySlug(slug)
  if (!current) return null

  const installAccess = input.install_access || current.install_access
  const visibility = input.visibility || current.visibility
  getDb()
    .prepare(
      `UPDATE skills
       SET install_access = @install_access,
           visibility = @visibility,
           updated_at = @updated_at
       WHERE slug = @slug`
    )
    .run({
      slug,
      install_access: installAccess,
      visibility,
      updated_at: Math.floor(Date.now() / 1000),
    })
  return getSkillBySlug(slug)
}

export function replaceSkillAccessGrants(
  slug: string,
  handles: string[],
  createdBy?: string,
): SkillAccessGrant[] {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const normalizedHandles = [
    ...new Set(handles.map((handle) => normalizeAccessHandle(handle)).filter(Boolean)),
  ]

  const write = db.transaction(() => {
    db.prepare(
      `DELETE FROM skill_access_grants
       WHERE skill_slug = @skill_slug
         AND principal_type = 'handle'`
    ).run({ skill_slug: slug })

    const insert = db.prepare(
      `INSERT OR IGNORE INTO skill_access_grants
        (skill_slug, principal_type, principal, created_by, created_at)
       VALUES
        (@skill_slug, 'handle', @principal, @created_by, @created_at)`
    )
    for (const principal of normalizedHandles) {
      insert.run({
        skill_slug: slug,
        principal,
        created_by: createdBy || null,
        created_at: now,
      })
    }
  })
  write()
  return listSkillAccessGrants(slug)
}

export function addSkillAccessGrant(
  slug: string,
  handle: string,
  createdBy?: string,
): SkillAccessGrant[] {
  const principal = normalizeAccessHandle(handle)
  if (!principal) return listSkillAccessGrants(slug)
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO skill_access_grants
        (skill_slug, principal_type, principal, created_by, created_at)
       VALUES
        (@skill_slug, 'handle', @principal, @created_by, @created_at)`
    )
    .run({
      skill_slug: slug,
      principal,
      created_by: createdBy || null,
      created_at: Math.floor(Date.now() / 1000),
    })
  return listSkillAccessGrants(slug)
}

export function removeSkillAccessGrant(slug: string, handle: string): SkillAccessGrant[] {
  const principal = normalizeAccessHandle(handle)
  if (!principal) return listSkillAccessGrants(slug)
  getDb()
    .prepare(
      `DELETE FROM skill_access_grants
       WHERE skill_slug = @skill_slug
         AND principal_type = 'handle'
         AND principal = @principal`
    )
    .run({ skill_slug: slug, principal })
  return listSkillAccessGrants(slug)
}

export function getSkillVersion(slug: string): string | null {
  const row = getDb()
    .prepare('SELECT version FROM skills WHERE slug = ?')
    .get(slug) as { version: string } | undefined
  return row?.version ?? null
}

export function skillVersionExists(slug: string, version: string): boolean {
  const row = getDb()
    .prepare('SELECT 1 AS ok FROM skill_versions WHERE skill_slug = ? AND version = ?')
    .get(slug, version) as { ok: number } | undefined
  return !!row
}

export function listSkillVersions(slug: string): SkillVersion[] {
  const db = getDb()
  const current = getSkillVersion(slug)
  const rows = db
    .prepare(
      `SELECT id, skill_slug, version, zip_path, example, uploaded_by, uploaded_at
       FROM skill_versions
       WHERE skill_slug = ?
       ORDER BY uploaded_at DESC, id DESC`
    )
    .all(slug) as Array<{
      id: number
      skill_slug: string
      version: string
      zip_path: string
      example: string | null
      uploaded_by: string | null
      uploaded_at: number
    }>

  return rows.map((row) => ({
    id: row.id,
    skill_slug: row.skill_slug,
    version: row.version,
    zip_path: row.zip_path,
    example: row.example || undefined,
    uploaded_by: row.uploaded_by || undefined,
    uploaded_at: row.uploaded_at,
    is_current: row.version === current,
  }))
}

export type UpsertInput = {
  slug: string
  author: string
  name: string
  description: string
  category: Category
  tags: string[]
  version: string
  zip_path: string
  readme: string
  frontmatter: Record<string, unknown>
  example?: string
  uploaded_by?: string
  owner_handle?: string
  source?: SkillSource
  install_access?: InstallAccess
  visibility?: SkillVisibility
}

export function upsertSkill(input: UpsertInput): { skill: Skill; isOverwrite: boolean; previousVersion: string | null } {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const tagsJson = JSON.stringify(input.tags)
  const fmJson = JSON.stringify(input.frontmatter)

  const existing = db
    .prepare('SELECT created_at, version FROM skills WHERE slug = ?')
    .get(input.slug) as { created_at: number; version: string } | undefined

  const write = db.transaction(() => {
    if (existing) {
      db.prepare(
        `UPDATE skills SET
           description=@description, category=@category, tags=@tags, version=@version,
           zip_path=@zip_path, readme=@readme, frontmatter=@frontmatter, example=@example,
           source=COALESCE(@source, source),
           install_access=COALESCE(@install_access, install_access),
           visibility=COALESCE(@visibility, visibility),
           updated_at=@updated_at
         WHERE slug=@slug`
      ).run({
        ...input,
        tags: tagsJson,
        frontmatter: fmJson,
        example: input.example ?? null,
        source: input.source ?? null,
        install_access: input.install_access ?? null,
        visibility: input.visibility ?? null,
        updated_at: now,
      })
    } else {
      db.prepare(
        `INSERT INTO skills
          (slug, author, owner_handle, source, name, description, category, tags, status, install_access, visibility, version, zip_path, readme, frontmatter, example, created_at, updated_at)
         VALUES (@slug, @author, @owner_handle, @source, @name, @description, @category, @tags, 'active', @install_access, @visibility, @version, @zip_path, @readme, @frontmatter, @example, @created_at, @updated_at)`
      ).run({
        ...input,
        owner_handle: input.owner_handle ?? input.author,
        source: input.source ?? 'user',
        install_access: input.install_access ?? 'company',
        visibility: input.visibility ?? 'listed',
        tags: tagsJson,
        frontmatter: fmJson,
        example: input.example ?? null,
        created_at: now,
        updated_at: now,
      })
    }

    db.prepare(
      `INSERT INTO skill_versions
        (skill_slug, version, zip_path, readme, frontmatter, example, uploaded_by, uploaded_at, metadata_json)
       VALUES
        (@skill_slug, @version, @zip_path, @readme, @frontmatter, @example, @uploaded_by, @uploaded_at, @metadata_json)`
    ).run({
      skill_slug: input.slug,
      version: input.version,
      zip_path: input.zip_path,
      readme: input.readme,
      frontmatter: fmJson,
      example: input.example ?? null,
      uploaded_by: input.uploaded_by ?? input.author,
      uploaded_at: now,
      metadata_json: JSON.stringify({
        category: input.category,
        tags: input.tags,
      }),
    })
  })
  write()

  return {
    skill: getSkillBySlug(input.slug)!,
    isOverwrite: !!existing,
    previousVersion: existing?.version ?? null,
  }
}

export function recordInstall(
  slug: string,
  agent?: string,
  version?: string,
  source?: string,
  userId: string = ANONYMOUS_USER_ID,
): number {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    `INSERT INTO installs (skill_slug, user_id, agent, version, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(slug, userId, agent || null, version || null, source || null, now)
  const r = db
    .prepare('SELECT COUNT(*) AS c FROM installs WHERE skill_slug = ?')
    .get(slug) as { c: number }
  return r.c
}

export type UpdateSkillMetadataInput = {
  display_name?: string
  display_description?: string
  description?: string
  category?: Category
  tags?: string[]
  example?: string
  icon?: string
  emoji?: string
}

export function updateSkillMetadata(
  slug: string,
  input: UpdateSkillMetadataInput,
): Skill | null {
  const db = getDb()
  const current = getSkillBySlug(slug)
  if (!current) return null

  const nextDescription = input.description?.trim() || current.description
  const nextCategory = input.category || current.category
  const nextTags = input.tags ?? current.tags
  const nextExample = input.example ?? current.example ?? ''
  const nextFrontmatter = { ...current.frontmatter }
  if (typeof input.display_name === 'string') {
    const displayName = input.display_name.trim()
    if (displayName) nextFrontmatter.display_name = displayName
    else delete nextFrontmatter.display_name
  }
  if (typeof input.display_description === 'string') {
    const displayDescription = input.display_description.trim()
    if (displayDescription) nextFrontmatter.display_description = displayDescription
    else delete nextFrontmatter.display_description
  }
  if (typeof input.icon === 'string') {
    const icon = input.icon.trim()
    if (icon) nextFrontmatter.icon = icon
    else delete nextFrontmatter.icon
  }
  if (typeof input.emoji === 'string') {
    const emoji = input.emoji.trim()
    if (emoji) nextFrontmatter.emoji = emoji
    else delete nextFrontmatter.emoji
  }

  db.prepare(
    `UPDATE skills SET
       description = @description,
       category = @category,
       tags = @tags,
       example = @example,
       frontmatter = @frontmatter,
       updated_at = @updated_at
     WHERE slug = @slug`
  ).run({
    slug,
    description: nextDescription,
    category: nextCategory,
    tags: JSON.stringify(nextTags),
    example: nextExample || null,
    frontmatter: JSON.stringify(nextFrontmatter),
    updated_at: Math.floor(Date.now() / 1000),
  })

  return getSkillBySlug(slug)
}

export function archiveSkill(slug: string): Skill | null {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    `UPDATE skills
     SET status = 'archived', archived_at = @archived_at, updated_at = @updated_at
     WHERE slug = @slug`
  ).run({ slug, archived_at: now, updated_at: now })
  return getSkillBySlug(slug)
}

export function restoreSkill(slug: string): Skill | null {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    `UPDATE skills
     SET status = 'active', archived_at = NULL, updated_at = @updated_at
     WHERE slug = @slug`
  ).run({ slug, updated_at: now })
  return getSkillBySlug(slug)
}

export function recordFeedback(input: {
  skill_slug: string
  user_id: string
  user_handle?: string
  kind: SkillFeedback['kind']
  message: string
  context?: string
  agent?: string
  version?: string
  cli_version?: string
  source: SkillFeedback['source']
}): SkillFeedback {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  const result = db.prepare(
    `INSERT INTO feedback
      (skill_slug, user_id, user_handle, kind, message, context, agent, version, cli_version, source, status, created_at)
     VALUES
      (@skill_slug, @user_id, @user_handle, @kind, @message, @context, @agent, @version, @cli_version, @source, 'open', @created_at)`
  ).run({
    ...input,
    user_handle: input.user_handle ?? null,
    context: input.context ?? null,
    agent: input.agent ?? null,
    version: input.version ?? null,
    cli_version: input.cli_version ?? null,
    created_at: now,
  })
  return getFeedbackById(Number(result.lastInsertRowid))!
}

export function getFeedbackById(id: number): SkillFeedback | null {
  const row = getDb()
    .prepare('SELECT * FROM feedback WHERE id = ?')
    .get(id) as FeedbackRow | undefined
  return row ? toFeedback(row) : null
}

export function listFeedbackForSkill(slug: string): SkillFeedback[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM feedback
       WHERE skill_slug = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 50`
    )
    .all(slug) as FeedbackRow[]
  return rows.map(toFeedback)
}

export function listFeedbackForOwner(
  ownerHandle: string,
  limit = 50,
  skillSlug?: string,
): OwnerFeedback[] {
  const safeLimit = Math.max(1, Math.min(limit, 100))
  const where = [
    'COALESCE(s.owner_handle, s.author) = @owner_handle',
  ]
  if (skillSlug) where.push('f.skill_slug = @skill_slug')
  const params: Record<string, unknown> = { owner_handle: ownerHandle, limit: safeLimit }
  if (skillSlug) params.skill_slug = skillSlug
  const rows = getDb()
    .prepare(
      `SELECT
         f.*,
         s.name AS skill_name,
         COALESCE(s.status, 'active') AS skill_status
       FROM feedback f
       JOIN skills s ON s.slug = f.skill_slug
       WHERE ${where.join(' AND ')}
       ORDER BY f.created_at DESC, f.id DESC
       LIMIT @limit`
    )
    .all(params) as Array<
    FeedbackRow & {
      skill_name: string
      skill_status: string
    }
  >

  return rows.map((row) => ({
    ...toFeedback(row),
    skill_name: row.skill_name,
    skill_status: (row.skill_status || 'active') as SkillStatus,
  }))
}

export function addLike(slug: string, userId: string): number {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    `INSERT INTO likes (skill_slug, user_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT (skill_slug, user_id) DO NOTHING`
  ).run(slug, userId, now)
  return likeCount(slug)
}

export function removeLike(slug: string, userId: string): number {
  const db = getDb()
  db.prepare('DELETE FROM likes WHERE skill_slug = ? AND user_id = ?').run(
    slug,
    userId,
  )
  return likeCount(slug)
}

function likeCount(slug: string): number {
  const db = getDb()
  const r = db
    .prepare('SELECT COUNT(*) AS c FROM likes WHERE skill_slug = ?')
    .get(slug) as { c: number }
  return r.c
}

export function skillExists(slug: string): boolean {
  const db = getDb()
  const r = db
    .prepare('SELECT 1 AS ok FROM skills WHERE slug = ?')
    .get(slug) as { ok: number } | undefined
  return !!r
}

type FeedbackRow = {
  id: number
  skill_slug: string
  user_id: string
  user_handle: string | null
  kind: string
  message: string
  context: string | null
  agent: string | null
  version: string | null
  cli_version: string | null
  source: string
  status: string
  created_at: number
}

function toFeedback(row: FeedbackRow): SkillFeedback {
  return {
    id: row.id,
    skill_slug: row.skill_slug,
    user_id: row.user_id,
    user_handle: row.user_handle || undefined,
    kind: row.kind as SkillFeedback['kind'],
    message: row.message,
    context: row.context || undefined,
    agent: row.agent || undefined,
    version: row.version || undefined,
    cli_version: row.cli_version || undefined,
    source: row.source as SkillFeedback['source'],
    status: row.status as SkillFeedback['status'],
    created_at: row.created_at,
  }
}
