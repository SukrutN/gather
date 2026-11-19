import { documentKind, parseDocument } from './markdown'
import type { BinderNode, Doc, Kind, PlotThread, Project, SearchHit, Status } from './types'
import { KINDS } from './types'

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isKind(value: unknown): value is Kind {
  return typeof value === 'string' && (KINDS as readonly string[]).includes(value)
}

export function isContainer(kind: Kind): boolean {
  return (
    kind === 'manuscript' ||
    kind === 'part' ||
    kind === 'chapter' ||
    kind === 'characters' ||
    kind === 'places' ||
    kind === 'notes'
  )
}

export function isRootKind(kind: Kind): boolean {
  return kind === 'manuscript' || kind === 'characters' || kind === 'places' || kind === 'notes'
}

export function canContain(parent: Kind, child: Kind): boolean {
  if (parent === 'manuscript') return child === 'part' || child === 'chapter'
  if (parent === 'part') return child === 'chapter'
  if (parent === 'chapter') return child === 'scene'
  if (parent === 'characters') return child === 'character'
  if (parent === 'places') return child === 'place'
  if (parent === 'notes') return child === 'note'
  return false
}

export function kindLabel(kind: Kind): string {
  switch (kind) {
    case 'manuscript':
      return 'Manuscript'
    case 'part':
      return 'Part'
    case 'chapter':
      return 'Chapter'
    case 'scene':
      return 'Scene'
    case 'characters':
      return 'Characters'
    case 'character':
      return 'Character'
    case 'places':
      return 'Places'
    case 'place':
      return 'Place'
    case 'notes':
      return 'Notes'
    case 'note':
      return 'Note'
  }
}

export function defaultTitle(kind: Kind): string {
  switch (kind) {
    case 'part':
      return 'New part'
    case 'chapter':
      return 'New chapter'
    case 'scene':
      return 'New scene'
    case 'character':
      return 'New character'
    case 'place':
      return 'New place'
    case 'note':
      return 'New note'
    default:
      return 'Untitled'
  }
}

export function blankDoc(id: string, kind: Kind, title: string, status: Status = 'idea'): Doc {
  return {
    id,
    kind,
    title,
    status,
    synopsis: '',
    body: '',
    role: '',
    placeType: '',
    summary: '',
    pov: '',
    location: '',
    thread: '',
    storyDay: '',
    wordGoal: 0,
    goal: '',
    fear: '',
    secret: '',
    sense: '',
    control: '',
    relationships: [],
    extra: [],
  }
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function formatWords(count: number): string {
  const label = count.toLocaleString('en-US')
  return count === 1 ? `${label} word` : `${label} words`
}

export function displayTitle(title: string): string {
  const trimmed = title.trim()
  return trimmed || 'Untitled'
}

interface Location {
  node: BinderNode
  parent: BinderNode | null
}

export function locate(nodes: BinderNode[], id: string, parent: BinderNode | null = null): Location | null {
  for (const node of nodes) {
    if (node.id === id) return { node, parent }
    if (node.children) {
      const found = locate(node.children, id, node)
      if (found) return found
    }
  }
  return null
}

export function findNode(nodes: BinderNode[], id: string): BinderNode | null {
  return locate(nodes, id)?.node ?? null
}

export function collectScenes(node: BinderNode): BinderNode[] {
  if (node.kind === 'scene') return [node]
  return (node.children ?? []).flatMap(collectScenes)
}

export function collectDocumentIds(node: BinderNode): string[] {
  const ids: string[] = []
  const walk = (current: BinderNode): void => {
    if (documentKind(current.kind)) ids.push(current.id)
    current.children?.forEach(walk)
  }
  walk(node)
  return ids
}

export function insertChild(nodes: BinderNode[], parentId: string, child: BinderNode): BinderNode[] {
  return nodes.map((node) => {
    if (node.id === parentId) return { ...node, children: [...(node.children ?? []), child] }
    if (!node.children) return node
    return { ...node, children: insertChild(node.children, parentId, child) }
  })
}

export function renameBinder(nodes: BinderNode[], id: string, title: string): BinderNode[] {
  return nodes.map((node) => {
    if (node.id === id) return { ...node, title }
    if (!node.children) return node
    return { ...node, children: renameBinder(node.children, id, title) }
  })
}

export function deleteBinderNode(nodes: BinderNode[], id: string): BinderNode[] {
  const next: BinderNode[] = []
  for (const node of nodes) {
    if (node.id === id) continue
    if (node.children) next.push({ ...node, children: deleteBinderNode(node.children, id) })
    else next.push(node)
  }
  return next
}

export function moveBinderNode(binder: BinderNode[], id: string, direction: -1 | 1): BinderNode[] {
  const copy = structuredClone(binder)
  const loc = locate(copy, id)
  if (!loc?.parent?.children) return binder
  const index = loc.parent.children.findIndex((node) => node.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= loc.parent.children.length) return binder
  const [item] = loc.parent.children.splice(index, 1)
  if (!item) return binder
  loc.parent.children.splice(target, 0, item)
  return copy
}

export function canMove(binder: BinderNode[], id: string, direction: -1 | 1): boolean {
  const loc = locate(binder, id)
  if (!loc?.parent?.children) return false
  const index = loc.parent.children.findIndex((node) => node.id === id)
  const target = index + direction
  return index >= 0 && target >= 0 && target < loc.parent.children.length
}

export function canDelete(binder: BinderNode[], id: string): boolean {
  const loc = locate(binder, id)
  if (!loc?.parent) return false
  return !isRootKind(loc.node.kind)
}

export interface AddChoice {
  parentId: string
  kind: Kind
  label: string
}

function choicesFor(kind: Kind): Array<{ kind: Kind; label: string }> {
  switch (kind) {
    case 'manuscript':
      return [
        { kind: 'part', label: 'Add part' },
        { kind: 'chapter', label: 'Add chapter' },
      ]
    case 'part':
      return [{ kind: 'chapter', label: 'Add chapter' }]
    case 'chapter':
      return [{ kind: 'scene', label: 'Add scene' }]
    case 'characters':
      return [{ kind: 'character', label: 'Add character' }]
    case 'places':
      return [{ kind: 'place', label: 'Add place' }]
    case 'notes':
      return [{ kind: 'note', label: 'Add note' }]
    default:
      return []
  }
}

export function addChoicesForSelection(binder: BinderNode[], selectedId: string | null): AddChoice[] {
  if (!selectedId) {
    const manuscript = binder.find((node) => node.kind === 'manuscript')
    if (!manuscript) return []
    return choicesFor(manuscript.kind).map((choice) => ({ parentId: manuscript.id, ...choice }))
  }
  const loc = locate(binder, selectedId)
  if (!loc) return []
  const own = choicesFor(loc.node.kind).map((choice) => ({ parentId: loc.node.id, ...choice }))
  if (!loc.parent) return own
  const siblingKind = loc.node.kind
  const siblings = choicesFor(loc.parent.kind)
    .filter((choice) => choice.kind === siblingKind)
    .map((choice) => ({ parentId: loc.parent?.id ?? '', ...choice }))
    .filter((choice) => choice.parentId && !own.some((item) => item.kind === choice.kind && item.parentId === choice.parentId))
  return [...own, ...siblings]
}

export function manuscriptOf(project: Project): BinderNode | null {
  return project.binder.find((node) => node.kind === 'manuscript') ?? null
}

export function chapterWordCount(chapter: BinderNode, docs: Record<string, Doc>): number {
  let total = countWords(docs[chapter.id]?.body ?? '')
  for (const scene of collectScenes(chapter)) total += countWords(docs[scene.id]?.body ?? '')
  return total
}

export function scenesWhere(
  project: Project,
  docs: Record<string, Doc>,
  field: 'pov' | 'location',
  id: string,
): BinderNode[] {
  const manuscript = manuscriptOf(project)
  if (!manuscript || !id) return []
  return collectScenes(manuscript).filter((scene) => docs[scene.id]?.[field] === id)
}

export function searchProject(project: Project, docs: Record<string, Doc>, query: string): SearchHit[] {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return []
  const hits: SearchHit[] = []
  const walk = (nodes: BinderNode[]): void => {
    for (const node of nodes) {
      if (hits.length >= 24) return
      const doc = docs[node.id]
      const hay = [
        node.title,
        doc?.title,
        doc?.synopsis,
        doc?.summary,
        doc?.body,
        doc?.goal,
        doc?.fear,
        doc?.secret,
        doc?.sense,
        doc?.role,
        doc?.storyDay,
      ]
        .filter((part): part is string => Boolean(part))
        .join('\n')
      const index = hay.toLowerCase().indexOf(needle)
      if (index >= 0 && documentKind(node.kind)) {
        const start = Math.max(0, index - 28)
        hits.push({
          id: node.id,
          title: displayTitle(doc?.title || node.title),
          kind: node.kind,
          snippet: hay.slice(start, index + needle.length + 42).replace(/\s+/g, ' ').trim(),
        })
      }
      if (node.children) walk(node.children)
    }
  }
  walk(project.binder)
  return hits
}

export function manuscriptWordCount(project: Project, docs: Record<string, Doc>): number {
  const manuscript = manuscriptOf(project)
  if (!manuscript) return 0
  let total = 0
  const walk = (node: BinderNode): void => {
    if (node.kind === 'part' || node.kind === 'chapter' || node.kind === 'scene') {
      total += countWords(docs[node.id]?.body ?? '')
    }
    node.children?.forEach(walk)
  }
  walk(manuscript)
  return total
}

export function compilableIds(project: Project): string[] {
  const manuscript = manuscriptOf(project)
  if (!manuscript) return []
  const ids: string[] = []
  const walk = (node: BinderNode): void => {
    if (node.kind === 'part' || node.kind === 'chapter' || node.kind === 'scene') ids.push(node.id)
    node.children?.forEach(walk)
  }
  walk(manuscript)
  return ids
}

export function subtreeCompilableIds(node: BinderNode): string[] {
  const ids: string[] = []
  const walk = (current: BinderNode): void => {
    if (current.kind === 'part' || current.kind === 'chapter' || current.kind === 'scene') ids.push(current.id)
    current.children?.forEach(walk)
  }
  walk(node)
  return ids
}

export function initialSelection(project: Project): string | null {
  const manuscript = manuscriptOf(project)
  if (!manuscript) return project.binder[0]?.id ?? null
  const scenes = collectScenes(manuscript)
  return scenes[0]?.id ?? manuscript.id
}

export function deleteDetail(node: BinderNode): string {
  const scenes = node.kind === 'scene' ? 0 : collectScenes(node).length
  if (node.kind === 'part') return 'This deletes the part and everything in it.'
  if (node.kind === 'chapter') {
    return scenes
      ? `This deletes the chapter and ${scenes} ${scenes === 1 ? 'scene' : 'scenes'} in it.`
      : 'This deletes the chapter.'
  }
  if (node.kind === 'scene') return 'This deletes the scene.'
  if (node.kind === 'character') return 'This deletes the character.'
  if (node.kind === 'place') return 'This deletes the place.'
  if (node.kind === 'note') return 'This deletes the note.'
  return 'This deletes it, and anything inside it.'
}

function parseNode(data: unknown): BinderNode {
  if (!data || typeof data !== 'object') throw new Error('A binder item is invalid.')
  const record = data as Record<string, unknown>
  if (typeof record.id !== 'string' || !ID_RE.test(record.id)) {
    throw new Error('A binder item has an invalid id. Gather ids are UUIDs.')
  }
  if (typeof record.title !== 'string') throw new Error('A binder item is missing a title.')
  if (!isKind(record.kind)) throw new Error('A binder item has an unknown kind.')
  const node: BinderNode = { id: record.id, title: record.title, kind: record.kind }
  if (record.children !== undefined) {
    if (!Array.isArray(record.children)) throw new Error('Binder children must be a list.')
    node.children = record.children.map(parseNode)
  } else if (isContainer(record.kind)) {
    node.children = []
  }
  return node
}

function assertUnique(nodes: BinderNode[]): void {
  const seen = new Set<string>()
  const walk = (list: BinderNode[]): void => {
    for (const node of list) {
      if (seen.has(node.id)) throw new Error('The binder repeats an id.')
      seen.add(node.id)
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
}

const THREAD_COLOR = /^#[0-9a-fA-F]{6}$/

export const THREAD_COLORS = ['#6e2e2e', '#3f5344', '#7a5b32', '#1c1915', '#5c4a62'] as const

function positiveInt(value: unknown): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(number) || number <= 0) return 0
  return Math.round(number)
}

function parseThreads(value: unknown): PlotThread[] {
  if (!Array.isArray(value)) return []
  const threads: PlotThread[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || !ID_RE.test(record.id) || typeof record.name !== 'string') continue
    threads.push({
      id: record.id,
      name: record.name,
      color: typeof record.color === 'string' && THREAD_COLOR.test(record.color) ? record.color : THREAD_COLORS[0],
    })
  }
  return threads
}

export function parseProject(data: unknown): Project {
  if (!data || typeof data !== 'object') throw new Error('project.json is not an object.')
  const record = data as Record<string, unknown>
  if (record.format !== 'gather-project') throw new Error('This folder is not a Gather project.')
  if (record.version !== 1) throw new Error('This Gather project uses an unsupported version.')
  if (typeof record.title !== 'string' || typeof record.author !== 'string') {
    throw new Error('project.json needs a title and an author.')
  }
  if (!Array.isArray(record.binder)) throw new Error('project.json is missing a binder.')
  const binder = record.binder.map(parseNode)
  assertUnique(binder)
  for (const kind of ['manuscript', 'characters', 'places', 'notes'] as const) {
    if (!binder.some((node) => node.kind === kind)) {
      throw new Error(`The binder is missing its ${kind} shelf.`)
    }
  }
  return {
    format: 'gather-project',
    version: 1,
    title: record.title,
    author: record.author,
    wordGoal: positiveInt(record.wordGoal),
    threads: parseThreads(record.threads),
    created: typeof record.created === 'string' ? record.created : new Date().toISOString(),
    modified: typeof record.modified === 'string' ? record.modified : new Date().toISOString(),
    binder,
  }
}

export function createEmptyProject(title = 'Untitled Novel', author = ''): Project {
  const now = new Date().toISOString()
  const shelf = (kind: Kind, label: string): BinderNode => ({
    id: crypto.randomUUID(),
    kind,
    title: label,
    children: [],
  })
  return {
    format: 'gather-project',
    version: 1,
    title,
    author,
    wordGoal: 0,
    threads: [],
    created: now,
    modified: now,
    binder: [
      shelf('manuscript', 'Manuscript'),
      shelf('characters', 'Characters'),
      shelf('places', 'Places'),
      shelf('notes', 'Notes'),
    ],
  }
}

export interface HydratedProject {
  project: Project
  docs: Record<string, Doc>
  missing: boolean
  titlesChanged: boolean
}

export function hydrate(project: Project, files: Array<{ id: string; markdown: string }>): HydratedProject {
  const byId = new Map(files.map((file) => [file.id, file.markdown]))
  const docs: Record<string, Doc> = {}
  let missing = false
  let titlesChanged = false
  const binder = structuredClone(project.binder)

  const walk = (nodes: BinderNode[]): void => {
    for (const node of nodes) {
      if (documentKind(node.kind)) {
        const markdown = byId.get(node.id)
        if (markdown === undefined) missing = true
        const doc = parseDocument(markdown ?? '', blankDoc(node.id, node.kind, node.title))
        doc.kind = node.kind
        docs[node.id] = doc
        if (doc.title !== node.title) {
          node.title = doc.title
          titlesChanged = true
        }
      }
      if (node.children) walk(node.children)
    }
  }
  walk(binder)
  return { project: { ...project, binder }, docs, missing, titlesChanged }
}

export function safeFileBase(title: string): string {
  const cleaned = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || 'Untitled Novel'
}
