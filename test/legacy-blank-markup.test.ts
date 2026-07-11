import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeLegacyBlankMarkup } from '../src/lib/legacy-blank-markup'

test('turns a numbered underscore marker into exactly one input', () => {
  assert.equal(normalizeLegacyBlankMarkup('She ___61___ (go).'), 'She <Input2 /> (go).')
})

test('preserves the position and count of plain underscore blanks', () => {
  assert.equal(normalizeLegacyBlankMarkup('甲______，乙______。'), '甲<Input2 />，乙<Input2 />。')
})

test('replaces an ordered bare grammar range but not incidental numbers', () => {
  const source = '16-year-old ' + Array.from({ length: 10 }, (_, index) => `${61 + index} word`).join(' ')
  const result = normalizeLegacyBlankMarkup(source, { replaceBareGrammarNumbers: true })
  assert.equal(result.match(/<Input2 \/>/g)?.length, 10)
  assert.match(result, /^16-year-old/)
})

test('restores empty Chinese quotation and punctuation placeholders', () => {
  const result = normalizeLegacyBlankMarkup('“”，“ ， ， ”', { replaceChinesePunctuationBlanks: true })
  assert.equal(result.match(/<Input2 \/>/g)?.length, 4)
})

test('appends one math input when the source ends at the answer position', () => {
  assert.equal(normalizeLegacyBlankMarkup('则 $m=$', { appendInputWhenMissing: true }), '则 $m=$ <Input2 />')
})

test('does not treat normal math subscripts as blanks', () => {
  assert.equal(normalizeLegacyBlankMarkup('$a_1+a_2$'), '$a_1+a_2$')
})
