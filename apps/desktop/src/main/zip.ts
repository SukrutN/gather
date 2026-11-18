import { crc32, deflateRawSync } from 'node:zlib'

export interface ZipEntry {
  name: string
  data: Buffer
  store: boolean
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(date.getFullYear(), 1980)
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, date: day }
}

function checksum(data: Buffer): number {
  return crc32(data) >>> 0
}

/**
 * Writes a ZIP archive. Stored entries have method 0, no extra field, and sizes
 * in the local header (no data descriptor). Gather uses that for the EPUB
 * mimetype, which must be the first entry and uncompressed.
 */
export function zipSync(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  const stamp = dosDateTime(new Date())

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const crc = checksum(entry.data)
    const compressed = entry.store ? entry.data : deflateRawSync(entry.data)
    const method = entry.store ? 0 : 8

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(stamp.time, 10)
    local.writeUInt16LE(stamp.date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    const localRecord = Buffer.concat([local, name, compressed])
    locals.push(localRecord)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(method, 10)
    central.writeUInt16LE(stamp.time, 12)
    central.writeUInt16LE(stamp.date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(entry.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(Buffer.concat([central, name]))
    offset += localRecord.length
  }

  const centralDir = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDir.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...locals, centralDir, end])
}

const EPUB_PATH = /^(?:META-INF|OEBPS)\/[A-Za-z0-9._/-]+$/

function isSafeEpubPath(filePath: string): boolean {
  if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('\\')) return false
  return EPUB_PATH.test(filePath)
}

export function packEpub(files: Array<{ path: string; text: string }>): Buffer {
  const entries: ZipEntry[] = [
    {
      name: 'mimetype',
      data: Buffer.from('application/epub+zip', 'utf8'),
      store: true,
    },
  ]
  const ordered = [...files].sort((a, b) => {
    if (a.path === 'META-INF/container.xml') return -1
    if (b.path === 'META-INF/container.xml') return 1
    return 0
  })
  for (const file of ordered) {
    if (!isSafeEpubPath(file.path)) throw new Error(`Refusing to pack an unsafe EPUB path: ${file.path}`)
    entries.push({ name: file.path, data: Buffer.from(file.text, 'utf8'), store: false })
  }
  return zipSync(entries)
}
