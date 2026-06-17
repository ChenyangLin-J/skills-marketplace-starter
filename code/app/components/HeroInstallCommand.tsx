'use client'

import { Check, Copy } from 'lucide-react'
import { type MouseEvent, useEffect, useRef, useState } from 'react'

type HeroInstallCommandProps = {
  command: string
}

export function HeroInstallCommand({ command }: HeroInstallCommandProps) {
  const [copied, setCopied] = useState(false)
  const [showFullCommand, setShowFullCommand] = useState(false)
  const [needsFullCommand, setNeedsFullCommand] = useState(false)
  const lineRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef<HTMLElement>(null)
  const copyRef = useRef<HTMLButtonElement>(null)
  const hoverTimer = useRef<number | null>(null)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      // Keep the command visible if clipboard permissions are unavailable.
    }
  }

  function clearHoverTimer() {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }

  function queueFullCommand() {
    clearHoverTimer()
    if (!needsFullCommand) return
    hoverTimer.current = window.setTimeout(() => {
      setShowFullCommand(true)
      hoverTimer.current = null
    }, 650)
  }

  function hideFullCommand() {
    clearHoverTimer()
    setShowFullCommand(false)
  }

  function isInsideCopyButton(x: number, y: number): boolean {
    const copy = copyRef.current
    if (!copy) return false
    const rect = copy.getBoundingClientRect()
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  }

  function onInstallLineMove(event: MouseEvent<HTMLDivElement>) {
    if (isInsideCopyButton(event.clientX, event.clientY)) {
      hideFullCommand()
      return
    }
    if (!showFullCommand && !hoverTimer.current) {
      queueFullCommand()
    }
  }

  useEffect(() => clearHoverTimer, [])

  useEffect(() => {
    function updateNeedsFullCommand() {
      const code = codeRef.current
      const copy = copyRef.current
      if (!code || !copy) return

      const codeRect = code.getBoundingClientRect()
      const copyRect = copy.getBoundingClientRect()
      const visibleWidthBeforeCopy = Math.max(0, copyRect.left - codeRect.left - 6)
      const effectiveVisibleWidth = Math.min(code.clientWidth, visibleWidthBeforeCopy)
      setNeedsFullCommand(code.scrollWidth > effectiveVisibleWidth + 1)
    }

    updateNeedsFullCommand()

    const observer = new ResizeObserver(updateNeedsFullCommand)
    if (lineRef.current) observer.observe(lineRef.current)
    if (codeRef.current) observer.observe(codeRef.current)
    if (copyRef.current) observer.observe(copyRef.current)

    return () => observer.disconnect()
  }, [command, copied])

  const Icon = copied ? Check : Copy

  return (
    <div
      ref={lineRef}
      className="hero-install-line"
      onMouseEnter={queueFullCommand}
      onMouseMove={onInstallLineMove}
      onMouseLeave={hideFullCommand}
    >
      <span aria-hidden="true">$</span>
      <code ref={codeRef} className="hero-install-code">{command}</code>
      <button
        ref={copyRef}
        type="button"
        className={`hero-install-copy${copied ? ' copied' : ''}`}
        onClick={onCopy}
        onMouseEnter={hideFullCommand}
        onFocus={hideFullCommand}
        aria-label={copied ? 'Install command copied' : 'Copy install command'}
        title={copied ? 'Copied' : 'Copy command'}
      >
        <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
      {needsFullCommand && (
        <div className={`hero-install-popover${showFullCommand ? ' visible' : ''}`} role="tooltip">
          <span>Full install command</span>
          <code>{command}</code>
        </div>
      )}
    </div>
  )
}
