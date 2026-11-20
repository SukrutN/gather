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
    kind === 'notes' ||
    kind === 'research'
  )
}

export function isRootKind(kind: Kind): boolean {
  return (
    kind === 'manuscript' ||
    kind === 'characters' ||
    kind === 'places' ||
    kind === 'notes' ||
    kind === 'research'
  )
}

export function canContain(parent: Kind, child: Kind): boolean {
  if (parent === 'manuscript') return child === 'part' || child === 'chapter'
  if (parent === 'part') return child === 'chapter'
  if (parent === 'chapter') return child === 'scene'
  if (parent === 'characters') return child === 'character'
  if (parent === 'places') return child === 'place'
  if (parent === 'notes') return child === 'note'
  if (parent === 'research') return child === 'file'
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
    case 'research':
      return 'Research'
    case 'file':
      return 'File'
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
    case 'file':
      return 'New file'
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
    keywords: [],
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
        doc?.keywords.join('\n'),
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

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export function parseHistory(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const history: Record<string, number> = {}
  for (const [day, words] of Object.entries(value as Record<string, unknown>)) {
    if (!DAY_KEY.test(day)) continue
    const count = typeof words === 'number' ? words : Number(words)
    if (Number.isFinite(count) && count !== 0) history[day] = Math.round(count)
  }
  return history
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
    history: parseHistory(record.history),
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
    history: {},
    created: now,
    modified: now,
    binder: [
      shelf('manuscript', 'Manuscript'),
      shelf('characters', 'Characters'),
      shelf('places', 'Places'),
      shelf('notes', 'Notes'),
      shelf('research', 'Research'),
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

  // Projects made before the research shelf existed get it added here, so
  // every open project can hold research files. It is structural only.
  if (!binder.some((node) => node.kind === 'research')) {
    binder.push({ id: crypto.randomUUID(), kind: 'research', title: 'Research', children: [] })
  }

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

export function subtreeWordCount(node: BinderNode, docs: Record<string, Doc>): number {
  let total = documentKind(node.kind) ? countWords(docs[node.id]?.body ?? '') : 0
  for (const child of node.children ?? []) total += subtreeWordCount(child, docs)
  return total
}

export function dayKey(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function bumpHistory(history: Record<string, number>, key: string, delta: number): Record<string, number> {
  if (!delta) return history
  const next = { ...history }
  const value = (next[key] ?? 0) + delta
  if (value === 0) delete next[key]
  else next[key] = value
  return next
}

export function writingStreak(history: Record<string, number>, today = new Date()): number {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!(history[dayKey(cursor)] > 0)) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while ((history[dayKey(cursor)] ?? 0) > 0) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export interface ProjectStats {
  total: number
  goal: number
  today: number
  streak: number
  scenesDone: number
  scenesTotal: number
  last7: Array<{ day: string; words: number }>
}

export function projectStats(project: Project, docs: Record<string, Doc>, today = new Date()): ProjectStats {
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const last7: Array<{ day: string; words: number }> = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(cursor)
    day.setDate(cursor.getDate() - offset)
    const key = dayKey(day)
    last7.push({ day: key, words: project.history[key] ?? 0 })
  }
  const manuscript = manuscriptOf(project)
  const scenes = manuscript ? collectScenes(manuscript) : []
  const scenesDone = scenes.filter((scene) => docs[scene.id]?.status === 'done').length
  return {
    total: manuscriptWordCount(project, docs),
    goal: project.wordGoal,
    today: project.history[dayKey(cursor)] ?? 0,
    streak: writingStreak(project.history, cursor),
    scenesDone,
    scenesTotal: scenes.length,
    last7,
  }
}

export interface Duplicated {
  node: BinderNode
  docs: Doc[]
}

export function duplicateSubtree(node: BinderNode, docs: Record<string, Doc>): Duplicated {
  const copied: Doc[] = []
  const clone = (current: BinderNode): BinderNode => {
    const id = crypto.randomUUID()
    const doc = docs[current.id]
    if (doc) copied.push({ ...doc, id })
    const next: BinderNode = { id, kind: current.kind, title: current.title }
    if (current.children) next.children = current.children.map(clone)
    return next
  }
  const copy = clone(node)
  copy.title = `${displayTitle(copy.title)} (copy)`
  for (const doc of copied) {
    if (doc.id === copy.id) doc.title = copy.title
  }
  return { node: copy, docs: copied }
}

export function insertAfter(binder: BinderNode[], afterId: string, child: BinderNode): BinderNode[] {
  const next: BinderNode[] = []
  for (const node of binder) {
    if (node.id === afterId) {
      next.push(node, child)
      continue
    }
    if (node.children) next.push({ ...node, children: insertAfter(node.children, afterId, child) })
    else next.push(node)
  }
  return next
}

export type DropPlacement = 'inside' | 'after'

function containsId(node: BinderNode, id: string): boolean {
  if (node.id === id) return true
  return (node.children ?? []).some((child) => containsId(child, id))
}

/** Move a binder node by dropping it inside a container or after a sibling. */
export function moveNode(
  binder: BinderNode[],
  sourceId: string,
  targetId: string,
  placement: DropPlacement,
): BinderNode[] {
  if (sourceId === targetId) return binder
  const source = locate(binder, sourceId)
  const target = locate(binder, targetId)
  if (!source?.parent || !target) return binder
  if (containsId(source.node, targetId)) return binder
  if (placement === 'inside') {
    if (!isContainer(target.node.kind) || !canContain(target.node.kind, source.node.kind)) return binder
  } else {
    if (!target.parent) return binder
    if (!canContain(target.parent.kind, source.node.kind)) return binder
  }
  const detached = deleteBinderNode(binder, sourceId)
  return placement === 'inside'
    ? insertChild(detached, target.node.id, source.node)
    : insertAfter(detached, targetId, source.node)
}

export interface OutlineRow {
  id: string
  kind: Kind
  depth: number
  title: string
  synopsis: string
  status: Status
  words: number
  pov: string
  day: string
}

export function outlineRows(project: Project, docs: Record<string, Doc>): OutlineRow[] {
  const manuscript = manuscriptOf(project)
  if (!manuscript) return []
  const rows: OutlineRow[] = []
  const walk = (node: BinderNode, depth: number): void => {
    if (node.kind === 'part' || node.kind === 'chapter' || node.kind === 'scene') {
      const doc = docs[node.id]
      const words =
        node.kind === 'scene' ? countWords(doc?.body ?? '') : subtreeWordCount(node, docs)
      rows.push({
        id: node.id,
        kind: node.kind,
        depth,
        title: displayTitle(doc?.title ?? node.title),
        synopsis: doc?.synopsis ?? '',
        status: doc?.status ?? 'idea',
        words,
        pov: doc?.pov ?? '',
        day: doc?.storyDay ?? '',
      })
    }
    for (const child of node.children ?? []) walk(child, depth + 1)
  }
  for (const child of manuscript.children ?? []) walk(child, 0)
  return rows
}

export function storyDayNumber(value: string): number | null {
  const match = /^-?\d+(?:\.\d+)?/.exec(value.trim())
  if (!match) return null
  const number = Number(match[0])
  return Number.isFinite(number) ? number : null
}

export interface TimelineRow {
  id: string
  chapter: string
  title: string
  day: string
  dayNumber: number | null
  pov: string
  location: string
  status: Status
  words: number
  synopsis: string
}

export function timelineRows(project: Project, docs: Record<string, Doc>): TimelineRow[] {
  const manuscript = manuscriptOf(project)
  if (!manuscript) return []
  const rows: TimelineRow[] = []
  const walk = (node: BinderNode, chapterTitle: string): void => {
    const title = displayTitle(docs[node.id]?.title ?? node.title)
    const nextChapter = node.kind === 'part' || node.kind === 'chapter' ? title : chapterTitle
    if (node.kind === 'scene') {
      const doc = docs[node.id]
      rows.push({
        id: node.id,
        chapter: chapterTitle,
        title,
        day: doc?.storyDay ?? '',
        dayNumber: storyDayNumber(doc?.storyDay ?? ''),
        pov: doc?.pov ?? '',
        location: doc?.location ?? '',
        status: doc?.status ?? 'idea',
        words: countWords(doc?.body ?? ''),
        synopsis: doc?.synopsis ?? '',
      })
    }
    for (const child of node.children ?? []) walk(child, nextChapter)
  }
  for (const child of manuscript.children ?? []) walk(child, '')
  return rows.sort((a, b) => {
    if (a.dayNumber === null && b.dayNumber === null) return 0
    if (a.dayNumber === null) return 1
    if (b.dayNumber === null) return -1
    return a.dayNumber - b.dayNumber
  })
}
