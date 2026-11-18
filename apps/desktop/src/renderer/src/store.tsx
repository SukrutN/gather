import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { serializeDocument } from '@shared/markdown'
import {
  addChoicesForSelection,
  blankDoc,
  canContain,
  collectDocumentIds,
  createEmptyProject,
  defaultTitle,
  deleteBinderNode,
  deleteDetail,
  displayTitle,
  findNode,
  hydrate,
  initialSelection,
  insertChild,
  isContainer,
  isRootKind,
  locate,
  moveBinderNode,
  renameBinder,
} from '@shared/model'
import { createSample } from '@shared/sample'
import type { Doc, Kind, Project } from '@shared/types'

export type SaveState = 'idle' | 'saved' | 'saving' | 'error'
export type StudioMode = 'write' | 'cork'

export interface ConfirmDelete {
  id: string
  title: string
  detail: string
}

export interface StudioState {
  dir: string | null
  project: Project | null
  docs: Record<string, Doc>
  selectedId: string | null
  mode: StudioMode
  focus: boolean
  compileOpen: boolean
  settingsOpen: boolean
  saveState: SaveState
  banner: string | null
  confirmDelete: ConfirmDelete | null
  collapsed: Record<string, boolean>
}

function createInitial(): StudioState {
  return {
    dir: null,
    project: null,
    docs: {},
    selectedId: null,
    mode: 'write',
    focus: false,
    compileOpen: false,
    settingsOpen: false,
    saveState: 'idle',
    banner: null,
    confirmDelete: null,
    collapsed: {},
  }
}

function messageOf(error: unknown): string {
  const raw = error instanceof Error && error.message ? error.message : 'Something went wrong.'
  const match = /^Error invoking remote method '[^']+': ([\s\S]*)$/.exec(raw)
  return match?.[1] || raw
}

interface Controller {
  saveNow: () => Promise<void>
  flushIfDirty: () => Promise<void>
  newProject: () => Promise<void>
  openProject: () => Promise<void>
  openSample: () => Promise<void>
  select: (id: string) => void
  setMode: (mode: StudioMode) => void
  toggleFocus: () => void
  patchDoc: (id: string, patch: Partial<Doc>) => void
  add: (parentId: string, kind: Kind) => void
  move: (id: string, direction: -1 | 1) => void
  askDelete: (id: string) => void
  confirmDelete: () => void
  cancelDelete: () => void
  setMeta: (patch: { title?: string; author?: string }) => void
  setCompileOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  dismissBanner: () => void
  toggleCollapse: (id: string) => void
  clearTimer: () => void
}

function createController(setState: Dispatch<SetStateAction<StudioState>>, initial: StudioState): Controller {
  const stateRef = { current: initial }
  const removedRef = { current: [] as string[] }
  const dirtyRef = { current: false }
  const timerRef = { current: null as number | null }
  const queueRef = { current: Promise.resolve() }
  const busyRef = { current: false }

  function commit(recipe: (state: StudioState) => StudioState, save = false): void {
    const next = recipe(stateRef.current)
    if (next === stateRef.current) return
    stateRef.current = next
    setState(next)
    if (save) {
      dirtyRef.current = true
      schedule()
    }
  }

  function schedule(): void {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      void persist()
    }, 400)
  }

  function persist(): Promise<void> {
    const run = async (): Promise<void> => {
      const current = stateRef.current
      if (!current.dir || !current.project || !window.gather) return
      if (!dirtyRef.current && removedRef.current.length === 0) return
      const removeIds = removedRef.current.splice(0, removedRef.current.length)
      dirtyRef.current = false
      const documents = Object.values(current.docs).map((doc) => ({
        id: doc.id,
        markdown: serializeDocument(doc),
      }))
      commit((state) => ({ ...state, saveState: 'saving' }))
      try {
        await window.gather.saveProject(current.dir, {
          project: { ...current.project, modified: new Date().toISOString() },
          documents,
          removeIds,
        })
        commit((state) => ({ ...state, saveState: state.saveState === 'error' ? state.saveState : 'saved' }))
      } catch (error) {
        dirtyRef.current = true
        removedRef.current = [...removeIds, ...removedRef.current]
        commit((state) => ({ ...state, saveState: 'error', banner: messageOf(error) }))
        throw error
      }
      if (dirtyRef.current || removedRef.current.length > 0) schedule()
    }
    const next = queueRef.current.then(run, run)
    queueRef.current = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  async function saveNow(): Promise<void> {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    dirtyRef.current = true
    await persist()
  }

  async function flushIfDirty(): Promise<void> {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    if (!dirtyRef.current && removedRef.current.length === 0) return
    await persist()
  }

  async function adopt(dir: string): Promise<void> {
    if (!window.gather) return
    const loaded = await window.gather.loadProject(dir)
    const hydrated = hydrate(loaded.project, loaded.documents)
    removedRef.current = []
    commit(
      () => ({
        ...createInitial(),
        dir,
        project: hydrated.project,
        docs: hydrated.docs,
        selectedId: initialSelection(hydrated.project),
        saveState: 'saved',
        banner: hydrated.missing
          ? 'Some documents were missing. They will be recreated the next time Gather saves.'
          : null,
      }),
      hydrated.titlesChanged,
    )
  }

  async function guard(task: () => Promise<void>): Promise<void> {
    if (busyRef.current) return
    busyRef.current = true
    try {
      await task()
    } catch (error) {
      commit((state) => ({ ...state, banner: messageOf(error) }))
    } finally {
      busyRef.current = false
    }
  }

  return {
    clearTimer: () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    },
    saveNow,
    flushIfDirty,
    newProject: () =>
      guard(async () => {
        if (!window.gather) return
        const dir = await window.gather.pickDirectory('new')
        if (!dir) return
        if (await window.gather.projectExists(dir)) {
          commit((state) => ({
            ...state,
            banner: 'This folder already holds a Gather project. Open it instead.',
          }))
          return
        }
        const project = createEmptyProject()
        await window.gather.saveProject(dir, { project, documents: [], removeIds: [] })
        await adopt(dir)
      }),
    openProject: () =>
      guard(async () => {
        if (!window.gather) return
        const dir = await window.gather.pickDirectory('open')
        if (!dir) return
        await adopt(dir)
      }),
    openSample: () =>
      guard(async () => {
        if (!window.gather) return
        const dir = await window.gather.pickDirectory('sample')
        if (!dir) return
        if (await window.gather.projectExists(dir)) {
          commit((state) => ({
            ...state,
            banner: 'This folder already holds a Gather project. Choose a different folder for the sample.',
          }))
          return
        }
        const sample = createSample()
        await window.gather.saveProject(dir, {
          project: sample.project,
          documents: Object.values(sample.docs).map((doc) => ({
            id: doc.id,
            markdown: serializeDocument(doc),
          })),
          removeIds: [],
        })
        await adopt(dir)
      }),
    select: (id: string) => {
      commit((state) => {
        if (!state.project) return state
        const node = findNode(state.project.binder, id)
        if (!node) return state
        const writing =
          node.kind === 'scene' || node.kind === 'character' || node.kind === 'place' || node.kind === 'note'
        return { ...state, selectedId: id, mode: writing ? 'write' : state.mode }
      })
    },
    setMode: (mode: StudioMode) => commit((state) => ({ ...state, mode })),
    toggleFocus: () => commit((state) => ({ ...state, focus: !state.focus })),
    patchDoc: (id: string, patch: Partial<Doc>) => {
      commit((state) => {
        const current = state.docs[id]
        if (!current || !state.project) return state
        const nextDoc: Doc = { ...current, ...patch, id: current.id, kind: current.kind }
        let project: Project = state.project
        if (patch.title !== undefined) {
          project = { ...project, binder: renameBinder(project.binder, id, patch.title) }
        }
        return { ...state, docs: { ...state.docs, [id]: nextDoc }, project }
      }, true)
    },
    add: (parentId: string, kind: Kind) => {
      commit((state) => {
        if (!state.project) return state
        const parent = findNode(state.project.binder, parentId)
        if (!parent || !canContain(parent.kind, kind)) return state
        const id = crypto.randomUUID()
        const title = defaultTitle(kind)
        const node = isContainer(kind) ? { id, kind, title, children: [] } : { id, kind, title }
        return {
          ...state,
          mode: 'write' as const,
          selectedId: id,
          collapsed: { ...state.collapsed, [parentId]: false },
          docs: { ...state.docs, [id]: blankDoc(id, kind, title) },
          project: { ...state.project, binder: insertChild(state.project.binder, parentId, node) },
        }
      }, true)
    },
    move: (id: string, direction: -1 | 1) => {
      commit((state) => {
        if (!state.project) return state
        const binder = moveBinderNode(state.project.binder, id, direction)
        if (binder === state.project.binder) return state
        return { ...state, project: { ...state.project, binder } }
      }, true)
    },
    askDelete: (id: string) => {
      const project = stateRef.current.project
      if (!project) return
      const loc = locate(project.binder, id)
      if (!loc?.parent || isRootKind(loc.node.kind)) return
      commit((state) => ({
        ...state,
        confirmDelete: {
          id,
          title: `Remove “${displayTitle(loc.node.title)}”?`,
          detail: deleteDetail(loc.node),
        },
      }))
    },
    confirmDelete: () => {
      const pending = stateRef.current.confirmDelete
      const project = stateRef.current.project
      if (!pending || !project) return
      const loc = locate(project.binder, pending.id)
      if (!loc?.parent) {
        commit((state) => ({ ...state, confirmDelete: null }))
        return
      }
      const ids = collectDocumentIds(loc.node)
      removedRef.current.push(...ids)
      const list = loc.parent.children ?? []
      const index = list.findIndex((node) => node.id === pending.id)
      const sibling = list[index + 1] ?? list[index - 1]
      const selected = stateRef.current.selectedId
      const nextSelected = selected && (selected === pending.id || ids.includes(selected)) ? (sibling?.id ?? loc.parent.id) : selected
      const docs = { ...stateRef.current.docs }
      for (const id of ids) delete docs[id]
      commit((state) => ({
        ...state,
        confirmDelete: null,
        docs,
        selectedId: nextSelected,
        project: state.project ? { ...state.project, binder: deleteBinderNode(state.project.binder, pending.id) } : state.project,
      }), true)
    },
    cancelDelete: () => commit((state) => ({ ...state, confirmDelete: null })),
    setMeta: (patch: { title?: string; author?: string }) => {
      commit((state) => {
        if (!state.project) return state
        return { ...state, project: { ...state.project, ...patch } }
      }, true)
    },
    setCompileOpen: (open: boolean) => commit((state) => ({ ...state, compileOpen: open })),
    setSettingsOpen: (open: boolean) => commit((state) => ({ ...state, settingsOpen: open })),
    dismissBanner: () => commit((state) => ({ ...state, banner: null })),
    toggleCollapse: (id: string) => {
      commit((state) => ({ ...state, collapsed: { ...state.collapsed, [id]: !state.collapsed[id] } }))
    },
  }
}

interface StudioContextValue {
  state: StudioState
  controller: Controller
  choices: ReturnType<typeof addChoicesForSelection>
}

const StudioContext = createContext<StudioContextValue | null>(null)

export function GatherProvider({ children }: { children: ReactNode }): ReactNode {
  const [state, setState] = useState(createInitial)
  const controllerRef = useRef<Controller | null>(null)
  if (!controllerRef.current) controllerRef.current = createController(setState, state)
  const controller = controllerRef.current

  useEffect(() => {
    if (!window.gather) return
    return window.gather.onMenu((action) => {
      if (action === 'new') void controller.newProject()
      if (action === 'open') void controller.openProject()
      if (action === 'sample') void controller.openSample()
      if (action === 'compile') controller.setCompileOpen(true)
      if (action === 'focus') controller.toggleFocus()
      if (action === 'save') void controller.saveNow()
    })
  }, [controller])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void controller.saveNow()
      }
    }
    const onLeave = (): void => {
      void controller.flushIfDirty()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', onLeave)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', onLeave)
      controller.clearTimer()
    }
  }, [controller])

  useEffect(() => {
    const title = state.project?.title.trim()
    void window.gather?.setTitle(title ? `${title} — Gather` : 'Gather')
  }, [state.project?.title])

  const choices = useMemo(
    () => (state.project ? addChoicesForSelection(state.project.binder, state.selectedId) : []),
    [state.project, state.selectedId],
  )

  const value = useMemo(() => ({ state, controller, choices }), [state, controller, choices])
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}

export function useStudio(): StudioContextValue {
  const value = useContext(StudioContext)
  if (!value) throw new Error('useStudio must be used inside GatherProvider.')
  return value
}
