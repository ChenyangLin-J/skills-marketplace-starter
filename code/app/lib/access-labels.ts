import type { InstallAccess, SkillVisibility } from './types'

export type AccessOption<T extends string> = {
  value: T
  label: string
  detail: string
}

export const INSTALL_ACCESS_OPTIONS: AccessOption<InstallAccess>[] = [
  { value: 'company', label: 'Signed-in users can install', detail: 'Default. Any logged-in user can install it.' },
  { value: 'restricted', label: 'Selected users can install', detail: 'Only the author, owner, and granted users can install it.' },
  { value: 'anonymous', label: 'Anyone can install', detail: 'No login required. Useful for guide or bootstrap Skills.' },
]

export const VISIBILITY_OPTIONS: AccessOption<SkillVisibility>[] = [
  { value: 'listed', label: 'Listed', detail: 'Visible on the homepage, search, and detail pages.' },
  { value: 'match_install_access', label: 'Match install access', detail: 'Only users who can install it can see it.' },
  { value: 'unlisted', label: 'Unlisted link', detail: 'Hidden from lists, but available by direct link.' },
  { value: 'restricted', label: 'Selected users only', detail: 'Only the author, owner, and granted users can see it.' },
]

export function installAccessLabel(value: InstallAccess): string {
  return INSTALL_ACCESS_OPTIONS.find((option) => option.value === value)?.label || value
}

export function visibilityLabel(value: SkillVisibility): string {
  return VISIBILITY_OPTIONS.find((option) => option.value === value)?.label || value
}
