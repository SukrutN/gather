import { readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { BrowserWindow, Menu, app, dialog, ipcMain, shell } from 'electron'
import type {
  DirectoryPurpose,
  DocxExport,
  EpubExport,
  KeepVersionPayload,
  MenuAction,
  PdfExport,
  SaveBundle,
  TextExport,
  UpdateState,
  VersionInfo,
} from '@shared/types'
import { backupDefaultName, backupProject } from './backup'
import { readComments, writeComments } from './comments-file'
import { addResearchFile, openResearchFile, removeResearchFile, revealResearchFile } from './research'
import { keepSnapshot, listSnapshots, loadProject, printPdf, projectExists, readSnapshot, saveProject, withExtension } from './project-files'
import { keepVersion, listVersions, readVersionDoc, readVersionProject } from './history'
import { projectStatus } from './status'
import { packDocx, packEpub } from './zip'

let updaterModule: typeof import('electron-updater') | null = null

function send(action: MenuAction): void {
  const win = BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu', action)
}

function sendUpdateState(state: UpdateState): void {
  const win = BrowserWindow.getAllWindows()[0]
  win?.webContents.send('update-state', state)
}

let chain: Promise<void> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task)
  chain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function createMenu(): void {
  const fileSubmenu: Electron.MenuItemConstructorOptions[] = [
    { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => send('new') },
    { label: 'Open Project', accelerator: 'CmdOrCtrl+O', click: () => send('open') },
    { label: 'Open Sample', click: () => send('sample') },
    { type: 'separator' },
    { label: 'Import Manuscript…', accelerator: 'CmdOrCtrl+Shift+M', click: () => send('import') },
    { label: 'Back Up Project…', click: () => send('backup') },
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
        { label: 'Toggle Focus Mode', accelerator: 'CmdOrCtrl+Shift+D', click: () => send('focus') },
        { label: 'Find in Project', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('search') },
        { label: 'Toggle Dark Mode', accelerator: 'CmdOrCtrl+Shift+L', click: () => send('theme') },
        { type: 'separator' },
        { label: 'Writing Stats…', click: () => send('stats') },
        { label: 'Project History…', click: () => send('history') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Check for Updates…', click: () => void checkForUpdatesInteractive() },
        { label: 'Learn More', click: () => void shell.openExternal('https://github.com/SukrutN/gather') },
        { type: 'separator' },
        {
          label: 'About Gather',
          click: () => {
            void dialog.showMessageBox({
              type: 'info',
              title: 'Gather',
              message: `Gather ${app.getVersion()}`,
              detail: 'A local-first novel studio. Your book is a folder of plain files.',
            })
          },
        },
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
  const loaded = await loadProject(dir)
  const comments = await readComments(dir)
  return { ...loaded, comments }
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

ipcMain.handle('comments:save', async (_event, dir: unknown, comments: unknown) => {
  if (typeof dir !== 'string') throw new Error('Comments could not be saved.')
  await enqueue(() => writeComments(dir, comments))
})

ipcMain.handle('version:keep', async (_event, dir: unknown, payload: unknown) => {
  if (typeof dir !== 'string' || !payload || typeof payload !== 'object') {
    throw new Error('Could not keep a version.')
  }
  return keepVersion(dir, payload as KeepVersionPayload)
})

ipcMain.handle('version:list', async (_event, dir: unknown) => {
  if (typeof dir !== 'string') return [] as VersionInfo[]
  return listVersions(dir)
})

ipcMain.handle('version:readDoc', async (_event, dir: unknown, versionId: unknown, docId: unknown) => {
  if (typeof dir !== 'string' || typeof versionId !== 'string' || typeof docId !== 'string') {
    throw new Error('That page is not in this history.')
  }
  return readVersionDoc(dir, versionId, docId)
})

ipcMain.handle('version:readProject', async (_event, dir: unknown, versionId: unknown) => {
  if (typeof dir !== 'string' || typeof versionId !== 'string') {
    throw new Error('That version is not in this history.')
  }
  return readVersionProject(dir, versionId)
})

ipcMain.handle('app:relaunchUpdate', async () => {
  if (!updaterModule) {
    sendUpdateState({ state: 'error', message: 'No update has been downloaded.' })
    return
  }
  updaterModule.autoUpdater.quitAndInstall()
})

ipcMain.handle('project:status', async (_event, dir: unknown) => {
  if (typeof dir !== 'string') throw new Error('Choose a folder.')
  return projectStatus(dir)
})

ipcMain.handle('import:pickText', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Choose a manuscript to import',
    buttonLabel: 'Import',
    properties: ['openFile'],
    filters: [{ name: 'Manuscripts', extensions: ['md', 'txt', 'markdown'] }],
  })
  if (result.canceled || !result.filePaths[0]) return null
  const file = result.filePaths[0]
  const text = await readFile(file, 'utf8')
  return { name: basename(file), text }
})

ipcMain.handle('project:backup', async (_event, dir: unknown) => {
  if (typeof dir !== 'string') throw new Error('Choose a folder.')
  const result = await dialog.showSaveDialog({
    title: 'Back up the project',
    defaultPath: backupDefaultName(),
    filters: [{ name: 'ZIP archive', extensions: ['zip'] }],
  })
  if (result.canceled || !result.filePath) return null
  const target = withExtension(result.filePath, 'zip')
  await backupProject(dir, target)
  return target
})

ipcMain.handle('research:add', async (_event, dir: unknown) => {
  if (typeof dir !== 'string') throw new Error('Choose a folder.')
  const result = await dialog.showOpenDialog({
    title: 'Choose a research file',
    buttonLabel: 'Add',
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return addResearchFile(result.filePaths[0], dir)
})

ipcMain.handle('research:open', async (_event, dir: unknown, name: unknown) => {
  if (typeof dir !== 'string' || typeof name !== 'string') throw new Error('That research file is missing.')
  await openResearchFile(dir, name)
})

ipcMain.handle('research:reveal', async (_event, dir: unknown, name: unknown) => {
  if (typeof dir !== 'string' || typeof name !== 'string') throw new Error('That research file is missing.')
  await revealResearchFile(dir, name)
})

ipcMain.handle('research:remove', async (_event, dir: unknown, name: unknown) => {
  if (typeof dir !== 'string' || typeof name !== 'string') throw new Error('That research file is missing.')
  await removeResearchFile(dir, name)
})

async function loadUpdater(): Promise<typeof import('electron-updater') | null> {
  if (updaterModule) return updaterModule
  if (!app.isPackaged) return null
  try {
    updaterModule = await import('electron-updater')
    const { autoUpdater } = updaterModule
    autoUpdater.autoDownload = true
    autoUpdater.on('checking-for-update', () => sendUpdateState({ state: 'checking' }))
    autoUpdater.on('update-available', (info) => sendUpdateState({ state: 'available', version: info.version }))
    autoUpdater.on('update-not-available', (info) => sendUpdateState({ state: 'none', version: info.version }))
    autoUpdater.on('update-downloaded', (info) => sendUpdateState({ state: 'downloaded', version: info.version }))
    autoUpdater.on('error', (error) =>
      sendUpdateState({ state: 'error', message: error.message || 'The update check failed.' }),
    )
    return updaterModule
  } catch {
    return null
  }
}

async function checkForUpdatesInteractive(): Promise<void> {
  const updater = await loadUpdater()
  if (!updater) {
    await dialog.showMessageBox({
      type: 'info',
      title: 'Gather',
      message: 'You are running Gather from source.',
      detail: 'Updates apply to the installed app. Build one with npm run dist, or grab the latest release from GitHub.',
    })
    return
  }
  await updater.autoUpdater.checkForUpdates().catch(() => undefined)
}

ipcMain.handle('window:title', (event, title: unknown) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const text = typeof title === 'string' && title.trim() ? title.trim() : 'Gather'
  win?.setTitle(text)
})

ipcMain.handle('app:launchDir', () => {
  const dir = process.env.GATHER_PROJECT
  return typeof dir === 'string' && dir ? dir : null
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

ipcMain.handle('export:docx', async (_event, request: unknown) => {
  const exportRequest = request as DocxExport
  if (!exportRequest || !Array.isArray(exportRequest.files)) throw new Error('Nothing to export.')
  const filePath = await chooseSavePath(exportRequest.defaultName, 'Word document', 'docx')
  if (!filePath) return null
  const packed = packDocx(exportRequest.files)
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
  void (async () => {
    const updater = await loadUpdater()
    if (updater) await updater.autoUpdater.checkForUpdates().catch(() => undefined)
  })()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
