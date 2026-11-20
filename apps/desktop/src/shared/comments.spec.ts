import { describe, expect, it } from 'vitest'
import {
  blankComment,
  blankReply,
  parseCommentsFile,
  sanitizeComment,
  sanitizeComments,
  serializeComments,
} from './comments'
import type { Comment } from './types'

const DOC = '6f0c2a10-1b2c-4d3e-8f01-000000000004'

function rawComment(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: '6f0c2a10-1b2c-4d3e-8f01-000000000099',
    docId: DOC,
    author: 'Rook',
    body: 'This line lands wrong.',
    savedAt: '2026-01-08T00:40:00.000Z',
    resolved: false,
    excerpt: 'the building waited to see',
    replies: [],
    ...overrides,
  }
}

describe('sanitizeComment', () => {
  it('keeps a well-formed comment', () => {
    const comment = sanitizeComment(rawComment({}))
    expect(comment).not.toBeNull()
    expect(comment?.body).toBe('This line lands wrong.')
    expect(comment?.author).toBe('Rook')
    expect(comment?.resolved).toBe(false)
  })

  it('drops comments with bad ids, bad doc ids, or empty bodies', () => {
    expect(sanitizeComment(rawComment({ id: 'junk' }))).toBeNull()
    expect(sanitizeComment(rawComment({ docId: 'junk' }))).toBeNull()
    expect(sanitizeComment(rawComment({ body: '   ' }))).toBeNull()
    expect(sanitizeComment(null)).toBeNull()
    expect(sanitizeComment('string')).toBeNull()
  })

  it('defaults the author and validates replies', () => {
    const comment = sanitizeComment(
      rawComment({
        author: '',
        replies: [
          { id: '6f0c2a10-1b2c-4d3e-8f01-00000000009a', author: 'Leah', body: 'Agreed.', savedAt: '2026-01-08T01:00:00.000Z' },
          { id: 'junk', author: 'X', body: 'dropped' },
          { id: '6f0c2a10-1b2c-4d3e-8f01-00000000009b', author: 'Nobody', body: '' },
        ],
      }),
    )
    expect(comment?.author).toBe('Anonymous')
    expect(comment?.replies).toHaveLength(1)
    expect(comment?.replies[0]?.author).toBe('Leah')
  })

  it('trims and caps long text', () => {
    const comment = sanitizeComment(rawComment({ excerpt: '  a'.repeat(300) }))
    expect(comment?.excerpt.length).toBeLessThanOrEqual(400)
  })
})

describe('sanitizeComments and round-trips', () => {
  it('dedupes ids and drops junk entries', () => {
    const comments = sanitizeComments([
      rawComment({}),
      rawComment({ body: 'Different body, same id.' }),
      rawComment({ id: '6f0c2a10-1b2c-4d3e-8f01-000000000098', body: 'Second.' }),
      'junk',
    ])
    expect(comments).toHaveLength(2)
  })

  it('survives serialize then parse', () => {
    const comment: Comment = {
      ...blankComment('6f0c2a10-1b2c-4d3e-8f01-000000000097', DOC, 'Rook', 'Cut this line.', 'the lamps counted themselves'),
      replies: [blankReply('6f0c2a10-1b2c-4d3e-8f01-000000000096', 'Leah', 'Keep it.')],
    }
    const text = serializeComments([comment])
    expect(text).toContain('"format": "gather-comments"')
    const parsed = parseCommentsFile(JSON.parse(text) as unknown)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]?.replies[0]?.body).toBe('Keep it.')
  })

  it('rejects files with the wrong shape', () => {
    expect(() => parseCommentsFile({ format: 'other', version: 1, comments: [] })).toThrow('not a Gather comments file')
    expect(() => parseCommentsFile({ format: 'gather-comments', version: 2, comments: [] })).toThrow('unsupported version')
    expect(() => parseCommentsFile({ format: 'gather-comments', version: 1 })).toThrow('missing its comments')
    expect(() => parseCommentsFile('nope')).toThrow('not an object')
    expect(() => parseCommentsFile([])).toThrow('not a Gather comments file')
  })

  it('sanitizes on the way out, so writes are always clean', () => {
    const dirty = [{ id: 'junk', docId: DOC, body: 'x' }, rawComment({})]
    const text = serializeComments(dirty as unknown as Comment[])
    const parsed = parseCommentsFile(JSON.parse(text) as unknown)
    expect(parsed).toHaveLength(1)
  })
})
