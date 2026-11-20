import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { backupProject } from './backup'

let root: string
let target: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gather-backup-'))
  target = join(root, '..', `${Date.now()}-gather-backup-test.zip`)
  await mkdir(join(root, 'documents'), { recursive: true })
  await mkdir(join(root, 'history', 'blobs'), { recursive: true })
  await writeFile(join(root, 'project.json'), '{"format":"gather-project"}', 'utf8')
  await writeFile(join(root, 'comments.json'), '{"format":"gather-comments"}', 'utf8')
  await writeFile(join(root, 'documents', 'scene.md'), 'The lamps counted fourteen.', 'utf8')
  await writeFile(join(root, 'history', 'versions.json'), '{"format":"gather-history"}', 'utf8')
  await writeFile(join(root, 'project.json.123.tmp'), 'half-written junk', 'utf8')
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
  await rm(target, { force: true })
})

function parseZip(buffer: Buffer): string[] {
  const names: string[] = []
  let offset = 0
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const nameLength = buffer.readUInt16LE(offset + 26)
    const extraLength = buffer.readUInt16LE(offset + 28)
    const compressedSize = buffer.readUInt32LE(offset + 18)
    names.push(buffer.slice(offset + 30, offset + 30 + nameLength).toString('utf8'))
    offset = offset + 30 + nameLength + extraLength + compressedSize
  }
  return names
}

describe('backupProject', () => {
  it('zips the whole project folder, sorted, without temp files', async () => {
    const saved = await backupProject(root, target)
    expect(saved).toBe(target)
    const zip = await readFile(target)
    const names = parseZip(zip)
    expect(names).toEqual([
      'comments.json',
      'documents/scene.md',
      'history/versions.json',
      'project.json',
    ])
  })
})
