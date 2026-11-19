export const STATUSES = ['idea', 'draft', 'revised', 'done'] as const

export type Status = (typeof STATUSES)[number]

export const KINDS = [
  'manuscript',
  'part',
  'chapter',
  'scene',
  'characters',
  'character',
  'places',
  'place',
  'notes',
  'note',
] as const

export type Kind = (typeof KINDS)[number]

export interface BinderNode {
  id: string
  kind: Kind
  title: string
  children?: BinderNode[]
}

export interface PlotThread {
  id: string
  name: string
  color: string
}

export interface Relationship {
  characterId: string
  note: string
}

export interface Project {
  format: 'gather-project'
  version: 1
  title: string
  author: string
  wordGoal: number
  threads: PlotThread[]
  created: string
  modified: string
  binder: BinderNode[]
}

export interface ExtraField {
  key: string
  value: string
}

export interface Doc {
  id: string
  kind: Kind
  title: string
  status: Status
  synopsis: string
  body: string
  role: string
  placeType: string
  summary: string
  pov: string
  location: string
  thread: string
  storyDay: string
  wordGoal: number
  goal: string
  fear: string
  secret: string
  sense: string
  control: string
  relationships: Relationship[]
  extra: ExtraField[]
}

export type DirectoryPurpose = 'new' | 'open' | 'sample'

export interface DocumentFile {
  id: string
  markdown: string
}

export interface SaveBundle {
  project: Project
  documents: DocumentFile[]
  removeIds: string[]
}

export interface TextExport {
  defaultName: string
  extension: 'md' | 'html'
  filterName: string
  data: string
}

export interface EpubFile {
  path: string
  text: string
}

export interface EpubExport {
  defaultName: string
  files: EpubFile[]
}

export interface PdfExport {
  defaultName: string
  html: string
  widthMicrons: number
  heightMicrons: number
}

export interface SnapshotInfo {
  name: string
  savedAt: string
}

export interface SearchHit {
  id: string
  title: string
  kind: Kind
  snippet: string
}

export type MenuAction = 'new' | 'open' | 'sample' | 'compile' | 'focus' | 'save'

export interface GatherApi {
  pickDirectory: (purpose: DirectoryPurpose) => Promise<string | null>
  projectExists: (dir: string) => Promise<boolean>
  loadProject: (dir: string) => Promise<{ project: Project; documents: DocumentFile[] }>
  saveProject: (dir: string, bundle: SaveBundle) => Promise<void>
  saveText: (request: TextExport) => Promise<string | null>
  saveEpub: (request: EpubExport) => Promise<string | null>
  savePdf: (request: PdfExport) => Promise<string | null>
  setTitle: (title: string) => Promise<void>
  listSnapshots: (dir: string, id: string) => Promise<SnapshotInfo[]>
  keepSnapshot: (dir: string, id: string, markdown: string) => Promise<void>
  readSnapshot: (dir: string, id: string, name: string) => Promise<string>
  onMenu: (handler: (action: MenuAction) => void) => () => void
  onOpenFolder: (handler: (dir: string) => void) => () => void
}
