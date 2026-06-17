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
  /** Whether planned-feature placeholders are visible. Default false for the clean starter view. */
  showPlaceholders: boolean
  setShowPlaceholders: (v: boolean) => void
  /** Whether SSR / first hydration is complete. Before hydration, force false to avoid drift. */
  hydrated: boolean
}

const DevModeContext = createContext<DevModeContextValue>({
  showPlaceholders: false,
  setShowPlaceholders: () => {},
  hydrated: false,
})

// useSyncExternalStore: the server snapshot returns false/null; the client reads localStorage.
// This avoids hydration drift and avoids a useEffect setState lint issue.
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

// Server / pre-hydration snapshot: fixed false to match the first client render.
function getServerSnapshot(): boolean {
  return false
}

// Hydration detector: server returns false, client render returns true.
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
  // override keeps this tab in sync because localStorage writes do not trigger a storage event here.
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
