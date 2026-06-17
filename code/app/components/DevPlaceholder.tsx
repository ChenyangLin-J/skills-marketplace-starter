'use client'

import type { ReactNode } from 'react'
import { useDevMode } from './DevModeContext'

/**
 * 包裹 "v1.5 上线" 占位的客户端组件。
 * 默认 OFF（线上版视图）→ 隐藏；Dev Tools 切到 ON → 显示。
 *
 * 注意：未水合（hydrated === false）时按默认 false 处理，避免水合时短暂闪烁。
 */
export function DevPlaceholder({ children }: { children: ReactNode }) {
  const { showPlaceholders, hydrated } = useDevMode()
  if (!hydrated) return null
  if (!showPlaceholders) return null
  return <>{children}</>
}
