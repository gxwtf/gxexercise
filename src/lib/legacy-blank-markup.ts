type NormalizeBlankOptions = {
  appendInputWhenMissing?: boolean
  replaceBareGrammarNumbers?: boolean
  replaceChinesePunctuationBlanks?: boolean
}

const NUMBERED_UNDERSCORE_BLANK = /_{2,}\s*\d{1,3}\s*_{2,}/g
const PLAIN_UNDERSCORE_BLANK = /_{4,}/g
const INLINE_INPUT = '<Input2 />'

function replaceOrderedNumberRange(content: string, start: number): string | null {
  const matches: Array<{ index: number; length: number }> = []
  let cursor = 0

  for (let number = start; number < start + 10; number++) {
    const pattern = new RegExp(`\\b${number}\\b`, 'g')
    pattern.lastIndex = cursor
    const match = pattern.exec(content)
    if (!match) return null
    matches.push({ index: match.index, length: match[0].length })
    cursor = match.index + match[0].length
  }

  let result = content
  for (const match of matches.reverse()) {
    result = result.slice(0, match.index) + INLINE_INPUT + result.slice(match.index + match.length)
  }
  return result
}

function replaceBareGrammarNumbers(content: string): string {
  return replaceOrderedNumberRange(content, 41)
    ?? replaceOrderedNumberRange(content, 61)
    ?? content
}

function replaceChinesePunctuationBlanks(content: string): string {
  return content
    .replace(/([“‘])\s*([”’])/g, `$1${INLINE_INPUT}$2`)
    .replace(/“(?:\s*，)+\s*”/g, (match) => {
      const blankCount = (match.match(/，/g)?.length ?? 0) + 1
      return `“${Array.from({ length: blankCount }, () => INLINE_INPUT).join('，')}”`
    })
}

export function normalizeLegacyBlankMarkup(
  content: string,
  options: NormalizeBlankOptions = {},
): string {
  let normalized = content
    .replace(NUMBERED_UNDERSCORE_BLANK, INLINE_INPUT)
    .replace(PLAIN_UNDERSCORE_BLANK, INLINE_INPUT)

  if (options.replaceBareGrammarNumbers && !normalized.includes(INLINE_INPUT)) {
    normalized = replaceBareGrammarNumbers(normalized)
  }
  if (options.replaceChinesePunctuationBlanks && !normalized.includes(INLINE_INPUT)) {
    normalized = replaceChinesePunctuationBlanks(normalized)
  }
  if (options.appendInputWhenMissing && !normalized.includes(INLINE_INPUT)) {
    normalized = `${normalized.trimEnd()} ${INLINE_INPUT}`
  }

  return normalized
}
