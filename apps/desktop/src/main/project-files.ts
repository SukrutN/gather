import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { parseProject } from '@shared/model'
import type { DocumentFile, PdfExport, Project, SaveBundle } from '@shared/types'

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

function assertId(id: string): void {
  if (!ID_RE.test(id)) throw new Error('A document id is not a UUID.')
}

async function writeAtomic(file: string, data: string | Buffer): Promise<void> {
  const temporary = `${file}.${process.pid}.tmp`
  await writeFile(temporary, data)
  await rename(temporary, file)
}

function documentIds(project: Project): string[] {
  const ids: string[] = []
  const walk = (nodes: Project['binder']): void => {
    for (const node of nodes) {
      if (
        node.kind === 'part' ||
        node.kind === 'chapter' ||
        node.kind === 'scene' ||
        node.kind === 'character' ||
        node.kind === 'place' ||
        node.kind === 'note'
      ) {
        ids.push(node.id)
      }
      if (node.children) walk(node.children)
    }
  }
  walk(project.binder)
  return ids
}

export async function projectExists(dir: string): Promise<boolean> {
  try {
    const info = await stat(join(assertDir(dir), 'project.json'))
    return info.isFile()
  } catch {
    return false
  }
}

export async function loadProject(dir: string): Promise<{ project: Project; documents: DocumentFile[] }> {
  const root = assertDir(dir)
  let raw: string
  try {
    raw = await readFile(join(root, 'project.json'), 'utf8')
  } catch {
    throw new Error('No project.json in that folder.')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error('project.json is not valid JSON.')
  }
  const project = parseProject(parsed)
  const documents: DocumentFile[] = []
  for (const id of documentIds(project)) {
    assertId(id)
    const file = join(root, 'documents', `${id}.md`)
    inside(root, file)
    try {
      documents.push({ id, markdown: await readFile(file, 'utf8') })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw error
    }
  }
  return { project, documents }
}

export async function saveProject(dir: string, bundle: SaveBundle): Promise<void> {
  const root = assertDir(dir)
  const project = parseProject(bundle.project)
  const allowed = new Set(documentIds(project))
  const documentsDir = join(root, 'documents')
  inside(root, documentsDir)
  await mkdir(documentsDir, { recursive: true })
  await writeAtomic(join(root, 'project.json'), `${JSON.stringify(project, null, 2)}\n`)
  const written = new Set<string>()
  for (const document of bundle.documents) {
    if (!document || typeof document.id !== 'string' || typeof document.markdown !== 'string') {
      throw new Error('A document could not be saved.')
    }
    assertId(document.id)
    if (!allowed.has(document.id)) continue
    const file = join(documentsDir, `${document.id}.md`)
    inside(root, file)
    await writeAtomic(file, document.markdown)
    written.add(document.id)
  }
  for (const id of bundle.removeIds) {
    if (typeof id !== 'string' || !ID_RE.test(id) || written.has(id) || allowed.has(id)) continue
    const file = join(documentsDir, `${id}.md`)
    inside(root, file)
    await rm(file, { force: true })
  }
}

function ensureExtension(file: string, extension: string): string {
  return file.toLowerCase().endsWith(`.${extension}`) ? file : `${file}.${extension}`
}

export async function writeExportFile(filePath: string, data: string | Buffer): Promise<string> {
  await writeFile(filePath, data)
  return filePath
}

export function withExtension(filePath: string, extension: string): string {
  return ensureExtension(filePath, extension)
}

export async function printPdf(request: PdfExport, filePath: string): Promise<void> {
  const temporary = join(tmpdir(), `gather-print-${randomUUID()}.html`)
  const printWindow = new BrowserWindow({
    show: false,
    width: 900,
    height: 1200,
    backgroundColor: '#ffffff',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })
  try {
    await writeFile(temporary, request.html, 'utf8')
    await printWindow.loadFile(temporary)
    await printWindow.webContents.executeJavaScript('document.fonts ? document.fonts.ready : true')
    const pdf = await printWindow.webContents.printToPDF({
      printBackground: false,
      preferCSSPageSize: true,
      pageSize: { width: request.widthMicrons, height: request.heightMicrons },
      margins: { marginType: 'none' },
    })
    await writeFile(filePath, pdf)
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
    await rm(temporary, { force: true })
  }
}
