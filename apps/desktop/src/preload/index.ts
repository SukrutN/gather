import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  Comment,
  DirectoryPurpose,
  DocxExport,
  EpubExport,
  GatherApi,
  KeepVersionPayload,
  MenuAction,
  PdfExport,
  SaveBundle,
  TextExport,
  UpdateState,
} from '@shared/types'

const api: GatherApi = {
  pickDirectory: (purpose: DirectoryPurpose) => ipcRenderer.invoke('dialog:pickDirectory', purpose),
  projectExists: (dir: string) => ipcRenderer.invoke('project:exists', dir),
  loadProject: (dir: string) => ipcRenderer.invoke('project:load', dir),
  saveProject: (dir: string, bundle: SaveBundle) => ipcRenderer.invoke('project:save', dir, bundle),
  saveComments: (dir: string, comments: Comment[]) => ipcRenderer.invoke('comments:save', dir, comments),
  keepVersion: (dir: string, payload: KeepVersionPayload) => ipcRenderer.invoke('version:keep', dir, payload),
  listVersions: (dir: string) => ipcRenderer.invoke('version:list', dir),
  readVersionDoc: (dir: string, versionId: string, docId: string) =>
    ipcRenderer.invoke('version:readDoc', dir, versionId, docId),
  readVersionProject: (dir: string, versionId: string) => ipcRenderer.invoke('version:readProject', dir, versionId),
  relaunchUpdate: () => ipcRenderer.invoke('app:relaunchUpdate'),
  projectStatus: (dir: string) => ipcRenderer.invoke('project:status', dir),
  pickImportFile: () => ipcRenderer.invoke('import:pickText'),
  backupProject: (dir: string) => ipcRenderer.invoke('project:backup', dir),
  researchAdd: (dir: string) => ipcRenderer.invoke('research:add', dir),
  researchOpen: (dir: string, name: string) => ipcRenderer.invoke('research:open', dir, name),
  researchReveal: (dir: string, name: string) => ipcRenderer.invoke('research:reveal', dir, name),
  researchRemove: (dir: string, name: string) => ipcRenderer.invoke('research:remove', dir, name),
  onUpdateState: (handler: (state: UpdateState) => void) => {
    const listener = (_event: IpcRendererEvent, state: UpdateState) => handler(state)
    ipcRenderer.on('update-state', listener)
    return () => ipcRenderer.removeListener('update-state', listener)
  },
  saveText: (request: TextExport) => ipcRenderer.invoke('export:text', request),
  saveEpub: (request: EpubExport) => ipcRenderer.invoke('export:epub', request),
  saveDocx: (request: DocxExport) => ipcRenderer.invoke('export:docx', request),
  savePdf: (request: PdfExport) => ipcRenderer.invoke('export:pdf', request),
  setTitle: (title: string) => ipcRenderer.invoke('window:title', title),
  listSnapshots: (dir: string, id: string) => ipcRenderer.invoke('snapshot:list', dir, id),
  keepSnapshot: (dir: string, id: string, markdown: string) => ipcRenderer.invoke('snapshot:keep', dir, id, markdown),
  readSnapshot: (dir: string, id: string, name: string) => ipcRenderer.invoke('snapshot:read', dir, id, name),
  onMenu: (handler: (action: MenuAction) => void) => {
    const listener = (_event: IpcRendererEvent, action: MenuAction) => handler(action)
    ipcRenderer.on('menu', listener)
    return () => ipcRenderer.removeListener('menu', listener)
  },
  launchDir: () => ipcRenderer.invoke('app:launchDir'),
}

contextBridge.exposeInMainWorld('gather', api)
