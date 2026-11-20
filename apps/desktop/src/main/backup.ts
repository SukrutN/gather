import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { zipSync, type ZipEntry } from './zip'

function stamp(): string {
  const now = new Date()
  const pad = (value: number, size = 2): string => String(value).padStart(size, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/**
 * Zips the whole project folder — every file, in sorted order — so a backup
 * is one self-contained archive you can restore by unzipping anywhere.
 * Temporary files from Gather's atomic writes are skipped.
 */
export async function backupProject(dir: string, target: string): Promise<string> {
  const root = resolve(dir)
  const entries: ZipEntry[] = []
  const dirents = await readdir(root, { recursive: true, withFileTypes: true })
  const files: string[] = []
  for (const dirent of dirents) {
    if (!dirent.isFile()) continue
    const parent = dirent.parentPath ?? dirent.path
    files.push(join(parent, dirent.name))
  }
  files.sort()
  for (const file of files) {
    if (file.endsWith('.tmp')) continue
    const name = relative(root, file).split(/[\\/]/).join('/')
    const data = await readFile(file)
    entries.push({ name, data, store: false })
  }
  await writeFile(target, zipSync(entries))
  return target
}

export function backupDefaultName(): string {
  return `gather-backup-${stamp()}.zip`
}
