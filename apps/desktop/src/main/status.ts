import { createHash } from 'node:crypto'
import { readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { ProjectStatus } from '@shared/types'

const CONFLICT_NAME = /conflict|konflikt|conflit|sync-conflict/i

function assertDir(dir: string): string {
  if (typeof dir !== 'string' || !dir.trim()) throw new Error('Choose a folder.')
  return resolve(dir)
}

/**
 * A cheap fingerprint of the writing state on disk: project.json, comments.json,
 * and every document's name, size, and modification time. Gather's own outputs
 * (snapshots, history) are excluded on purpose, so saving a version or a page
 * copy never looks like an outside change.
 */
export async function projectStatus(dir: string): Promise<ProjectStatus> {
  const root = assertDir(dir)
  const parts: string[] = []
  let conflicts = 0

  const touch = async (label: string, file: string): Promise<void> => {
    try {
      const info = await stat(file)
      parts.push(`${label}|${info.mtimeMs}|${info.size}`)
    } catch {
      parts.push(`${label}|missing`)
    }
  }

  let rootEntries: string[] = []
  try {
    rootEntries = await readdir(root)
  } catch {
    rootEntries = []
  }

  await touch('project.json', join(root, 'project.json'))
  await touch('comments.json', join(root, 'comments.json'))

  let documents: string[] = []
  try {
    documents = await readdir(join(root, 'documents'))
  } catch {
    documents = []
  }
  for (const name of [...documents].sort()) {
    if (name.endsWith('.md')) {
      await touch(`documents/${name}`, join(root, 'documents', name))
    }
  }

  for (const name of rootEntries) {
    if (CONFLICT_NAME.test(name)) conflicts += 1
  }
  for (const name of documents) {
    if (CONFLICT_NAME.test(name)) conflicts += 1
  }

  const fingerprint = createHash('sha256').update(parts.join('\n'), 'utf8').digest('hex')
  return { fingerprint, conflicts }
}
