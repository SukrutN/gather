import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import type { KeepVersionPayload, VersionInfo } from '@shared/types'

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HASH_RE = /^[0-9a-f]{64}$/
const MAX_MESSAGE = 200

function assertDir(dir: string): string {
  if (typeof dir !== 'string' || !dir.trim()) throw new Error('Choose a folder.')
  return resolve(dir)
}

function inside(root: string, target: string): void {
  const base = resolve(root)
  const file = resolve(target)
  if (file !== base && !file.startsWith(base + sep)) {
    throw new Error('That path leaves the project folder.')
  }
}

function historyFolder(dir: string): string {
  const root = assertDir(dir)
  const folder = join(root, 'history')
  inside(root, folder)
  return folder
}

function blobsFolder(dir: string): string {
  const root = assertDir(dir)
  const folder = join(root, 'history', 'blobs')
  inside(root, folder)
  return folder
}

function blobPath(dir: string, hash: string, extension: 'md' | 'json'): string {
  if (!HASH_RE.test(hash)) throw new Error('A history hash is invalid.')
  const root = assertDir(dir)
  const file = join(root, 'history', 'blobs', `${hash}.${extension}`)
  inside(root, file)
  return file
}

async function writeAtomic(file: string, data: string): Promise<void> {
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, data, 'utf8')
  await rename(temporary, file)
}

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function parseManifest(data: unknown): VersionInfo[] {
  if (!data || typeof data !== 'object') throw new Error('history/versions.json is not an object.')
  const record = data as Record<string, unknown>
  if (record.format !== 'gather-history') throw new Error('history/versions.json is not a Gather history.')
  if (record.version !== 1) throw new Error('history/versions.json uses an unsupported version.')
  if (!Array.isArray(record.versions)) throw new Error('history/versions.json is missing its versions.')
  return record.versions.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('A history version is invalid.')
    const version = item as Record<string, unknown>
    if (typeof version.id !== 'string' || !ID_RE.test(version.id)) {
      throw new Error('A history version has an invalid id.')
    }
    if (typeof version.savedAt !== 'string') throw new Error('A history version is missing its date.')
    if (typeof version.project !== 'string' || !HASH_RE.test(version.project)) {
      throw new Error('A history version has an invalid project hash.')
    }
    if (!version.docs || typeof version.docs !== 'object' || Array.isArray(version.docs)) {
      throw new Error('A history version has an invalid document list.')
    }
    const docs: Record<string, string | null> = {}
    for (const [id, hash] of Object.entries(version.docs as Record<string, unknown>)) {
      if (!ID_RE.test(id)) continue
      if (hash === null) docs[id] = null
      else if (typeof hash === 'string' && HASH_RE.test(hash)) docs[id] = hash
    }
    return {
      id: version.id,
      savedAt: version.savedAt,
      message: typeof version.message === 'string' ? version.message.slice(0, MAX_MESSAGE) : '',
      project: version.project,
      docs,
    }
  })
}

async function readVersions(dir: string): Promise<VersionInfo[]> {
  let raw: string
  try {
    raw = await readFile(join(historyFolder(dir), 'versions.json'), 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return []
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('history/versions.json is not valid JSON.')
  }
  return parseManifest(parsed)
}

async function writeVersions(dir: string, versions: VersionInfo[]): Promise<void> {
  const manifest = {
    format: 'gather-history',
    version: 1,
    versions,
  }
  await mkdir(historyFolder(dir), { recursive: true })
  await writeAtomic(join(historyFolder(dir), 'versions.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

async function writeBlobIfMissing(file: string, text: string): Promise<void> {
  try {
    await readFile(file, 'utf8')
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') throw error
    await mkdir(dirname(file), { recursive: true })
    await writeAtomic(file, text)
  }
}

function sameDocs(before: Record<string, string | null>, after: Record<string, string | null>): boolean {
  const beforeKeys = Object.keys(before)
  const afterKeys = Object.keys(after)
  if (beforeKeys.length !== afterKeys.length) return false
  for (const key of beforeKeys) {
    if (before[key] !== after[key]) return false
  }
  return true
}

export async function listVersions(dir: string): Promise<VersionInfo[]> {
  return readVersions(dir)
}

/**
 * Writes a checkpoint. Unchanged content is skipped: identical project and
 * document hashes produce no new version, and blob files are shared between
 * versions. Documents that existed in the previous version but are missing
 * from the payload are recorded as deleted.
 */
export async function keepVersion(dir: string, payload: KeepVersionPayload): Promise<VersionInfo[]> {
  const root = assertDir(dir)
  if (!payload || typeof payload !== 'object') throw new Error('Could not keep a version.')
  if (typeof payload.project !== 'string' || !Array.isArray(payload.docs)) {
    throw new Error('Could not keep a version.')
  }
  const versions = await readVersions(root)
  const previous = versions[versions.length - 1]

  const docs: Record<string, string | null> = {}
  for (const doc of payload.docs) {
    if (!doc || typeof doc.id !== 'string' || !ID_RE.test(doc.id)) continue
    if (typeof doc.markdown !== 'string') continue
    docs[doc.id] = sha256(doc.markdown)
  }
  if (previous) {
    for (const [id, hash] of Object.entries(previous.docs)) {
      if (hash !== null && !(id in docs)) docs[id] = null
    }
  }

  const projectHash = sha256(payload.project)
  if (previous && previous.project === projectHash && sameDocs(previous.docs, docs)) {
    return versions
  }

  await mkdir(blobsFolder(root), { recursive: true })
  await writeBlobIfMissing(blobPath(root, projectHash, 'json'), payload.project)
  for (const doc of payload.docs) {
    if (!doc || typeof doc.id !== 'string' || !ID_RE.test(doc.id)) continue
    if (typeof doc.markdown !== 'string') continue
    await writeBlobIfMissing(blobPath(root, docs[doc.id] as string, 'md'), doc.markdown)
  }

  const version: VersionInfo = {
    id: randomUUID(),
    savedAt: new Date().toISOString(),
    message: typeof payload.message === 'string' ? payload.message.trim().slice(0, MAX_MESSAGE) : '',
    project: projectHash,
    docs,
  }
  versions.push(version)
  await writeVersions(root, versions)
  return versions
}

export async function readVersionDoc(dir: string, versionId: string, docId: string): Promise<string> {
  if (!ID_RE.test(versionId) || !ID_RE.test(docId)) throw new Error('That page is not in this history.')
  const versions = await readVersions(dir)
  const version = versions.find((item) => item.id === versionId)
  const hash = version?.docs[docId]
  if (!version || !hash) throw new Error('That page is not in this history.')
  return readFile(blobPath(dir, hash, 'md'), 'utf8')
}

export async function readVersionProject(dir: string, versionId: string): Promise<string> {
  if (!ID_RE.test(versionId)) throw new Error('That version is not in this history.')
  const versions = await readVersions(dir)
  const version = versions.find((item) => item.id === versionId)
  if (!version) throw new Error('That version is not in this history.')
  return readFile(blobPath(dir, version.project, 'json'), 'utf8')
}

/** Counts stored blobs, for tests and diagnostics. */
export async function countBlobs(dir: string): Promise<number> {
  try {
    const names = await readdir(blobsFolder(dir))
    return names.filter((name) => /\.(md|json)$/.test(name)).length
  } catch {
    return 0
  }
}
