import JSZip from 'jszip'
import matter from 'gray-matter'

export type ParsedSkill = {
  name: string
  description: string
  version: string
  readme: string
  frontmatter: Record<string, unknown>
}

export type SkillMetadataDraft = {
  name: string
  description: string
  version: string
  readme: string
  frontmatter: Record<string, unknown>
}

export class SkillParseError extends Error {
  code: string
  details?: Record<string, string>
  constructor(code: string, message: string, details?: Record<string, string>) {
    super(message)
    this.code = code
    this.details = details
  }
}

const NAME_RE = /^[a-z0-9-]{1,50}$/
const VERSION_RE = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,49}$/

async function readZip(buf: Buffer): Promise<JSZip> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buf)
  } catch (e) {
    throw new SkillParseError('invalid_zip', 'Could not read the zip file. Repackage it and upload again.', {
      zip: String(e),
    })
  }
  return zip
}

function findSkillEntry(zip: JSZip) {
  const entries = Object.values(zip.files)
  const skillEntry = entries.find((e) => {
    if (e.dir) return false
    const name = e.name.split('/').pop() || ''
    return name.toLowerCase() === 'skill.md'
  })

  if (!skillEntry) {
    throw new SkillParseError('missing_skill_md', 'SKILL.md was not found in the zip file.')
  }
  return skillEntry
}

async function readSkillEntry(entry: JSZip.JSZipObject): Promise<string> {
  try {
    return await entry.async('string')
  } catch (e) {
    throw new SkillParseError('invalid_zip', 'Could not read SKILL.md from the zip file. Repackage it and upload again.', {
      zip: String(e),
    })
  }
}

function parseSkillMarkdown(raw: string) {
  try {
    return matter(raw)
  } catch (e) {
    throw new SkillParseError('invalid_frontmatter', 'Could not parse SKILL.md frontmatter.', {
      frontmatter: String(e),
    })
  }
}

function readDraftFrontmatter(parsed: matter.GrayMatterFile<string>): SkillMetadataDraft {
  const fm = (parsed.data || {}) as Record<string, unknown>
  return {
    name: typeof fm.name === 'string' ? fm.name.trim() : '',
    description: typeof fm.description === 'string' ? fm.description.trim() : '',
    version: typeof fm.version === 'string' && fm.version.trim() ? fm.version.trim() : '0.1.0',
    readme: parsed.content,
    frontmatter: fm,
  }
}

export async function parseSkillZipDraft(buf: Buffer): Promise<SkillMetadataDraft> {
  const zip = await readZip(buf)
  const skillEntry = findSkillEntry(zip)
  const raw = await readSkillEntry(skillEntry)
  return readDraftFrontmatter(parseSkillMarkdown(raw))
}

export async function parseSkillZip(buf: Buffer): Promise<ParsedSkill> {
  const zip = await readZip(buf)
  const skillEntry = findSkillEntry(zip)

  const raw = await readSkillEntry(skillEntry)
  const parsed = parseSkillMarkdown(raw)
  const draft = readDraftFrontmatter(parsed)
  const { name, description, version } = draft

  const errs: Record<string, string> = {}
  if (!name) errs.name = 'frontmatter.name is required'
  else if (!NAME_RE.test(name)) errs.name = 'name must match [a-z0-9-] and be 1-50 characters'
  if (!description) errs.description = 'frontmatter.description is required'
  if (!VERSION_RE.test(version)) errs.version = 'version may use letters, numbers, dots, underscores, plus signs, and hyphens, 1-50 characters'

  if (Object.keys(errs).length > 0) {
    throw new SkillParseError('invalid_frontmatter', 'SKILL.md frontmatter validation failed.', errs)
  }

  return {
    name,
    description,
    version,
    readme: draft.readme,
    frontmatter: draft.frontmatter,
  }
}

export function isValidName(name: string): boolean {
  return NAME_RE.test(name)
}

export async function rewriteSkillZipVersion(
  buf: Buffer,
  version: string,
): Promise<{ buffer: Buffer; parsed: ParsedSkill }> {
  const cleanVersion = version.trim()
  if (!VERSION_RE.test(cleanVersion)) {
    throw new SkillParseError('invalid_frontmatter', 'SKILL.md frontmatter validation failed.', {
      version: 'version may use letters, numbers, dots, underscores, plus signs, and hyphens, 1-50 characters',
    })
  }

  const zip = await readZip(buf)
  const skillEntry = findSkillEntry(zip)
  const raw = await readSkillEntry(skillEntry)
  const parsed = parseSkillMarkdown(raw)
  const nextRaw = matter.stringify(parsed.content, {
    ...(parsed.data || {}),
    version: cleanVersion,
  })

  let nextBuffer: Buffer
  try {
    zip.file(skillEntry.name, nextRaw)
    nextBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  } catch (e) {
    throw new SkillParseError('invalid_zip', 'Could not rewrite the zip file. Repackage it and upload again.', {
      zip: String(e),
    })
  }
  return {
    buffer: nextBuffer,
    parsed: await parseSkillZip(nextBuffer),
  }
}

export async function rewriteSkillZipFrontmatter(
  buf: Buffer,
  updates: Record<string, string | undefined>,
): Promise<{ buffer: Buffer; parsed: ParsedSkill }> {
  const zip = await readZip(buf)
  const skillEntry = findSkillEntry(zip)
  const raw = await readSkillEntry(skillEntry)
  const parsed = parseSkillMarkdown(raw)
  const nextData = { ...(parsed.data || {}) } as Record<string, unknown>

  for (const [key, value] of Object.entries(updates)) {
    const clean = typeof value === 'string' ? value.trim() : ''
    if (clean) nextData[key] = clean
  }

  const nextRaw = matter.stringify(parsed.content, nextData)

  let nextBuffer: Buffer
  try {
    zip.file(skillEntry.name, nextRaw)
    nextBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  } catch (e) {
    throw new SkillParseError('invalid_zip', 'Could not rewrite the zip file. Repackage it and upload again.', {
      zip: String(e),
    })
  }
  return {
    buffer: nextBuffer,
    parsed: await parseSkillZip(nextBuffer),
  }
}
