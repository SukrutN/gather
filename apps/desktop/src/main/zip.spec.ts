import { describe, expect, it } from 'vitest'
import { crc32, inflateRawSync } from 'node:zlib'
import { packDocx, packEpub, zipSync, type ZipEntry } from './zip'

interface ParsedEntry {
  name: string
  method: number
  crc: number
  size: number
  data: Buffer
}

function parseZip(buffer: Buffer): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  let offset = 0
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8)
    const crc = buffer.readUInt32LE(offset + 14)
    const compressedSize = buffer.readUInt32LE(offset + 18)
    const size = buffer.readUInt32LE(offset + 22)
    const nameLength = buffer.readUInt16LE(offset + 26)
    const extraLength = buffer.readUInt16LE(offset + 28)
    const name = buffer.slice(offset + 30, offset + 30 + nameLength).toString('utf8')
    const dataStart = offset + 30 + nameLength + extraLength
    entries.push({
      name,
      method,
      crc,
      size,
      data: buffer.slice(dataStart, dataStart + compressedSize),
    })
    offset = dataStart + compressedSize
  }
  return entries
}

function inflate(entry: ParsedEntry): string {
  if (entry.method === 0) return entry.data.toString('utf8')
  return inflateRawSync(entry.data).toString('utf8')
}

describe('zipSync', () => {
  it('writes valid local headers and an end record', () => {
    const entries: ZipEntry[] = [
      { name: 'a.txt', data: Buffer.from('alpha', 'utf8'), store: false },
      { name: 'b.txt', data: Buffer.from('beta', 'utf8'), store: true },
    ]
    const buffer = zipSync(entries)
    const parsed = parseZip(buffer)
    expect(parsed.map((entry) => entry.name)).toEqual(['a.txt', 'b.txt'])
    expect(buffer.readUInt32LE(buffer.length - 22)).toBe(0x06054b50)
    expect(buffer.slice(0, 4).toString('hex')).toBe('504b0304')
  })

  it('round-trips stored and deflated data with CRC checks', () => {
    const text = 'Leah Voss locked the street door at ten.'.repeat(20)
    const entries: ZipEntry[] = [
      { name: 'stored.txt', data: Buffer.from(text, 'utf8'), store: true },
      { name: 'deflated.txt', data: Buffer.from(text, 'utf8'), store: false },
    ]
    const parsed = parseZip(zipSync(entries))
    expect(parsed[0]!.method).toBe(0)
    expect(parsed[1]!.method).toBe(8)
    for (const entry of parsed) {
      expect(entry.crc).toBe(crc32(Buffer.from(text, 'utf8')) >>> 0)
      expect(entry.size).toBe(Buffer.byteLength(text))
      expect(inflate(entry)).toBe(text)
    }
  })
})

describe('packEpub', () => {
  it('puts the mimetype first, stored, and the container second', () => {
    const buffer = packEpub([
      { path: 'OEBPS/content.opf', text: '<package/>' },
      { path: 'META-INF/container.xml', text: '<container/>' },
    ])
    const parsed = parseZip(buffer)
    expect(parsed[0]!.name).toBe('mimetype')
    expect(parsed[0]!.method).toBe(0)
    expect(inflate(parsed[0]!)).toBe('application/epub+zip')
    expect(parsed[1]!.name).toBe('META-INF/container.xml')
    expect(parsed[2]!.name).toBe('OEBPS/content.opf')
    expect(inflate(parsed[2]!)).toBe('<package/>')
  })

  it('refuses unsafe paths', () => {
    expect(() => packEpub([{ path: 'OEBPS/../../escape.txt', text: 'x' }])).toThrow()
    expect(() => packEpub([{ path: 'C:\\evil', text: 'x' }])).toThrow()
    expect(() => packEpub([{ path: 'outside/file.txt', text: 'x' }])).toThrow()
  })
})

describe('packDocx', () => {
  it('round-trips the Word parts', () => {
    const files = [
      { path: '[Content_Types].xml', text: '<Types/>' },
      { path: '_rels/.rels', text: '<Relationships/>' },
      { path: 'word/document.xml', text: '<w:document/>' },
      { path: 'word/styles.xml', text: '<w:styles/>' },
      { path: 'word/_rels/document.xml.rels', text: '<Relationships/>' },
    ]
    const parsed = parseZip(packDocx(files))
    expect(parsed.map((entry) => entry.name)).toEqual(files.map((file) => file.path))
    for (const [index, file] of files.entries()) {
      expect(inflate(parsed[index]!)).toBe(file.text)
    }
  })

  it('requires word/document.xml and refuses unsafe paths', () => {
    expect(() => packDocx([{ path: '_rels/.rels', text: 'x' }])).toThrow('word/document.xml')
    expect(() =>
      packDocx([
        { path: 'word/document.xml', text: 'x' },
        { path: 'word/../evil.xml', text: 'y' },
      ]),
    ).toThrow()
    expect(() =>
      packDocx([
        { path: 'word/document.xml', text: 'x' },
        { path: 'other/file.xml', text: 'y' },
      ]),
    ).toThrow()
  })
})
