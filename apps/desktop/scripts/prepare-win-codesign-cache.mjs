// One-time setup for electron-builder on Windows machines without symlink
// privileges. electron-builder downloads a winCodeSign tool archive that
// contains two macOS symlinks; extracting them needs admin rights or Windows
// Developer Mode, and the extraction failure blocks packaging even though the
// symlinks are macOS files a Windows build never touches.
//
// This script pre-populates the cache at the canonical location, so
// electron-builder skips its own download and extraction entirely. Real file
// copies replace the two symlinks. Run automatically by `npm run dist`.

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ARCHIVE_URL =
  'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..')
const sevenZipCandidates = [
  join(repoRoot, 'node_modules', '7zip-bin', 'win', 'x64', '7za.exe'),
]

const localAppData = process.env.LOCALAPPDATA
if (!localAppData) {
  // Not a Windows profile; nothing to prepare.
  process.exit(0)
}

const cacheRoot = join(localAppData, 'electron-builder', 'Cache', 'winCodeSign')
const canonical = join(cacheRoot, 'winCodeSign-2.6.0')
const marker = join(canonical, 'rcedit-x64.exe')

if (existsSync(marker)) {
  console.log('winCodeSign cache already prepared.')
  process.exit(0)
}

const archive = join(cacheRoot, 'winCodeSign-2.6.0-download.7z')
if (!existsSync(archive)) {
  console.log(`Downloading ${ARCHIVE_URL}`)
  const response = await fetch(ARCHIVE_URL)
  if (!response.ok) {
    console.error(`Could not download the winCodeSign archive: ${response.status}`)
    process.exit(1)
  }
  mkdirSync(cacheRoot, { recursive: true })
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()))
}

const sevenZip = sevenZipCandidates.find((candidate) => existsSync(candidate))
if (!sevenZip) {
  console.error('node_modules/7zip-bin/win/x64/7za.exe not found. Run npm install first.')
  process.exit(1)
}

if (existsSync(canonical)) rmSync(canonical, { recursive: true, force: true })
mkdirSync(canonical, { recursive: true })
try {
  // The two darwin symlinks fail to extract without privileges; every other
  // file, including the rcedit binaries a Windows build needs, extracts fine.
  execFileSync(sevenZip, ['x', archive, `-o${canonical}`, '-y'], { stdio: 'inherit' })
} catch {
  console.log('Extraction reported symlink errors; repairing those files as copies.')
}

const lib = join(canonical, 'darwin', '10.12', 'lib')
for (const [name, real] of [
  ['libcrypto.dylib', 'libcrypto.1.0.0.dylib'],
  ['libssl.dylib', 'libssl.1.0.0.dylib'],
]) {
  const source = join(lib, real)
  const stub = join(lib, name)
  if (existsSync(source)) copyFileSync(source, stub)
}

if (!existsSync(marker)) {
  console.error('The winCodeSign cache could not be prepared. See the errors above.')
  process.exit(1)
}
console.log('winCodeSign cache prepared; electron-builder will skip its own extraction.')
