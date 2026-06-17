'use client'

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'agent-skills:dev-mode'

type DevModeContextValue = {
  /** 是否显示 "v1.5 上线" 占位（默认 false：线上版的干净视图） */
  showPlaceholders: boolean
  setShowPlaceholders: (v: boolean) => void
  /** SSR / 首次水合是否完成。未完成时强制按默认 false 渲染，避免水合错位。 */
  hydrated: boolean
}

const DevModeContext = createContext<DevModeContextValue>({
  showPlaceholders: false,
  setShowPlaceholders: () => {},
  hydrated: false,
})

// useSyncExternalStore: 服务器返回 false / null，客户端首次同步从 localStorage 读。
// 这样既避免水合错位，也避免 useEffect 里 setState 引发的 lint 报错。
function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}

function getStoredSnapshot(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === '1' || raw === 'true'
  } catch {
    return false
  }
}

// 服务器侧 / 水合前快照：固定 false（确保和客户端首次渲染一致）
function getServerSnapshot(): boolean {
  return false
}

// 检测当前是否已水合：服务器返回 false，客户端渲染时返回 true。
function getHydratedSnapshot(): boolean {
  return true
}

function getServerHydratedSnapshot(): boolean {
  return false
}

export function DevModeProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(
    subscribe,
    getStoredSnapshot,
    getServerSnapshot,
  )
  const hydrated = useSyncExternalStore(
    subscribe,
    getHydratedSnapshot,
    getServerHydratedSnapshot,
  )
  // override 用于本 tab 内同步更新（localStorage 写入不会触发本 tab 的 'storage' 事件）。
  const [overrideValue, setOverrideValue] = useState<boolean | null>(null)
  const showPlaceholders = overrideValue !== null ? overrideValue : stored

  const setShowPlaceholders = useCallback((v: boolean) => {
    setOverrideValue(v)
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
    } catch {
      // ignore
    }
  }, [])

  return (
    <DevModeContext.Provider
      value={{ showPlaceholders, setShowPlaceholders, hydrated }}
    >
      {children}
    </DevModeContext.Provider>
  )
}

export function useDevMode(): DevModeContextValue {
  return useContext(DevModeContext)
}
