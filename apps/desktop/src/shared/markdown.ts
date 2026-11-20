import type { Doc, ExtraField, Kind, Relationship, Status } from './types'
import { STATUSES } from './types'

const KNOWN = new Set([
  'title',
  'kind',
  'status',
  'synopsis',
  'role',
  'type',
  'summary',
  'pov',
  'location',
  'thread',
  'day',
  'words',
  'goal',
  'fear',
  'secret',
  'sense',
  'control',
  'link',
  'keyword',
])

export function isStatus(value: string | undefined): value is Status {
  return !!value && (STATUSES as readonly string[]).includes(value)
}

function quote(value: string): string {
  return JSON.stringify(value)
}

function unquote(raw: string): string {
  const value = raw.trim()
  if (value.startsWith('"')) {
    try {
      const parsed: unknown = JSON.parse(value)
      return typeof parsed === 'string' ? parsed : value
    } catch {
      return value
    }
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

export function serializeDocument(doc: Doc): string {
  const lines = [`title: ${quote(doc.title)}`, `kind: ${quote(doc.kind)}`, `status: ${quote(doc.status)}`]
  if (doc.kind === 'character') {
    lines.push(
      `role: ${quote(doc.role)}`,
      `summary: ${quote(doc.summary)}`,
      `goal: ${quote(doc.goal)}`,
      `fear: ${quote(doc.fear)}`,
      `secret: ${quote(doc.secret)}`,
    )
    for (const link of doc.relationships) {
      if (!link.characterId) continue
      lines.push(`link: ${quote(`${link.characterId} ${link.note}`.trim())}`)
    }
  } else if (doc.kind === 'place') {
    lines.push(
      `type: ${quote(doc.placeType)}`,
      `summary: ${quote(doc.summary)}`,
      `sense: ${quote(doc.sense)}`,
      `control: ${quote(doc.control)}`,
    )
  } else if (doc.kind === 'scene') {
    lines.push(
      `synopsis: ${quote(doc.synopsis)}`,
      `pov: ${quote(doc.pov)}`,
      `location: ${quote(doc.location)}`,
      `thread: ${quote(doc.thread)}`,
      `day: ${quote(doc.storyDay)}`,
    )
  } else if (doc.kind === 'chapter') {
    lines.push(`synopsis: ${quote(doc.synopsis)}`, `words: ${quote(String(doc.wordGoal || 0))}`)
  } else {
    lines.push(`synopsis: ${quote(doc.synopsis)}`)
  }
  const written = new Set([
    'title',
    'kind',
    'status',
    'role',
    'type',
    'summary',
    'synopsis',
    'pov',
    'location',
    'thread',
    'day',
    'words',
    'goal',
    'fear',
    'secret',
    'sense',
    'control',
    'link',
    'keyword',
  ])
  for (const word of doc.keywords) {
    const keyword = word.trim()
    if (keyword) lines.push(`keyword: ${quote(keyword)}`)
  }
  for (const field of doc.extra) {
    if (written.has(field.key) || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(field.key)) continue
    lines.push(`${field.key}: ${quote(field.value)}`)
    written.add(field.key)
  }
  return `---\n${lines.join('\n')}\n---\n\n${doc.body}`
}

export function parseDocument(markdown: string, fallback: Doc): Doc {
  const text = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!text.startsWith('---\n')) {
    return { ...fallback, body: text }
  }
  const end = text.indexOf('\n---', 3)
  if (end === -1) return { ...fallback, body: text }
  const header = text.slice(4, end)
  const lineBreak = text.indexOf('\n', end + 1)
  let body = lineBreak === -1 ? '' : text.slice(lineBreak + 1)
  if (body.startsWith('\n')) body = body.slice(1)

  const map = new Map<string, string>()
  const extra: ExtraField[] = []
  const relationships: Relationship[] = []
  const keywords: string[] = []
  for (const line of header.split('\n')) {
    if (!line.trim()) continue
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/.exec(line)
    if (!match) continue
    const key = match[1] ?? ''
    const value = unquote(match[2] ?? '')
    if (key === 'link') {
      const link = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*(.*)$/i.exec(value)
      if (link?.[1]) relationships.push({ characterId: link[1], note: (link[2] ?? '').trim() })
      continue
    }
    if (key === 'keyword') {
      const word = value.trim()
      if (word) keywords.push(word)
      continue
    }
    if (KNOWN.has(key)) map.set(key, value)
    else extra.push({ key, value })
  }

  const statusValue = map.get('status')
  const words = Number(map.get('words'))
  return {
    ...fallback,
    title: map.get('title') ?? fallback.title,
    kind: fallback.kind,
    status: isStatus(statusValue) ? statusValue : fallback.status,
    synopsis: map.get('synopsis') ?? '',
    role: map.get('role') ?? '',
    placeType: map.get('type') ?? '',
    summary: map.get('summary') ?? '',
    pov: map.get('pov') ?? '',
    location: map.get('location') ?? '',
    thread: map.get('thread') ?? '',
    storyDay: map.get('day') ?? '',
    wordGoal: Number.isFinite(words) && words > 0 ? Math.round(words) : 0,
    goal: map.get('goal') ?? '',
    fear: map.get('fear') ?? '',
    secret: map.get('secret') ?? '',
    sense: map.get('sense') ?? '',
    control: map.get('control') ?? '',
    relationships,
    keywords,
    body,
    extra,
  }
}

export function documentKind(kind: Kind): boolean {
  return (
    kind === 'part' ||
    kind === 'chapter' ||
    kind === 'scene' ||
    kind === 'character' ||
    kind === 'place' ||
    kind === 'note'
  )
}
