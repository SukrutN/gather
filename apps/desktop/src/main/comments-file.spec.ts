import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readComments, writeComments } from './comments-file'
import type { Comment } from '@shared/types'

const DOC = '6f0c2a10-1b2c-4d3e-8f01-000000000004'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gather-comments-'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: '6f0c2a10-1b2c-4d3e-8f01-000000000099',
    docId: DOC,
    author: 'Rook',
    body: 'Cut this line.',
    savedAt: '2026-01-08T00:40:00.000Z',
    resolved: false,
    excerpt: 'the lamps counted themselves',
    replies: [],
    ...overrides,
  }
}

describe('readComments', () => {
  it('returns an empty list when the project has no comments yet', async () => {
    expect(await readComments(root)).toEqual([])
  })

  it('reads back what writeComments wrote', async () => {
    await writeComments(root, [comment()])
    const comments = await readComments(root)
    expect(comments).toHaveLength(1)
    expect(comments[0]?.body).toBe('Cut this line.')
    expect(comments[0]?.excerpt).toBe('the lamps counted themselves')
  })

  it('sanitizes junk before writing', async () => {
    const junk = [{ id: 'junk' }, comment()]
    await writeComments(root, junk as unknown as Comment[])
    expect(await readComments(root)).toHaveLength(1)
  })

  it('refuses non-array input', async () => {
    await expect(writeComments(root, 'nope' as unknown)).rejects.toThrow('could not be saved')
  })

  it('throws on a corrupt file rather than hiding it', async () => {
    await writeFile(join(root, 'comments.json'), '{nope', 'utf8')
    await expect(readComments(root)).rejects.toThrow('not valid JSON')
  })

  it('throws on a file with the wrong format', async () => {
    await writeFile(join(root, 'comments.json'), JSON.stringify({ format: 'other' }), 'utf8')
    await expect(readComments(root)).rejects.toThrow('not a Gather comments file')
  })

  it('writes atomically with a trailing newline', async () => {
    await writeComments(root, [comment()])
    const raw = await readFile(join(root, 'comments.json'), 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(raw).toContain('"format": "gather-comments"')
  })
})
