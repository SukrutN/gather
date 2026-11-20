import { describe, expect, it } from 'vitest'
import { serializeDocument } from './markdown'
import {
  blankDoc,
  bumpHistory,
  canContain,
  collectScenes,
  createEmptyProject,
  dayKey,
  deleteBinderNode,
  duplicateSubtree,
  findNode,
  hydrate,
  insertAfter,
  insertChild,
  isContainer,
  isRootKind,
  kindLabel,
  locate,
  manuscriptWordCount,
  moveNode,
  outlineRows,
  parseProject,
  projectStats,
  searchProject,
  storyDayNumber,
  subtreeWordCount,
  timelineRows,
  writingStreak,
} from './model'
import { createSample } from './sample'
import type { BinderNode, Doc, Project } from './types'

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let counter = 0
function uuid(): string {
  counter += 1
  const tail = String(counter).padStart(12, '0')
  return `6f0c2a10-1b2c-4d3e-8f01-${tail}`
}

function node(id: string, kind: BinderNode['kind'], title: string, children?: BinderNode[]): BinderNode {
  return children ? { id, kind, title, children } : { id, kind, title }
}

function shelf(kind: BinderNode['kind'], children: BinderNode[]): BinderNode {
  return node(uuid(), kind, kind.charAt(0).toUpperCase() + kind.slice(1), children)
}

function docFor(id: string, body = '', patch: Partial<Doc> = {}): Doc {
  return { ...blankDoc(id, 'scene', 'X'), body, ...patch }
}

function buildProject(): { project: Project; docs: Record<string, Doc> } {
  const chapter1 = node(uuid(), 'chapter', 'After Close', [node(uuid(), 'scene', 'Keys', undefined)])
  const scene1 = chapter1.children![0]!
  const chapter2 = node(uuid(), 'chapter', 'Borrowed Time', [node(uuid(), 'scene', 'One Hour', undefined)])
  const scene2 = chapter2.children![0]!
  const manuscript = shelf('manuscript', [chapter1, chapter2])
  const characters = shelf('characters', [node(uuid(), 'character', 'Leah')])
  const places = shelf('places', [node(uuid(), 'place', 'Library')])
  const notes = shelf('notes', [node(uuid(), 'note', 'Rules')])
  const project: Project = {
    format: 'gather-project',
    version: 1,
    title: 'The Keep of Small Hours',
    author: 'N. Hale',
    wordGoal: 30000,
    threads: [{ id: uuid(), name: 'The slipped hour', color: '#6e2e2e' }],
    history: { '2026-01-08': 500 },
    created: '2026-01-08T00:40:00.000Z',
    modified: '2026-01-08T00:40:00.000Z',
    binder: [manuscript, characters, places, notes],
  }
  const docs: Record<string, Doc> = {
    [chapter1.id]: docFor(chapter1.id, 'chapter words', { kind: 'chapter', title: 'After Close' }),
    [scene1.id]: docFor(scene1.id, 'one two three four five', {
      synopsis: 'She locks up.',
      storyDay: '2',
    }),
    [chapter2.id]: docFor(chapter2.id, '', { kind: 'chapter', title: 'Borrowed Time' }),
    [scene2.id]: docFor(scene2.id, 'six seven', { storyDay: '1' }),
    [characters.children![0]!.id]: docFor(characters.children![0]!.id, 'notes about leah', {
      kind: 'character',
      title: 'Leah',
    }),
    [places.children![0]!.id]: docFor(places.children![0]!.id, '', { kind: 'place', title: 'Library' }),
    [notes.children![0]!.id]: docFor(notes.children![0]!.id, 'the drawer lends hours', {
      kind: 'note',
      title: 'Rules',
    }),
  }
  return { project, docs }
}

describe('parseProject', () => {
  it('reads a full project with goal, threads, and history', () => {
    const { project } = buildProject()
    const parsed = parseProject(JSON.parse(JSON.stringify(project)))
    expect(parsed.title).toBe('The Keep of Small Hours')
    expect(parsed.author).toBe('N. Hale')
    expect(parsed.wordGoal).toBe(30000)
    expect(parsed.threads).toHaveLength(1)
    expect(parsed.history).toEqual({ '2026-01-08': 500 })
    expect(parsed.binder).toHaveLength(4)
  })

  it('rejects the wrong format and version', () => {
    const { project } = buildProject()
    expect(() => parseProject({ ...project, format: 'other' })).toThrow('not a Gather project')
    expect(() => parseProject({ ...project, version: 2 })).toThrow('unsupported version')
  })

  it('requires title, author, and a binder', () => {
    const { project } = buildProject()
    expect(() => parseProject({ ...project, title: 7, author: '' })).toThrow()
    expect(() => parseProject({ ...project, binder: 'nope' })).toThrow('missing a binder')
  })

  it('requires all four shelves', () => {
    const { project } = buildProject()
    const missing = { ...project, binder: project.binder.filter((node) => node.kind !== 'notes') }
    expect(() => parseProject(missing)).toThrow('missing its notes shelf')
  })

  it('rejects duplicate ids and non-UUID ids', () => {
    const { project } = buildProject()
    const doubled = structuredClone(project)
    const manuscript = doubled.binder.find((n) => n.kind === 'manuscript')!
    manuscript.children![0]!.id = manuscript.children![1]!.id
    expect(() => parseProject(doubled)).toThrow('repeats an id')

    const badId = structuredClone(project)
    badId.binder[0]!.id = 'not-a-uuid'
    expect(() => parseProject(badId)).toThrow('UUID')
  })

  it('drops malformed history entries and threads', () => {
    const { project } = buildProject()
    const messy = {
      ...project,
      history: { '2026-01-08': 400, 'not-a-day': 5, '2026-13-99': 'x', '2026-01-09': 0 },
      threads: [{ id: 'junk', name: 'x' }, { id: uuid(), name: 'Ledger', color: 'red' }],
    }
    const parsed = parseProject(messy)
    expect(parsed.history).toEqual({ '2026-01-08': 400 })
    expect(parsed.threads).toEqual([{ id: parsed.threads[0]!.id, name: 'Ledger', color: '#6e2e2e' }])
  })
})

describe('createEmptyProject', () => {
  it('makes five shelves with UUID ids and empty history', () => {
    const project = createEmptyProject('New', 'Me')
    expect(project.binder.map((node) => node.kind)).toEqual([
      'manuscript',
      'characters',
      'places',
      'notes',
      'research',
    ])
    expect(project.history).toEqual({})
    for (const node of project.binder) expect(ID_RE.test(node.id)).toBe(true)
  })
})

describe('research shelf', () => {
  it('holds files and nothing else', () => {
    expect(isContainer('research')).toBe(true)
    expect(isRootKind('research')).toBe(true)
    expect(canContain('research', 'file')).toBe(true)
    expect(canContain('research', 'scene')).toBe(false)
    expect(canContain('manuscript', 'file')).toBe(false)
    expect(kindLabel('file')).toBe('File')
  })

  it('is added to older projects on hydrate', () => {
    const { project, docs } = buildProject()
    const older: Project = {
      ...project,
      binder: project.binder.filter((node) => node.kind !== 'research'),
    }
    const files = Object.entries(docs).map(([id, doc]) => ({ id, markdown: serializeDocument(doc) }))
    const hydrated = hydrate(older, files)
    const shelf = hydrated.project.binder.find((node) => node.kind === 'research')
    expect(shelf).toBeDefined()
    expect(shelf?.children).toEqual([])
  })
})

describe('binder operations', () => {
  it('inserts children and after-siblings', () => {
    const { project } = buildProject()
    const manuscript = project.binder[0]!
    const chapter1 = manuscript.children![0]!
    const fresh = node(uuid(), 'chapter', 'Fresh')
    const withChild = insertChild(project.binder, chapter1.id, fresh)
    expect(findNode(withChild, chapter1.id)!.children).toHaveLength(2)
    const withSibling = insertAfter(withChild, chapter1.id, node(uuid(), 'chapter', 'Sibling'))
    const order = findNode(withSibling, manuscript.id)!.children!.map((child) => child.title)
    expect(order).toEqual(['After Close', 'Sibling', 'Borrowed Time'])
  })

  it('deletes subtrees', () => {
    const { project } = buildProject()
    const manuscript = project.binder[0]!
    const chapter1 = manuscript.children![0]!
    const next = deleteBinderNode(project.binder, chapter1.id)
    expect(findNode(next, chapter1.id)).toBeNull()
    expect(findNode(next, manuscript.id)!.children).toHaveLength(1)
  })

  it('knows the container rules', () => {
    expect(isContainer('chapter')).toBe(true)
    expect(canContain('manuscript', 'chapter')).toBe(true)
    expect(canContain('chapter', 'scene')).toBe(true)
    expect(canContain('chapter', 'chapter')).toBe(false)
    expect(canContain('characters', 'note')).toBe(false)
  })

  it('locates nodes with parents', () => {
    const { project } = buildProject()
    const scene = project.binder[0]!.children![0]!.children![0]!
    const loc = locate(project.binder, scene.id)
    expect(loc?.node.kind).toBe('scene')
    expect(loc?.parent?.kind).toBe('chapter')
    expect(locate(project.binder, 'missing')).toBeNull()
  })
})

describe('moveNode (drag and drop rules)', () => {
  it('drops a scene after another scene', () => {
    const { project } = buildProject()
    const scene1 = project.binder[0]!.children![0]!.children![0]!
    const scene2 = project.binder[0]!.children![1]!.children![0]!
    const next = moveNode(project.binder, scene2.id, scene1.id, 'after')
    const chapter1 = findNode(next, project.binder[0]!.children![0]!.id)!
    expect(chapter1.children!.map((child) => child.title)).toEqual(['Keys', 'One Hour'])
  })

  it('drops a scene inside a chapter', () => {
    const { project } = buildProject()
    const scene2 = project.binder[0]!.children![1]!.children![0]!
    const chapter1 = project.binder[0]!.children![0]!
    const next = moveNode(project.binder, scene2.id, chapter1.id, 'inside')
    expect(findNode(next, chapter1.id)!.children).toHaveLength(2)
  })

  it('moves a chapter between parts of different parents', () => {
    const { project } = buildProject()
    const part = node(uuid(), 'part', 'Part One', [node(uuid(), 'chapter', 'Inner')])
    const manuscript = findNode(project.binder, project.binder[0]!.id)!
    const withPart: BinderNode[] = [
      { ...manuscript, children: [part, ...manuscript.children!] },
      ...project.binder.slice(1),
    ]
    const chapter2 = manuscript.children!.find((child) => child.title === 'Borrowed Time')!
    const next = moveNode(withPart, chapter2.id, part.id, 'inside')
    expect(findNode(next, part.id)!.children!.map((child) => child.title)).toEqual(['Inner', 'Borrowed Time'])
  })

  it('refuses to drop a node into its own subtree', () => {
    const { project } = buildProject()
    const part = node(uuid(), 'part', 'Part One', [project.binder[0]!.children![0]!])
    const manuscript = findNode(project.binder, project.binder[0]!.id)!
    const withPart: BinderNode[] = [
      { ...manuscript, children: [part, ...manuscript.children!.slice(1)] },
      ...project.binder.slice(1),
    ]
    const result = moveNode(withPart, part.id, part.children![0]!.id, 'inside')
    expect(result).toBe(withPart)
  })

  it('refuses illegal kinds, roots, and self-drops', () => {
    const { project } = buildProject()
    const characters = project.binder[1]!
    const scene1 = project.binder[0]!.children![0]!.children![0]!
    expect(moveNode(project.binder, scene1.id, characters.id, 'inside')).toBe(project.binder)
    expect(moveNode(project.binder, characters.id, scene1.id, 'after')).toBe(project.binder)
    expect(moveNode(project.binder, scene1.id, scene1.id, 'after')).toBe(project.binder)
  })
})

describe('duplicateSubtree', () => {
  it('copies a chapter with its scenes under fresh ids', () => {
    const { project, docs } = buildProject()
    const chapter1 = project.binder[0]!.children![0]!
    const copy = duplicateSubtree(chapter1, docs)
    expect(copy.node.title).toBe('After Close (copy)')
    expect(copy.node.id).not.toBe(chapter1.id)
    expect(ID_RE.test(copy.node.id)).toBe(true)
    expect(copy.node.children).toHaveLength(1)
    const child = copy.node.children![0]!
    expect(child.title).toBe('Keys')
    expect(child.id).not.toBe(chapter1.children![0]!.id)
    expect(copy.docs).toHaveLength(2)
    for (const doc of copy.docs) {
      expect(doc.id === copy.node.id || doc.id === child.id).toBe(true)
      expect(docs[doc.id]).toBeUndefined()
    }
    expect(copy.docs.find((doc) => doc.id === copy.node.id)!.title).toBe('After Close (copy)')
  })
})

describe('history, streak, and stats', () => {
  it('keys days as local dates', () => {
    expect(dayKey(new Date(2026, 0, 8))).toBe('2026-01-08')
    expect(dayKey(new Date(2026, 10, 5))).toBe('2026-11-05')
  })

  it('bumps, cancels, and prunes history', () => {
    let history: Record<string, number> = {}
    history = bumpHistory(history, '2026-01-08', 400)
    history = bumpHistory(history, '2026-01-08', 100)
    expect(history).toEqual({ '2026-01-08': 500 })
    history = bumpHistory(history, '2026-01-08', -500)
    expect(history).toEqual({})
  })

  it('counts streaks through today or yesterday', () => {
    const today = new Date(2026, 0, 10)
    const history: Record<string, number> = {
      '2026-01-07': 10,
      '2026-01-08': 10,
      '2026-01-09': 10,
    }
    expect(writingStreak(history, today)).toBe(3)
    expect(writingStreak({ '2026-01-09': 10 }, today)).toBe(1)
    expect(writingStreak({ '2026-01-08': 10 }, today)).toBe(0)
    expect(writingStreak({ '2026-01-07': 10, '2026-01-08': 10 }, today)).toBe(0)
  })

  it('sums project stats from the manuscript only', () => {
    const { project, docs } = buildProject()
    const today = new Date(2026, 0, 8)
    const withToday = { ...project, history: { '2026-01-08': 500, '2026-01-07': 200 } }
    const stats = projectStats(withToday, docs, today)
    expect(stats.total).toBe(9)
    expect(stats.goal).toBe(30000)
    expect(stats.today).toBe(500)
    expect(stats.streak).toBe(2)
    expect(stats.scenesTotal).toBe(2)
    expect(stats.last7).toHaveLength(7)
    expect(stats.last7[6]!.day).toBe('2026-01-08')
  })
})

describe('outline and timeline', () => {
  it('outlines in binder order with subtree word counts', () => {
    const { project, docs } = buildProject()
    const rows = outlineRows(project, docs)
    expect(rows.map((row) => row.kind)).toEqual(['chapter', 'scene', 'chapter', 'scene'])
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 0, 1])
    const chapterRow = rows[0]!
    expect(chapterRow.words).toBe(7) // own 2 words + scene 5 words
    expect(rows[1]!.words).toBe(5)
    expect(rows[1]!.day).toBe('2')
  })

  it('sorts the timeline by story day, undated scenes last', () => {
    const { project, docs } = buildProject()
    const rows = timelineRows(project, docs)
    expect(rows.map((row) => row.day)).toEqual(['1', '2'])
    expect(rows[0]!.chapter).toBe('Borrowed Time')
    const extra = { ...docs }
    const undated = node(uuid(), 'scene', 'Undated')
    const manuscript = findNode(project.binder, project.binder[0]!.id)!
    extra[undated.id] = docFor(undated.id, '')
    const binder: BinderNode[] = [
      { ...manuscript, children: [...manuscript.children!, node(uuid(), 'chapter', 'C3', [undated])] },
      ...project.binder.slice(1),
    ]
    const sorted = timelineRows({ ...project, binder }, extra)
    expect(sorted.map((row) => row.day)).toEqual(['1', '2', ''])
  })

  it('parses story day numbers loosely', () => {
    expect(storyDayNumber('3')).toBe(3)
    expect(storyDayNumber('3.5')).toBe(3.5)
    expect(storyDayNumber('day 4')).toBe(null)
    expect(storyDayNumber('')).toBe(null)
    expect(storyDayNumber('-2')).toBe(-2)
  })
})

describe('search', () => {
  it('finds text in bodies and synopses with snippets', () => {
    const { project, docs } = buildProject()
    const hits = searchProject(project, docs, 'drawer')
    expect(hits.map((hit) => hit.kind)).toEqual(['note'])
    expect(hits[0]!.snippet).toContain('drawer')
    expect(searchProject(project, docs, 'locks')).toHaveLength(1)
    expect(searchProject(project, docs, 'x')).toHaveLength(0)
  })

  it('finds keywords attached to pages', () => {
    const { project, docs } = buildProject()
    const scene1 = project.binder[0]!.children![0]!.children![0]!
    const tagged = {
      ...docs,
      [scene1.id]: { ...docs[scene1.id]!, keywords: ['needle-plot'] },
    }
    expect(searchProject(project, tagged, 'needle-plot')).toHaveLength(1)
  })

  it('caps results at 24', () => {
    const { project } = buildProject()
    const docs: Record<string, Doc> = {}
    const scenes: BinderNode[] = []
    for (let index = 0; index < 30; index += 1) {
      const scene = node(uuid(), 'scene', `Scene ${index}`)
      docs[scene.id] = docFor(scene.id, 'needle in the prose')
      scenes.push(scene)
    }
    const manuscript = findNode(project.binder, project.binder[0]!.id)!
    const padded: BinderNode[] = [
      { ...manuscript, children: scenes },
      ...project.binder.slice(1),
    ]
    const hits = searchProject({ ...project, binder: padded }, docs, 'needle')
    expect(hits).toHaveLength(24)
  })
})

describe('hydrate', () => {
  it('syncs titles from files into the binder and flags missing files', () => {
    const { project, docs } = buildProject()
    const chapter1 = project.binder[0]!.children![0]!
    const scene1 = chapter1.children![0]!
    const markdownOf = (id: string): string | undefined => {
      const doc = docs[id]
      return doc
        ? `---\ntitle: "Renamed ${id}"\nkind: "${doc.kind}"\nstatus: "draft"\n---\n\n${doc.body}`
        : undefined
    }
    const files = Object.keys(docs)
      .filter((id) => id !== scene1.id)
      .map((id) => ({ id, markdown: markdownOf(id) ?? '' }))
    const hydrated = hydrate(project, files)
    expect(hydrated.missing).toBe(true)
    expect(hydrated.titlesChanged).toBe(true)
    expect(findNode(hydrated.project.binder, chapter1.id)!.title).toBe(`Renamed ${chapter1.id}`)
    expect(findNode(hydrated.project.binder, scene1.id)!.title).toBe('Keys')
    for (const id of Object.keys(docs)) {
      expect(hydrated.docs[id]).toBeDefined()
    }
  })
})

describe('word counts', () => {
  it('counts manuscript words including chapters and scenes', () => {
    const { project, docs } = buildProject()
    expect(manuscriptWordCount(project, docs)).toBe(9)
    expect(subtreeWordCount(project.binder[0]!, docs)).toBe(9)
    expect(collectScenes(project.binder[0]!)).toHaveLength(2)
  })
})

describe('the sample novel', () => {
  it('ships with goal, threads, and scene metadata', () => {
    const { project, docs } = createSample()
    expect(project.wordGoal).toBeGreaterThan(0)
    expect(project.threads.length).toBeGreaterThan(0)
    const manuscript = project.binder.find((node) => node.kind === 'manuscript')!
    const scenes = collectScenes(manuscript)
    const withPov = scenes.filter((scene) => docs[scene.id]?.pov)
    expect(withPov.length).toBe(scenes.length)
    for (const scene of scenes) {
      const doc = docs[scene.id]!
      if (doc.thread) {
        expect(project.threads.some((thread) => thread.id === doc.thread)).toBe(true)
      }
    }
    const seen = new Set<string>()
    const walk = (nodes: BinderNode[]): void => {
      for (const current of nodes) {
        expect(seen.has(current.id)).toBe(false)
        seen.add(current.id)
        if (current.children) walk(current.children)
      }
    }
    walk(project.binder)
  })
})
