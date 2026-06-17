export type Category = 'business' | 'tool' | 'method' | 'cli'
export type SkillStatus = 'active' | 'archived'
export type SkillSource = 'official' | 'external' | 'user'
export type InstallAccess = 'anonymous' | 'company' | 'restricted'
export type SkillVisibility = 'listed' | 'unlisted' | 'restricted' | 'match_install_access'

export const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: 'business', label: '业务', emoji: '💼' },
  { value: 'tool', label: '工具', emoji: '🛠️' },
  { value: 'method', label: '方法论', emoji: '🧭' },
  { value: 'cli', label: 'CLI', emoji: '⌨️' },
]

export type Skill = {
  slug: string
  author: string
  author_name?: string
  owner_handle?: string
  name: string
  description: string
  category: Category
  tags: string[]
  status: SkillStatus
  archived_at?: number
  source?: SkillSource
  install_access: InstallAccess
  visibility: SkillVisibility
  version: string
  readme: string
  example?: string
  frontmatter: Record<string, unknown>
  install_count: number
  weekly_install_count: number
  like_count: number
  liked_by_me: boolean
  created_at: number
  updated_at: number
}

export type SkillVersion = {
  id: number
  skill_slug: string
  version: string
  zip_path: string
  example?: string
  uploaded_by?: string
  uploaded_at: number
  is_current: boolean
}

export type SkillAccessGrant = {
  id: number
  skill_slug: string
  principal_type: 'handle'
  principal: string
  created_by?: string
  created_at: number
}

export type SkillFeedback = {
  id: number
  skill_slug: string
  user_id: string
  user_handle?: string
  kind: 'issue' | 'suggestion' | 'question' | 'usage'
  message: string
  context?: string
  agent?: string
  version?: string
  cli_version?: string
  source: 'web' | 'cli'
  status: 'open' | 'resolved'
  created_at: number
}

export type ApiError = {
  error: string
  message: string
  details?: Record<string, string>
}
