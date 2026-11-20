import type { Comment, CommentReply, CommentsFile } from './types'

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_BODY = 5000
const MAX_EXCERPT = 400

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const cleaned = value.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim()
  return cleaned.slice(0, max)
}

function parseReply(value: unknown): CommentReply | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !ID_RE.test(record.id)) return null
  const body = cleanText(record.body, MAX_BODY)
  if (!body) return null
  return {
    id: record.id,
    author: cleanText(record.author, 120).slice(0, 120) || 'Anonymous',
    body,
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
  }
}

/** Validates one raw comment. Returns null when it is not worth keeping. */
export function sanitizeComment(value: unknown): Comment | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || !ID_RE.test(record.id)) return null
  if (typeof record.docId !== 'string' || !ID_RE.test(record.docId)) return null
  const body = cleanText(record.body, MAX_BODY)
  if (!body) return null
  const replies = Array.isArray(record.replies)
    ? record.replies
        .map((reply) => parseReply(reply))
        .filter((reply): reply is CommentReply => reply !== null)
    : []
  return {
    id: record.id,
    docId: record.docId,
    author: cleanText(record.author, 120) || 'Anonymous',
    body,
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
    resolved: record.resolved === true,
    excerpt: cleanText(record.excerpt, MAX_EXCERPT),
    replies,
  }
}

export function sanitizeComments(value: unknown): Comment[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const comments: Comment[] = []
  for (const item of value) {
    const comment = sanitizeComment(item)
    if (!comment || seen.has(comment.id)) continue
    seen.add(comment.id)
    comments.push(comment)
  }
  return comments
}

export function serializeComments(comments: Comment[]): string {
  const file: CommentsFile = {
    format: 'gather-comments',
    version: 1,
    comments: sanitizeComments(comments),
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

export function parseCommentsFile(value: unknown): Comment[] {
  if (!value || typeof value !== 'object') throw new Error('comments.json is not an object.')
  const record = value as Record<string, unknown>
  if (record.format !== 'gather-comments') throw new Error('comments.json is not a Gather comments file.')
  if (record.version !== 1) throw new Error('comments.json uses an unsupported version.')
  if (!Array.isArray(record.comments)) throw new Error('comments.json is missing its comments.')
  return sanitizeComments(record.comments)
}

export function blankComment(id: string, docId: string, author: string, body: string, excerpt: string): Comment {
  return {
    id,
    docId,
    author: author.trim() || 'Anonymous',
    body,
    savedAt: new Date().toISOString(),
    resolved: false,
    excerpt,
    replies: [],
  }
}

export function blankReply(id: string, author: string, body: string): CommentReply {
  return {
    id,
    author: author.trim() || 'Anonymous',
    body,
    savedAt: new Date().toISOString(),
  }
}
