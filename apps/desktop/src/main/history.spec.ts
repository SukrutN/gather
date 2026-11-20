import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { countBlobs, keepVersion, listVersions, readVersionDoc, readVersionProject } from './history'
import type { KeepVersionPayload } from '@shared/types'

const DOC_A = '6f0c2a10-1b2c-4d3e-8f01-000000000001'
const DOC_B = '6f0c2a10-1b2c-4d3e-8f01-000000000002'
const BAD_ID = 'not-a-uuid'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gather-history-'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

function payload(overrides: Partial<KeepVersionPayload> = {}): KeepVersionPayload {
  return {
    message: '',
    project: '{"format":"gather-project"}',
    docs: [
      { id: DOC_A, markdown: '---\ntitle: "Keys"\n---\n\nAlpha beta.' },
      { id: DOC_B, markdown: '---\ntitle: "Drawer"\n---\n\nDelta epsilon.' },
    ],
    ...overrides,
  }
}

describe('keepVersion', () => {
  it('writes a first version with every document', async () => {
    const versions = await keepVersion(root, payload())
    expect(versions).toHaveLength(1)
    expect(versions[0]?.docs[DOC_A]).toMatch(/^[0-9a-f]{64}$/)
    expect(versions[0]?.docs[DOC_B]).toMatch(/^[0-9a-f]{64}$/)
    expect(versions[0]?.message).toBe('')
  })

  it('skips an identical checkpoint', async () => {
    const versions = await keepVersion(root, payload())
    expect(versions).toHaveLength(1)
  })

  it('ignores changes to volatile fields by hashing exactly what it is given', async () => {
    const versions = await keepVersion(root, payload({ project: '{"format":"gather-project","modified":"x"}' }))
    expect(versions).toHaveLength(2)
    expect(versions[1]?.project).not.toBe(versions[0]?.project)
  })

  it('shares blobs between versions and writes new ones only for changes', async () => {
    const before = await countBlobs(root)
    const versions = await keepVersion(root, {
      message: 'Edit a page',
      project: '{"format":"gather-project"}',
      docs: [
        { id: DOC_A, markdown: '---\ntitle: "Keys"\n---\n\nAlpha beta gamma.' },
        { id: DOC_B, markdown: '---\ntitle: "Drawer"\n---\n\nDelta epsilon.' },
      ],
    })
    expect(versions).toHaveLength(3)
    const after = await countBlobs(root)
    // Only the changed page is new; the project string matches version 1 again.
    expect(after - before).toBe(1)
  })

  it('records deleted pages as null instead of dropping them', async () => {
    const versions = await keepVersion(root, {
      message: 'Delete a page',
      project: '{"format":"gather-project"}',
      docs: [{ id: DOC_A, markdown: '---\ntitle: "Keys"\n---\n\nAlpha beta gamma.' }],
    })
    expect(versions).toHaveLength(4)
    expect(versions[3]?.docs[DOC_B]).toBeNull()
    expect(versions[3]?.docs[DOC_A]).toBeTruthy()
  })

  it('drops entries with invalid ids instead of failing', async () => {
    const versions = await keepVersion(root, {
      message: '',
      project: '{"format":"gather-project"}',
      docs: [
        { id: BAD_ID, markdown: 'junk' },
        { id: DOC_A, markdown: '---\ntitle: "Keys"\n---\n\nAlpha beta gamma.' },
      ],
    })
    const last = versions[versions.length - 1]
    expect(last?.docs[DOC_A]).toBeTruthy()
    expect(BAD_ID in (last?.docs ?? {})).toBe(false)
  })

  it('round-trips documents and the project through their blobs', async () => {
    const versions = await listVersions(root)
    const last = versions[versions.length - 1] as { id: string }
    const doc = await readVersionDoc(root, last.id, DOC_A)
    expect(doc).toContain('Alpha beta gamma.')
    const project = await readVersionProject(root, last.id)
    expect(JSON.parse(project)).toMatchObject({ format: 'gather-project' })
  })

  it('refuses unknown versions, unknown docs, and deleted docs', async () => {
    const versions = await listVersions(root)
    const last = versions[versions.length - 1] as { id: string }
    await expect(readVersionDoc(root, '11111111-1111-4111-8111-111111111111', DOC_A)).rejects.toThrow()
    await expect(readVersionDoc(root, last.id, '11111111-1111-4111-8111-111111111112')).rejects.toThrow()
    await expect(readVersionDoc(root, last.id, DOC_B)).rejects.toThrow()
    await expect(readVersionProject(root, '11111111-1111-4111-8111-111111111111')).rejects.toThrow()
  })

  it('reports a corrupt manifest instead of guessing', async () => {
    const corrupt = await mkdtemp(join(tmpdir(), 'gather-history-bad-'))
    try {
      await mkdir(join(corrupt, 'history'), { recursive: true })
      await writeFile(join(corrupt, 'history', 'versions.json'), '{nope', 'utf8')
      await expect(listVersions(corrupt)).rejects.toThrow('not valid JSON')
    } finally {
      await rm(corrupt, { recursive: true, force: true })
    }
  })

  it('validates manifest contents, not just the wrapper', async () => {
    const bogus = await mkdtemp(join(tmpdir(), 'gather-history-bogus-'))
    try {
      await mkdir(join(bogus, 'history'), { recursive: true })
      const manifest = {
        format: 'gather-history',
        version: 1,
        versions: [{ id: 'junk', savedAt: 'now', project: '0'.repeat(64), docs: {} }],
      }
      await writeFile(join(bogus, 'history', 'versions.json'), JSON.stringify(manifest), 'utf8')
      await expect(listVersions(bogus)).rejects.toThrow('invalid id')
    } finally {
      await rm(bogus, { recursive: true, force: true })
    }
  })

  it('writes a readable manifest file', async () => {
    const raw = JSON.parse(await readFile(join(root, 'history', 'versions.json'), 'utf8')) as {
      format: string
      version: number
    }
    expect(raw.format).toBe('gather-history')
    expect(raw.version).toBe(1)
  })
})
