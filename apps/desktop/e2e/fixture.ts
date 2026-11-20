import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const ids = {
  manuscript: '11111111-1111-4111-8111-111111111111',
  chapter: '11111111-1111-4111-8111-111111111112',
  sceneA: '11111111-1111-4111-8111-111111111113',
  sceneB: '11111111-1111-4111-8111-111111111114',
  characters: '11111111-1111-4111-8111-111111111115',
  rook: '11111111-1111-4111-8111-111111111116',
  places: '11111111-1111-4111-8111-111111111117',
  library: '11111111-1111-4111-8111-111111111118',
  notes: '11111111-1111-4111-8111-111111111119',
  note: '11111111-1111-4111-8111-11111111111a',
  thread: '11111111-1111-4111-8111-11111111111b',
} as const

function documentFile(fields: string[], body: string): string {
  return `---\n${fields.join('\n')}\n---\n\n${body}`
}

/** Writes a small but complete Gather project to a temp folder. */
export async function createFixture(): Promise<string> {
  const root = join(tmpdir(), `gather-e2e-${randomUUID().slice(0, 8)}`)
  await mkdir(join(root, 'documents'), { recursive: true })

  const project = {
    format: 'gather-project',
    version: 1,
    title: 'E2E Novel',
    author: 'Test Author',
    wordGoal: 5000,
    threads: [{ id: ids.thread, name: 'The ledger', color: '#6e2e2e' }],
    history: {},
    created: '2026-01-01T00:00:00.000Z',
    modified: '2026-01-01T00:00:00.000Z',
    binder: [
      {
        id: ids.manuscript,
        kind: 'manuscript',
        title: 'Manuscript',
        children: [
          {
            id: ids.chapter,
            kind: 'chapter',
            title: 'First Chapter',
            children: [
              { id: ids.sceneA, kind: 'scene', title: 'Lamplight' },
              { id: ids.sceneB, kind: 'scene', title: 'The Ledger' },
            ],
          },
        ],
      },
      {
        id: ids.characters,
        kind: 'characters',
        title: 'Characters',
        children: [{ id: ids.rook, kind: 'character', title: 'Rook' }],
      },
      {
        id: ids.places,
        kind: 'places',
        title: 'Places',
        children: [{ id: ids.library, kind: 'place', title: 'The Library' }],
      },
      {
        id: ids.notes,
        kind: 'notes',
        title: 'Notes',
        children: [{ id: ids.note, kind: 'note', title: 'Continuity' }],
      },
    ],
  }

  const documents: Array<[string, string]> = [
    [
      `${ids.chapter}.md`,
      documentFile(
        ['title: "First Chapter"', 'kind: "chapter"', 'status: "draft"', 'synopsis: "One night, counted."'],
        '',
      ),
    ],
    [
      `${ids.sceneA}.md`,
      documentFile(
        [
          'title: "Lamplight"',
          'kind: "scene"',
          'status: "draft"',
          'synopsis: "The lamps are counted again."',
          `pov: "${ids.rook}"`,
          `location: "${ids.library}"`,
          `thread: "${ids.thread}"`,
          'day: "1"',
        ],
        'The lamps counted fourteen again, and Rook wrote the number down.',
      ),
    ],
    [
      `${ids.sceneB}.md`,
      documentFile(
        [
          'title: "The Ledger"',
          'kind: "scene"',
          'status: "revised"',
          'synopsis: "The ledger disagrees with the count."',
          `pov: "${ids.rook}"`,
          `location: "${ids.library}"`,
          'day: "2"',
        ],
        'Rook kept the ledger in his coat, away from the lamps.',
      ),
    ],
    [
      `${ids.rook}.md`,
      documentFile(
        [
          'title: "Rook"',
          'kind: "character"',
          'status: "revised"',
          'role: "Archivist"',
          'summary: "Counts what others miss."',
        ],
        'He trusts card catalogs more than people.',
      ),
    ],
    [
      `${ids.library}.md`,
      documentFile(
        ['title: "The Library"', 'kind: "place"', 'status: "done"', 'type: "Civic building"'],
        'One reading lamp never goes out.',
      ),
    ],
    [
      `${ids.note}.md`,
      documentFile(['title: "Continuity"', 'kind: "note"', 'status: "draft"', 'synopsis: "Rules."'], 'Never explain the drawer in chapter one.'),
    ],
  ]

  await writeFile(join(root, 'project.json'), `${JSON.stringify(project, null, 2)}\n`, 'utf8')
  for (const [name, text] of documents) {
    await writeFile(join(root, 'documents', name), text, 'utf8')
  }
  return root
}
