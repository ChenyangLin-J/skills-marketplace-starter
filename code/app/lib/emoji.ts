type Segmenter = {
  segment(input: string): Iterable<{ segment: string }>
}

type SegmenterConstructor = new (
  locale: string,
  options: { granularity: 'grapheme' },
) => Segmenter

function graphemes(value: string): string[] {
  const segmenter = (Intl as typeof Intl & { Segmenter?: SegmenterConstructor }).Segmenter
  if (!segmenter) return Array.from(value)
  return Array.from(new segmenter('zh-CN', { granularity: 'grapheme' }).segment(value), (s) => s.segment)
}

export function isSingleEmoji(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (graphemes(trimmed).length !== 1) return false
  return /[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Regional_Indicator}]/u.test(trimmed)
}

export function emojiInputError(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return isSingleEmoji(trimmed) ? null : '只支持输入一个 emoji'
}
