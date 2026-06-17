'use client'

import { useState, type ReactNode } from 'react'
import { useDevMode } from './DevModeContext'

export type DetailTab = {
  key: string
  label: string
  panel: ReactNode
  /** 标记为只在 dev mode 显示的 tab（如 v1.5 占位用的"评论 / 版本"） */
  devOnly?: boolean
}

export function DetailTabs({ tabs, defaultKey }: { tabs: DetailTab[]; defaultKey?: string }) {
  const { showPlaceholders, hydrated } = useDevMode()
  // SSR 阶段以及水合前：按"非 dev"视图渲染（避免水合错位）
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
