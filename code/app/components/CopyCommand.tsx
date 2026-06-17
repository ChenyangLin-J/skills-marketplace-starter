'use client'

import { Check, Copy } from 'lucide-react'
import { type MouseEvent, useEffect, useRef, useState } from 'react'

type CopyCommandProps = {
  command: string
  windowsCommand?: string
}

function isWindows(): boolean {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const platform = nav.userAgentData?.platform || navigator.platform || ''
  return /win/i.test(platform) || /windows/i.test(navigator.userAgent)
}

export function CopyCommand({ command, windowsCommand }: CopyCommandProps) {
  const [activeCommand] = useState(() =>
    typeof navigator !== 'undefined' && windowsCommand && isWindows()
      ? windowsCommand
      : command,
  )
  const [copied, setCopied] = useState(false)
  const [showFullCommand, setShowFullCommand] = useState(false)
  const [needsFullCommand, setNeedsFullCommand] = useState(false)
  const lineRef = useRef<HTMLDivElement>(null)
  const codeRef = useRef<HTMLElement>(null)
  const copyRef = useRef<HTMLButtonElement>(null)
  const hoverTimer = useRef<number | null>(null)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(activeCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can fail in insecure contexts; the command remains visible.
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

  function onCommandLineMove(event: MouseEvent<HTMLDivElement>) {
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
      const visibleWidthBeforeCopy = Math.max(0, copyRect.left - codeRect.left - 8)
      const effectiveVisibleWidth = Math.min(code.clientWidth, visibleWidthBeforeCopy)
      setNeedsFullCommand(code.scrollWidth > effectiveVisibleWidth + 1)
    }

    updateNeedsFullCommand()

    const observer = new ResizeObserver(updateNeedsFullCommand)
    if (lineRef.current) observer.observe(lineRef.current)
    if (codeRef.current) observer.observe(codeRef.current)
    if (copyRef.current) observer.observe(copyRef.current)

    return () => observer.disconnect()
  }, [activeCommand, copied])

  const Icon = copied ? Check : Copy

  return (
    <div
      ref={lineRef}
      className="hero-command-line"
      onMouseEnter={queueFullCommand}
      onMouseMove={onCommandLineMove}
      onMouseLeave={hideFullCommand}
    >
      <span className="prompt">$</span>
      <code ref={codeRef} className="hero-command-code">{activeCommand}</code>
      <button
        ref={copyRef}
        type="button"
        className={`hero-command-copy${copied ? ' copied' : ''}`}
        onClick={onCopy}
        onMouseEnter={hideFullCommand}
        onFocus={hideFullCommand}
        aria-label={copied ? 'CLI install command copied' : 'Copy CLI install command'}
        title={copied ? 'Copied' : 'Copy command'}
      >
        <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
      {needsFullCommand && (
        <div className={`hero-command-popover${showFullCommand ? ' visible' : ''}`} role="tooltip">
          <span>Full CLI install command</span>
          <code>{activeCommand}</code>
        </div>
      )}
    </div>
  )
}
