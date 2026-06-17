export type Heading = {
  id: string
  text: string
  level: 2 | 3
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w一-龥]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function parseHeadings(markdown: string): Heading[] {
  if (!markdown) return []
  const lines = markdown.split('\n')
  const out: Heading[] = []
  let inFence = false
  const counts = new Map<string, number>()
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*$/)
    if (!m) continue
    const level = m[1].length as 2 | 3
    const text = m[2].trim()
    let id = slugify(text)
    if (!id) continue
    const n = (counts.get(id) ?? 0) + 1
    counts.set(id, n)
    if (n > 1) id = `${id}-${n}`
    out.push({ id, text, level })
  }
  return out
}

/** 把 [data-toc-target] 容器内的 h2/h3 按顺序贴上 id + scroll-margin */
export function attachIds(headings: Heading[]): HTMLHeadingElement[] {
  const main = document.querySelector('[data-toc-target="true"]')
  if (!main) return []
  const md = main.querySelectorAll<HTMLHeadingElement>('h2, h3')
  const tagged: HTMLHeadingElement[] = []
  let idx = 0
  md.forEach((el) => {
    if (idx >= headings.length) return
    const expected = headings[idx]
    if (el.tagName === `H${expected.level}`) {
      el.id = expected.id
      el.style.scrollMarginTop = '88px'
      tagged.push(el)
      idx++
    }
  })
  return tagged
}
