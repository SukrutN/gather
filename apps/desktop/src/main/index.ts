import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BrowserWindow, Menu, app, dialog, ipcMain } from 'electron'
import type { DirectoryPurpose, EpubExport, MenuAction, PdfExport, SaveBundle, TextExport } from '@shared/types'
import { keepSnapshot, listSnapshots, loadProject, printPdf, projectExists, readSnapshot, saveProject, withExtension } from './project-files'
import { packEpub } from './zip'

let chain: Promise<void> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task)
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function send(action: MenuAction): void {
  const win = BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu', action)
}

function createMenu(): void {
  const fileSubmenu: Electron.MenuItemConstructorOptions[] = [
    { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
    { label: 'Open Project', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
    { label: 'Open Sample', click: () => send('sample') },
    { type: 'separator' },
    { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('save') },
    { label: 'Compile…', accelerator: 'CmdOrCtrl+Shift+E', click: () => send('compile') },
  ]
  if (process.platform !== 'darwin') {
    fileSubmenu.push({ type: 'separator' }, { role: 'quit' })
  }
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: fileSubmenu,
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Focus Mode', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('focus') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
  ]
  if (process.platform === 'darwin') {
    template.unshift({
      label: 'Gather',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 880,
    minHeight: 620,
    show: false,
    backgroundColor: '#e6dccb',
    title: 'Gather',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  const launchDir = process.env.GATHER_PROJECT
  win.webContents.on('did-finish-load', () => {
    if (launchDir) win.webContents.send('open-folder', launchDir)
  })
  win.on('ready-to-show', () => win.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const purposes = new Set<DirectoryPurpose>(['new', 'open', 'sample'])

function directoryTitle(purpose: DirectoryPurpose): string {
  if (purpose === 'new') return 'Choose a folder for the new project'
  if (purpose === 'sample') return 'Choose a folder for the sample novel'
  return 'Open a Gather project folder'
}

ipcMain.handle('dialog:pickDirectory', async (_event, purpose: unknown) => {
  const chosen: DirectoryPurpose = purposes.has(purpose as DirectoryPurpose) ? (purpose as DirectoryPurpose) : 'open'
  const result = await dialog.showOpenDialog({
    title: directoryTitle(chosen),
    buttonLabel: chosen === 'open' ? 'Open' : 'Choose',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
})

ipcMain.handle('project:exists', async (_event, dir: unknown) => {
  if (typeof dir !== 'string') return false
  return projectExists(dir)
})

ipcMain.handle('project:load', async (_event, dir: unknown) => {
  if (typeof dir !== 'string') throw new Error('Choose a folder.')
  return loadProject(dir)
})

ipcMain.handle('project:save', async (_event, dir: unknown, bundle: unknown) => {
  if (typeof dir !== 'string' || !bundle || typeof bundle !== 'object') {
    throw new Error('Gather could not save the project.')
  }
  const save = bundle as SaveBundle
  await enqueue(() => saveProject(dir, save))
})

ipcMain.handle('snapshot:list', async (_event, dir: unknown, id: unknown) => {
  if (typeof dir !== 'string' || typeof id !== 'string') return []
  return listSnapshots(dir, id)
})

ipcMain.handle('snapshot:keep', async (_event, dir: unknown, id: unknown, markdown: unknown) => {
  if (typeof dir !== 'string' || typeof id !== 'string' || typeof markdown !== 'string') {
    throw new Error('Could not keep a copy.')
  }
  await keepSnapshot(dir, id, markdown)
})

ipcMain.handle('snapshot:read', async (_event, dir: unknown, id: unknown, name: unknown) => {
  if (typeof dir !== 'string' || typeof id !== 'string' || typeof name !== 'string') {
    throw new Error('Could not read that copy.')
  }
  return readSnapshot(dir, id, name)
})

ipcMain.handle('window:title', (event, title: unknown) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const text = typeof title === 'string' && title.trim() ? title.trim() : 'Gather'
  win?.setTitle(text)
})

async function chooseSavePath(defaultName: string, filterName: string, extension: string): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: filterName, extensions: [extension] }],
  })
  if (result.canceled || !result.filePath) return null
  return withExtension(result.filePath, extension)
}

ipcMain.handle('export:text', async (_event, request: unknown) => {
  const exportRequest = request as TextExport
  if (!exportRequest || typeof exportRequest.data !== 'string') throw new Error('Nothing to export.')
  const filePath = await chooseSavePath(exportRequest.defaultName, exportRequest.filterName, exportRequest.extension)
  if (!filePath) return null
  await writeFile(filePath, exportRequest.data, 'utf8')
  return filePath
})

ipcMain.handle('export:epub', async (_event, request: unknown) => {
  const exportRequest = request as EpubExport
  if (!exportRequest || !Array.isArray(exportRequest.files)) throw new Error('Nothing to export.')
  const filePath = await chooseSavePath(exportRequest.defaultName, 'EPUB', 'epub')
  if (!filePath) return null
  const packed = packEpub(exportRequest.files)
  await writeFile(filePath, packed)
  return filePath
})

ipcMain.handle('export:pdf', async (_event, request: unknown) => {
  const exportRequest = request as PdfExport
  if (!exportRequest || typeof exportRequest.html !== 'string') throw new Error('Nothing to export.')
  if (!Number.isFinite(exportRequest.widthMicrons) || !Number.isFinite(exportRequest.heightMicrons)) {
    throw new Error('The print preset is missing a page size.')
  }
  const filePath = await chooseSavePath(exportRequest.defaultName, 'PDF', 'pdf')
  if (!filePath) return null
  await printPdf(exportRequest, filePath)
  return filePath
})

void app.whenReady().then(() => {
  app.setName('Gather')
  if (process.platform === 'win32') app.setAppUserModelId('studio.gather.desktop')
  createMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
