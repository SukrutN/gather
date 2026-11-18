import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  DirectoryPurpose,
  EpubExport,
  GatherApi,
  MenuAction,
  PdfExport,
  SaveBundle,
  TextExport,
} from '@shared/types'

const api: GatherApi = {
  pickDirectory: (purpose: DirectoryPurpose) => ipcRenderer.invoke('dialog:pickDirectory', purpose),
  projectExists: (dir: string) => ipcRenderer.invoke('project:exists', dir),
  loadProject: (dir: string) => ipcRenderer.invoke('project:load', dir),
  saveProject: (dir: string, bundle: SaveBundle) => ipcRenderer.invoke('project:save', dir, bundle),
  saveText: (request: TextExport) => ipcRenderer.invoke('export:text', request),
  saveEpub: (request: EpubExport) => ipcRenderer.invoke('export:epub', request),
  savePdf: (request: PdfExport) => ipcRenderer.invoke('export:pdf', request),
  setTitle: (title: string) => ipcRenderer.invoke('window:title', title),
  onMenu: (handler: (action: MenuAction) => void) => {
    const listener = (_event: IpcRendererEvent, action: MenuAction) => handler(action)
    ipcRenderer.on('menu', listener)
    return () => ipcRenderer.removeListener('menu', listener)
  },
}

contextBridge.exposeInMainWorld('gather', api)
