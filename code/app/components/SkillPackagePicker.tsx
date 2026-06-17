'use client'

import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import JSZip from 'jszip'

const hiddenInputStyle: CSSProperties = {
  position: 'absolute',
  left: -9999,
  top: 'auto',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
}

type Props = {
  value: File | null
  onChange: (file: File | null) => void
  onError: (message: string | null) => void
  disabled?: boolean
}

export function SkillPackagePicker({ value, onChange, onError, disabled = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [packing, setPacking] = useState(false)

  function pickFile() {
    if (disabled) return
    fileInputRef.current?.click()
  }

  function pickDir() {
    if (disabled) return
    const el = dirInputRef.current
    if (!el) return
    el.setAttribute('webkitdirectory', '')
    el.setAttribute('directory', '')
    ;(el as HTMLInputElement & { webkitdirectory?: boolean }).webkitdirectory = true
    el.click()
  }

  async function readEntry(
    entry: FileSystemEntry,
    pathPrefix: string,
    out: Map<string, File>,
  ): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      const f: File = await new Promise((resolve, reject) => fileEntry.file(resolve, reject))
      out.set(pathPrefix + entry.name, f)
      return
    }
    if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry
      const reader = dirEntry.createReader()
      const all: FileSystemEntry[] = []
      while (true) {
        const batch: FileSystemEntry[] = await new Promise((resolve, reject) =>
          reader.readEntries(resolve, reject),
        )
        if (batch.length === 0) break
        all.push(...batch)
      }
      for (const child of all) {
        await readEntry(child, pathPrefix + entry.name + '/', out)
      }
    }
  }

  function fileListToMap(list: FileList): Map<string, File> {
    const m = new Map<string, File>()
    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
      const parts = rel.split('/')
      const stripped = parts.length > 1 ? parts.slice(1).join('/') : rel
      m.set(stripped, f)
    }
    return m
  }

  async function packToZip(files: Map<string, File>, zipName: string): Promise<File> {
    const zip = new JSZip()
    for (const [path, f] of files) {
      zip.file(path, f)
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    return new File([blob], `${zipName}.zip`, { type: 'application/zip' })
  }

  function handleZipFile(file: File) {
    onError(null)
    onChange(file)
  }

  async function handleDirectoryEntries(entries: FileSystemEntry[], fallbackName: string) {
    if (entries.length === 0) return
    onError(null)
    setPacking(true)
    try {
      const dirEntry = entries.find((entry) => entry.isDirectory)
      if (!dirEntry) {
        onError('请拖入文件夹或 .zip 文件')
        return
      }
      const map = new Map<string, File>()
      await readEntry(dirEntry, '', map)
      const stripped = new Map<string, File>()
      for (const [path, file] of map) {
        const parts = path.split('/')
        const without = parts.length > 1 ? parts.slice(1).join('/') : path
        stripped.set(without, file)
      }
      const zip = await packToZip(stripped, dirEntry.name || fallbackName)
      onChange(zip)
    } catch (err) {
      onError(`打包文件夹失败: ${String(err)}`)
    } finally {
      setPacking(false)
    }
  }

  async function handleDirectoryFileList(list: FileList) {
    if (list.length === 0) return
    onError(null)
    setPacking(true)
    try {
      const map = fileListToMap(list)
      const firstRel =
        (list[0] as File & { webkitRelativePath?: string }).webkitRelativePath || ''
      const rootName = firstRel.split('/')[0] || 'skill'
      const zip = await packToZip(map, rootName)
      onChange(zip)
    } catch (err) {
      onError(`打包文件夹失败: ${String(err)}`)
    } finally {
      setPacking(false)
    }
  }

  function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const first = list[0] as File & { webkitRelativePath?: string }
    if (first.webkitRelativePath) {
      void handleDirectoryFileList(list)
      return
    }
    if (first.name.endsWith('.zip')) {
      handleZipFile(first)
      return
    }
    onError('请选择 .zip 文件,或用「选择文件夹」按钮上传未打包目录')
  }

  function clearFile() {
    onChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (dirInputRef.current) dirInputRef.current.value = ''
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        onChange={(e) => handleFiles(e.target.files)}
        style={hiddenInputStyle}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={dirInputRef}
        type="file"
        onChange={(e) => handleFiles(e.target.files)}
        style={hiddenInputStyle}
        tabIndex={-1}
        aria-hidden="true"
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />
      <div
        className={`dropzone${dragOver ? ' over' : ''}${value ? ' has-file' : ''}`}
        onClick={value || disabled ? undefined : pickFile}
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          if (disabled) return
          e.preventDefault()
          setDragOver(false)
          const items = e.dataTransfer.items
          if (items && items.length > 0) {
            const entries: FileSystemEntry[] = []
            for (let i = 0; i < items.length; i++) {
              const item = items[i]
              if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry?.()
                if (entry) entries.push(entry)
              }
            }
            const dir = entries.find((entry) => entry.isDirectory)
            if (dir) {
              await handleDirectoryEntries(entries, dir.name)
              return
            }
          }
          handleFiles(e.dataTransfer.files)
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!value && !disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            pickFile()
          }
        }}
        aria-disabled={disabled}
      >
        {packing ? (
          <div className="dropzone-empty">
            <div className="dropzone-icon">⏳</div>
            <div className="dropzone-title">正在打包文件夹...</div>
          </div>
        ) : value ? (
          <div className="dropzone-file">
            <div className="dropzone-file-icon">📦</div>
            <div className="dropzone-file-meta">
              <div className="dropzone-file-name">{value.name}</div>
              <div className="dropzone-file-size">{(value.size / 1024).toFixed(1)} KB</div>
            </div>
            <button
              type="button"
              className="dropzone-remove"
              onClick={(e) => {
                e.stopPropagation()
                clearFile()
              }}
              aria-label="移除文件"
              disabled={disabled}
            >
              x
            </button>
          </div>
        ) : (
          <div className="dropzone-empty">
            <div className="dropzone-icon">⬆</div>
            <div className="dropzone-title">拖拽 zip 或文件夹到这里</div>
            <div className="dropzone-actions">
              <button
                type="button"
                className="dropzone-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  pickFile()
                }}
                disabled={disabled}
              >
                选择 zip
              </button>
              <button
                type="button"
                className="dropzone-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  pickDir()
                }}
                disabled={disabled}
              >
                选择文件夹
              </button>
            </div>
            <div className="dropzone-hint">
              文件夹会在浏览器里自动打包成 zip · 需包含 SKILL.md · 最大 10MB
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
