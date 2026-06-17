import path from 'node:path'
import fs from 'node:fs'
import { uploadsDir } from './db'

export function saveSkillZip(author: string, name: string, version: string, buf: Buffer): string {
  const dir = path.join(uploadsDir(), `@${author}`, name)
  fs.mkdirSync(dir, { recursive: true })

  const versioned = path.join(dir, `${version}.zip`)
  fs.writeFileSync(versioned, buf)

  const latest = path.join(dir, 'latest.zip')
  try {
    if (fs.existsSync(latest) || fs.lstatSync(latest, { throwIfNoEntry: false })) {
      fs.unlinkSync(latest)
    }
  } catch {
    // ignore
  }
  try {
    fs.symlinkSync(`${version}.zip`, latest)
  } catch {
    // fallback: copy file (works on Windows / no-symlink filesystems)
    fs.copyFileSync(versioned, latest)
  }

  return path.relative(process.cwd(), versioned)
}

export function skillZipExists(author: string, name: string, version: string): boolean {
  const versioned = path.join(uploadsDir(), `@${author}`, name, `${version}.zip`)
  return fs.existsSync(versioned)
}

export function readSkillZip(zipPath: string): Buffer {
  const abs = path.isAbsolute(zipPath)
    ? zipPath
    : path.resolve(process.cwd(), zipPath)
  return fs.readFileSync(abs)
}
