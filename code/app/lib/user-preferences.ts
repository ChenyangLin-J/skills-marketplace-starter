import { getDb } from '@/lib/db'
import { HOME_GUIDE_COMPLETED_PREFERENCE_KEY } from '@/lib/home-guide-state'

type PreferenceRow = {
  value: string
}

export function getUserPreference(userOpenId: string, key: string): string | null {
  const row = getDb()
    .prepare('SELECT value FROM user_preferences WHERE user_open_id = ? AND key = ?')
    .get(userOpenId, key) as PreferenceRow | undefined
  return row?.value ?? null
}

export function setUserPreference(userOpenId: string, key: string, value: string): void {
  const now = Math.floor(Date.now() / 1000)
  getDb()
    .prepare(
      `INSERT INTO user_preferences (user_open_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_open_id, key)
       DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(userOpenId, key, value, now)
}

export function deleteUserPreference(userOpenId: string, key: string): void {
  getDb()
    .prepare('DELETE FROM user_preferences WHERE user_open_id = ? AND key = ?')
    .run(userOpenId, key)
}

export function isHomeGuideCompleted(userOpenId: string): boolean {
  return getUserPreference(userOpenId, HOME_GUIDE_COMPLETED_PREFERENCE_KEY) === '1'
}

export function setHomeGuideCompleted(userOpenId: string, completed: boolean): void {
  if (completed) {
    setUserPreference(userOpenId, HOME_GUIDE_COMPLETED_PREFERENCE_KEY, '1')
    return
  }
  deleteUserPreference(userOpenId, HOME_GUIDE_COMPLETED_PREFERENCE_KEY)
}
