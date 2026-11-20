import { readFile, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseCommentsFile, serializeComments } from '@shared/comments'
import type { Comment } from '@shared/types'

function assertDir(dir: string): string {
  if (typeof dir !== 'string' || !dir.trim()) throw new Error('Choose a folder.')
  return resolve(dir)
}

function commentsPath(dir: string): string {
  return join(assertDir(dir), 'comments.json')
}

async function writeAtomic(file: string, data: string): Promise<void> {
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, data, 'utf8')
  await rename(temporary, file)
}

/** Reads comments.json. Missing file means no comments yet. */
export async function readComments(dir: string): Promise<Comment[]> {
  const file = commentsPath(dir)
  let raw: string
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return []
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('comments.json is not valid JSON.')
  }
  return parseCommentsFile(parsed)
}

export async function writeComments(dir: string, comments: unknown): Promise<void> {
  if (!Array.isArray(comments)) throw new Error('Comments could not be saved.')
  const text = serializeComments(comments as Comment[])
  await writeAtomic(commentsPath(dir), text)
}
