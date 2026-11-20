import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { projectStatus } from './status'

const DOC_A = '6f0c2a10-1b2c-4d3e-8f01-000000000001.md'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gather-status-'))
  await mkdir(join(root, 'documents'), { recursive: true })
  await writeFile(join(root, 'project.json'), '{"format":"gather-project"}', 'utf8')
  await writeFile(join(root, 'documents', DOC_A), 'Alpha beta.', 'utf8')
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('projectStatus', () => {
  it('returns a stable fingerprint when nothing changes', async () => {
    const first = await projectStatus(root)
    const second = await projectStatus(root)
    expect(second.fingerprint).toHaveLength(64)
    expect(second.fingerprint).toBe(first.fingerprint)
    expect(second.conflicts).toBe(0)
  })

  it('notices content changes by size', async () => {
    const before = await projectStatus(root)
    await writeFile(join(root, 'documents', DOC_A), 'Alpha beta gamma delta.', 'utf8')
    const after = await projectStatus(root)
    expect(after.fingerprint).not.toBe(before.fingerprint)
  })

  it('notices a new comments.json', async () => {
    const before = await projectStatus(root)
    await writeFile(join(root, 'comments.json'), '{"format":"gather-comments"}', 'utf8')
    const after = await projectStatus(root)
    expect(after.fingerprint).not.toBe(before.fingerprint)
  })

  it('ignores Gather’s own outputs', async () => {
    const before = await projectStatus(root)
    await mkdir(join(root, 'history', 'blobs'), { recursive: true })
    await mkdir(join(root, 'snapshots', '6f0c2a10-1b2c-4d3e-8f01-000000000001'), { recursive: true })
    await writeFile(join(root, 'history', 'versions.json'), '{}', 'utf8')
    await writeFile(
      join(root, 'snapshots', '6f0c2a10-1b2c-4d3e-8f01-000000000001', '20261119-120000000.md'),
      'copy',
      'utf8',
    )
    const after = await projectStatus(root)
    expect(after.fingerprint).toBe(before.fingerprint)
  })

  it('counts sync-service conflicted copies in the root and documents', async () => {
    await writeFile(join(root, 'project (Conflicted copy from Bob’s laptop).json'), '{}', 'utf8')
    await writeFile(join(root, 'documents', `${DOC_A.replace('.md', '')} (sync-conflict 2026).md`), 'x', 'utf8')
    await writeFile(join(root, 'documents', '6f0c2a10-1b2c-4d3e-8f01-000000000002.md'), 'plain file', 'utf8')
    const status = await projectStatus(root)
    expect(status.conflicts).toBe(2)
  })

  it('is stable across that same conflicted state', async () => {
    const first = await projectStatus(root)
    const second = await projectStatus(root)
    expect(second.fingerprint).toBe(first.fingerprint)
  })
})
