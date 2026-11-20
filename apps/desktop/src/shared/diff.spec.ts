import { describe, expect, it } from 'vitest'
import { collapseContext, isUnchanged, lineDiff, type DiffRow } from './diff'

describe('lineDiff', () => {
  it('marks identical texts as unchanged', () => {
    const rows = lineDiff('one\ntwo\nthree', 'one\ntwo\nthree')
    expect(isUnchanged(rows)).toBe(true)
    expect(rows.map((row) => row.type)).toEqual(['same', 'same', 'same'])
  })

  it('finds pure additions', () => {
    const rows = lineDiff('alpha\nomega', 'alpha\nbeta\ngamma\nomega')
    expect(rows).toEqual([
      { type: 'same', text: 'alpha' },
      { type: 'add', text: 'beta' },
      { type: 'add', text: 'gamma' },
      { type: 'same', text: 'omega' },
    ])
  })

  it('finds pure removals', () => {
    const rows = lineDiff('alpha\nbeta\nomega', 'alpha\nomega')
    expect(rows).toEqual([
      { type: 'same', text: 'alpha' },
      { type: 'remove', text: 'beta' },
      { type: 'same', text: 'omega' },
    ])
  })

  it('treats a rewritten line as remove-then-add', () => {
    const rows = lineDiff('The lamps counted fourteen.', 'The lamps counted fifteen.')
    expect(rows).toEqual([
      { type: 'remove', text: 'The lamps counted fourteen.' },
      { type: 'add', text: 'The lamps counted fifteen.' },
    ])
  })

  it('handles moved paragraphs without claiming everything changed', () => {
    const before = 'one\ntwo\nthree\nfour'
    const after = 'three\nfour\none\ntwo'
    const rows = lineDiff(before, after)
    const same = rows.filter((row) => row.type === 'same')
    expect(same.length).toBeGreaterThan(0)
    expect(rows.length).toBe(6)
  })

  it('handles empty inputs in both directions', () => {
    expect(lineDiff('', 'fresh\nlines')).toEqual([
      { type: 'add', text: 'fresh' },
      { type: 'add', text: 'lines' },
    ])
    expect(lineDiff('gone', '')).toEqual([{ type: 'remove', text: 'gone' }])
    expect(lineDiff('', '')).toEqual([])
  })

  it('normalizes CRLF and BOM before comparing', () => {
    const rows = lineDiff('\uFEFFone\r\ntwo', 'one\ntwo')
    expect(isUnchanged(rows)).toBe(true)
  })

  it('ignores a single trailing newline on either side', () => {
    expect(isUnchanged(lineDiff('one\n', 'one'))).toBe(true)
    expect(isUnchanged(lineDiff('one', 'one\n'))).toBe(true)
    expect(isUnchanged(lineDiff('one\n\n', 'one\n'))).toBe(false)
  })
})

describe('collapseContext', () => {
  it('keeps a window of context around changes and marks gaps', () => {
    const lines: DiffRow[] = Array.from({ length: 20 }, (_, index) => ({
      type: 'same' as const,
      text: `line ${index}`,
    }))
    lines[10] = { type: 'add', text: 'inserted' }
    const rows = collapseContext(lines, 2)
    expect(rows.some((row) => row.type === 'gap')).toBe(true)
    const kept = rows.filter((row) => row.type === 'same')
    expect(kept.map((row) => row.text)).toEqual(['line 8', 'line 9', 'line 11', 'line 12'])
  })

  it('leaves short diffs untouched', () => {
    const rows = [
      { type: 'same' as const, text: 'a' },
      { type: 'remove' as const, text: 'b' },
      { type: 'add' as const, text: 'c' },
    ]
    expect(collapseContext(rows)).toEqual(rows)
  })

  it('returns a single gap for a fully unchanged long text', () => {
    const lines = Array.from({ length: 50 }, (_, index) => ({ type: 'same' as const, text: `line ${index}` }))
    expect(collapseContext(lines)).toEqual([{ type: 'gap', text: '' }])
  })
})
