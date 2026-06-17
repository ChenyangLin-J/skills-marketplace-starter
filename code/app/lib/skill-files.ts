import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'
import { getDb } from './db'

export type SkillFileEntry = {
  path: string
  name: string
  depth: number
  isDirectory: boolean
  size: number
}

type ZipRow = {
  zip_path: string
}

export async function listSkillFiles(slug: string): Promise<SkillFileEntry[]> {
  const db = getDb()
  const row = db
    .prepare('SELECT zip_path FROM skills WHERE slug = ?')
    .get(slug) as ZipRow | undefined
  if (!row) return []

  const zipPath = path.isAbsolute(row.zip_path)
    ? row.zip_path
    : path.resolve(process.cwd(), row.zip_path)
  if (!fs.existsSync(zipPath)) return []

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(fs.readFileSync(zipPath))
  } catch {
    return []
  }
  const entries = new Map<string, SkillFileEntry>()

  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      const normalized = normalizeZipPath(entry.name)
      if (!normalized) return
      if (isHiddenFileEntry(normalized)) return

      addParentDirs(normalized, entries)
      const parts = normalized.split('/')
      let size = 0
      if (!entry.dir) {
        try {
          size = (await entry.async('uint8array')).byteLength
        } catch {
          size = 0
        }
      }
      entries.set(normalized, {
        path: normalized,
        name: parts.at(-1) || normalized,
        depth: parts.length - 1,
        isDirectory: entry.dir,
        size,
      })
    }),
  )

  return [...entries.values()].sort(compareEntries)
}

function normalizeZipPath(value: string): string | null {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
  if (!normalized || normalized === '.' || normalized.includes('\0')) return null
  const parts = normalized.split('/').filter(Boolean)
  if (parts.some((part) => part === '..')) return null
  if (parts[0] === '__MACOSX') return null
  if (parts.at(-1) === '.DS_Store') return null
  return parts.join('/')
}

function isHiddenFileEntry(filePath: string): boolean {
  const parts = filePath.split('/')
  return parts[0] === 'agents'
}

function addParentDirs(filePath: string, entries: Map<string, SkillFileEntry>) {
  const parts = filePath.split('/')
  for (let i = 1; i < parts.length; i += 1) {
    const dirPath = parts.slice(0, i).join('/')
    if (!entries.has(dirPath)) {
      entries.set(dirPath, {
        path: dirPath,
        name: parts[i - 1],
        depth: i - 1,
        isDirectory: true,
        size: 0,
      })
    }
  }
}

function compareEntries(a: SkillFileEntry, b: SkillFileEntry): number {
  const aParent = parentPath(a.path)
  const bParent = parentPath(b.path)
  if (aParent === bParent && a.isDirectory !== b.isDirectory) {
    return a.isDirectory ? -1 : 1
  }
  return a.path.localeCompare(b.path, 'en')
}

function parentPath(value: string): string {
  const index = value.lastIndexOf('/')
  return index === -1 ? '' : value.slice(0, index)
}
