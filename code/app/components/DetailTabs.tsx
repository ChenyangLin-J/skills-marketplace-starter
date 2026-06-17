'use client'

import { useState, type ReactNode } from 'react'
import { useDevMode } from './DevModeContext'

export type DetailTab = {
  key: string
  label: string
  panel: ReactNode
  /** Marks a tab as dev-mode-only, such as planned Comments or Versions placeholders. */
  devOnly?: boolean
}

export function DetailTabs({ tabs, defaultKey }: { tabs: DetailTab[]; defaultKey?: string }) {
  const { showPlaceholders, hydrated } = useDevMode()
  // SSR and pre-hydration: render the non-dev view to avoid hydration drift.
  const visibleTabs = !hydrated || !showPlaceholders ? tabs.filter((t) => !t.devOnly) : tabs

  const [active, setActive] = useState(defaultKey ?? visibleTabs[0]?.key ?? '')
  const current =
    visibleTabs.find((t) => t.key === active) ?? visibleTabs[0]

  return (
    <div>
      <div className="detail-tabs">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`detail-tab${t.key === (current?.key ?? '') ? ' active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{current?.panel}</div>
    </div>
  )
}
