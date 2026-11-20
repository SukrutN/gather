import { copyFile, mkdir, rm, stat } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { shell } from 'electron'

/** Names must be plain file names: no separators, no traversal. */
export function assertFileName(name: string): string {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.includes('/') ||
    name.includes('\\') ||
    name.includes('..') ||
    name.includes('\u0000')
  ) {
    throw new Error('That is not a plain file name.')
  }
  return name
}

function researchFolder(dir: string): string {
  const root = resolve(dir)
  const folder = join(root, 'research')
  const resolved = resolve(folder)
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error('That path leaves the project folder.')
  }
  return folder
}

async function exists(file: string): Promise<boolean> {
  try {
    const info = await stat(file)
    return info.isFile()
  } catch {
    return false
  }
}

/** Copies a file into research/, uniquifying the name if it is taken. */
export async function addResearchFile(source: string, dir: string): Promise<string> {
  const folder = researchFolder(dir)
  await mkdir(folder, { recursive: true })
  const original = basename(source)
  let name = original
  let counter = 2
  const dot = original.lastIndexOf('.')
  const stem = dot > 0 ? original.slice(0, dot) : original
  const extension = dot > 0 ? original.slice(dot) : ''
  while (await exists(join(folder, name))) {
    name = `${stem} (${counter})${extension}`
    counter += 1
  }
  await copyFile(source, join(folder, name))
  return name
}

export async function openResearchFile(dir: string, name: string): Promise<void> {
  const file = join(researchFolder(dir), assertFileName(name))
  if (!(await exists(file))) throw new Error('That research file is gone.')
  await shell.openPath(file)
}

export async function revealResearchFile(dir: string, name: string): Promise<void> {
  const file = join(researchFolder(dir), assertFileName(name))
  if (!(await exists(file))) throw new Error('That research file is gone.')
  shell.showItemInFolder(file)
}

export async function removeResearchFile(dir: string, name: string): Promise<void> {
  const file = join(researchFolder(dir), assertFileName(name))
  if (!(await exists(file))) return
  await rm(file, { force: true })
}
