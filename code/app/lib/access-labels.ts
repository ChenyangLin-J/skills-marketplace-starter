import type { InstallAccess, SkillVisibility } from './types'

export type AccessOption<T extends string> = {
  value: T
  label: string
  detail: string
}

export const INSTALL_ACCESS_OPTIONS: AccessOption<InstallAccess>[] = [
  { value: 'company', label: '登录用户可安装', detail: '默认内部 Skill；公司账号登录后可安装' },
  { value: 'restricted', label: '指定人员可安装', detail: '只有作者、owner 和指定人员可安装' },
  { value: 'anonymous', label: '所有人可安装', detail: '无需登录，适合 guide / bootstrap Skill' },
]

export const VISIBILITY_OPTIONS: AccessOption<SkillVisibility>[] = [
  { value: 'listed', label: '公开展示', detail: '首页、搜索和详情页都可见' },
  { value: 'match_install_access', label: '按安装权限可见', detail: '能安装的人才能看到' },
  { value: 'unlisted', label: '仅链接可访问', detail: '不进列表，但知道链接可打开' },
  { value: 'restricted', label: '指定人员可见', detail: '只有作者、owner 和指定人员可见' },
]

export function installAccessLabel(value: InstallAccess): string {
  return INSTALL_ACCESS_OPTIONS.find((option) => option.value === value)?.label || value
}

export function visibilityLabel(value: SkillVisibility): string {
  return VISIBILITY_OPTIONS.find((option) => option.value === value)?.label || value
}
