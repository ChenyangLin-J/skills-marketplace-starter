'use client'

import type { ReactNode } from 'react'
import { useDevMode } from './DevModeContext'

/**
 * Client wrapper for planned-feature placeholders.
 * Default OFF: hidden in the clean starter view. Dev Tools can turn it on.
 *
 * Before hydration, render as false to avoid flicker and hydration drift.
 */
export function DevPlaceholder({ children }: { children: ReactNode }) {
  const { showPlaceholders, hydrated } = useDevMode()
  if (!hydrated) return null
  if (!showPlaceholders) return null
  return <>{children}</>
}
