import { describe, expect, it } from 'vitest'
import { blankDoc } from './model'
import { documentKind, isStatus, parseDocument, serializeDocument } from './markdown'
import type { Doc, Kind } from './types'

const ID = '6f0c2a10-1b2c-4d3e-8f01-000000000004'

function scene(): Doc {
  return {
    ...blankDoc(ID, 'scene', 'Keys'),
    status: 'revised',
    synopsis: 'Leah locks the door; the clerk’s note waits.',
    pov: '6f0c2a10-1b2c-4d3e-8f01-000000000011',
    location: '6f0c2a10-1b2c-4d3e-8f01-000000000021',
    thread: '6f0c2a10-1b2c-4d3e-8f01-000000000040',
    storyDay: '3.5',
    body: 'Leah Voss locked the street door at ten.\n\nThe lamps counted themselves.',
  }
}

function roundTrip(doc: Doc, fallbackKind: Kind = doc.kind): Doc {
  const markdown = serializeDocument(doc)
  return parseDocument(markdown, blankDoc(doc.id, fallbackKind, 'Fallback'))
}

describe('serializeDocument / parseDocument', () => {
  it('round-trips a scene with all inspector fields', () => {
    const parsed = roundTrip(scene())
    expect(parsed.title).toBe('Keys')
    expect(parsed.kind).toBe('scene')
    expect(parsed.status).toBe('revised')
    expect(parsed.synopsis).toBe('Leah locks the door; the clerk’s note waits.')
    expect(parsed.pov).toBe('6f0c2a10-1b2c-4d3e-8f01-000000000011')
    expect(parsed.location).toBe('6f0c2a10-1b2c-4d3e-8f01-000000000021')
    expect(parsed.thread).toBe('6f0c2a10-1b2c-4d3e-8f01-000000000040')
    expect(parsed.storyDay).toBe('3.5')
    expect(parsed.body).toBe('Leah Voss locked the street door at ten.\n\nThe lamps counted themselves.')
  })

  it('round-trips a character with depth fields and relationships', () => {
    const doc: Doc = {
      ...blankDoc(ID, 'character', 'Leah Voss'),
      status: 'draft',
      role: 'Night librarian',
      summary: 'Keeps the library between close and open.',
      goal: 'Keep the night stack honest.',
      fear: 'That the drawer will stop opening.',
      secret: 'She borrowed an hour once.',
      relationships: [
        { characterId: '6f0c2a10-1b2c-4d3e-8f01-000000000012', note: 'Leaves notes for her, never letters.' },
        { characterId: '6f0c2a10-1b2c-4d3e-8f01-000000000013', note: '' },
      ],
      body: 'She counts the lamps when she is nervous.',
    }
    const parsed = roundTrip(doc)
    expect(parsed.role).toBe('Night librarian')
    expect(parsed.summary).toBe('Keeps the library between close and open.')
    expect(parsed.goal).toBe('Keep the night stack honest.')
    expect(parsed.fear).toBe('That the drawer will stop opening.')
    expect(parsed.secret).toBe('She borrowed an hour once.')
    expect(parsed.relationships).toEqual(doc.relationships)
    expect(parsed.body).toBe('She counts the lamps when she is nervous.')
  })

  it('round-trips keywords, dropping blanks', () => {
    const doc: Doc = {
      ...scene(),
      keywords: ['night', 'rewrite-2', '  ', ''],
    }
    const parsed = roundTrip(doc)
    expect(parsed.keywords).toEqual(['night', 'rewrite-2'])
  })

  it('round-trips a place with sense and control', () => {
    const doc: Doc = {
      ...blankDoc(ID, 'place', 'Pier Street Library'),
      placeType: 'Civic building',
      summary: 'Too large for the town, too loved to close.',
      sense: 'Lamplight, dry paper.',
      control: 'The street door.',
      body: 'The atlas stand has a wobble.',
    }
    const parsed = roundTrip(doc)
    expect(parsed.placeType).toBe('Civic building')
    expect(parsed.sense).toBe('Lamplight, dry paper.')
    expect(parsed.control).toBe('The street door.')
  })

  it('round-trips a chapter with a word goal', () => {
    const doc: Doc = {
      ...blankDoc(ID, 'chapter', 'After Close'),
      status: 'revised',
      synopsis: 'The night shift begins.',
      wordGoal: 1800,
    }
    const parsed = roundTrip(doc)
    expect(parsed.wordGoal).toBe(1800)
    expect(parsed.synopsis).toBe('The night shift begins.')
  })

  it('keeps unknown extra fields and drops invalid keys', () => {
    const doc: Doc = {
      ...scene(),
      extra: [
        { key: 'mood', value: 'Rain on the roof.' },
        { key: '1bad', value: 'dropped' },
        { key: 'title', value: 'should not overwrite' },
      ],
    }
    const parsed = roundTrip(doc)
    expect(parsed.extra).toEqual([{ key: 'mood', value: 'Rain on the roof.' }])
    expect(parsed.title).toBe('Keys')
  })

  it('survives quotes, colons, and backslashes in values', () => {
    const doc: Doc = {
      ...scene(),
      title: 'He said: "go back" \\ now',
      synopsis: 'A "quoted" synopsis: with colon',
    }
    const parsed = roundTrip(doc)
    expect(parsed.title).toBe('He said: "go back" \\ now')
    expect(parsed.synopsis).toBe('A "quoted" synopsis: with colon')
  })

  it('normalizes CRLF and strips a BOM', () => {
    const markdown = `\uFEFF---\r\ntitle: "Keys"\r\nkind: "scene"\r\nstatus: "draft"\r\n---\r\n\r\nBody line.\r\n`
    const parsed = parseDocument(markdown, blankDoc(ID, 'scene', 'Fallback'))
    expect(parsed.title).toBe('Keys')
    expect(parsed.body).toBe('Body line.\n')
  })

  it('treats text without a header as the body', () => {
    const parsed = parseDocument('Just prose, no header.', blankDoc(ID, 'scene', 'Fallback'))
    expect(parsed.body).toBe('Just prose, no header.')
    expect(parsed.title).toBe('Fallback')
  })

  it('falls back gracefully when the header never closes', () => {
    const parsed = parseDocument('---\ntitle: "Keys"\nbody drifts on', blankDoc(ID, 'scene', 'Fallback'))
    expect(parsed.title).toBe('Fallback')
    expect(parsed.body).toBe('---\ntitle: "Keys"\nbody drifts on')
  })

  it('accepts single-quoted values', () => {
    const markdown = '---\ntitle: \'Keys\'\nkind: "scene"\nstatus: "draft"\n---\n\nBody.'
    const parsed = parseDocument(markdown, blankDoc(ID, 'scene', 'Fallback'))
    expect(parsed.title).toBe('Keys')
  })

  it('falls back to the default status for unknown status values', () => {
    const markdown = '---\ntitle: "Keys"\nkind: "scene"\nstatus: "published"\n---\n\nBody.'
    const parsed = parseDocument(markdown, blankDoc(ID, 'scene', 'Fallback', 'revised'))
    expect(parsed.status).toBe('revised')
  })

  it('ignores relationship links whose id is not a UUID', () => {
    const doc: Doc = {
      ...blankDoc(ID, 'character', 'Leah'),
      relationships: [{ characterId: 'not-a-uuid', note: 'bad' }],
    }
    const parsed = roundTrip(doc)
    expect(parsed.relationships).toEqual([])
  })
})

describe('helpers', () => {
  it('isStatus matches known statuses only', () => {
    expect(isStatus('draft')).toBe(true)
    expect(isStatus('published')).toBe(false)
    expect(isStatus(undefined)).toBe(false)
  })

  it('documentKind separates files from shelves', () => {
    expect(documentKind('scene')).toBe(true)
    expect(documentKind('chapter')).toBe(true)
    expect(documentKind('part')).toBe(true)
    expect(documentKind('character')).toBe(true)
    expect(documentKind('place')).toBe(true)
    expect(documentKind('note')).toBe(true)
    expect(documentKind('manuscript')).toBe(false)
    expect(documentKind('characters')).toBe(false)
  })
})
