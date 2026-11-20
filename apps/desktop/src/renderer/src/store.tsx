import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { parseDocument, serializeDocument } from '@shared/markdown'
import { blankComment, blankReply } from '@shared/comments'
import { importManuscript } from '@shared/import'
import {
  addChoicesForSelection,
  blankDoc,
  bumpHistory,
  canContain,
  collectDocumentIds,
  createEmptyProject,
  dayKey,
  defaultTitle,
  deleteBinderNode,
  deleteDetail,
  displayTitle,
  duplicateSubtree,
  findNode,
  hydrate,
  initialSelection,
  insertAfter,
  insertChild,
  isContainer,
  isRootKind,
  locate,
  manuscriptOf,
  manuscriptWordCount,
  moveBinderNode,
  moveNode,
  parseProject,
  renameBinder,
} from '@shared/model'
import { createSample } from '@shared/sample'
import type { BinderNode, Comment, Doc, Kind, PlotThread, Project, UpdateState, VersionInfo } from '@shared/types'

export type SaveState = 'idle' | 'saved' | 'saving' | 'error'
export type StudioMode = 'write' | 'outline' | 'cork'
export type Theme = 'light' | 'dark'

export interface RecentProject {
  dir: string
  title: string
  openedAt: string
}

export interface ConfirmDelete {
  id: string
  title: string
  detail: string
}

export interface CommentDraft {
  docId: string
  excerpt: string
}

export interface StudioState {
  dir: string | null
  project: Project | null
  docs: Record<string, Doc>
  selectedId: string | null
  mode: StudioMode
  focus: boolean
  theme: Theme
  typewriter: boolean
  inspector: boolean
  commentsOpen: boolean
  historyOpen: boolean
  commentDraft: CommentDraft | null
  author: string
  comments: Comment[]
  update: UpdateState
  searchOpen: boolean
  statsOpen: boolean
  pinnedId: string | null
  compileOpen: boolean
  settingsOpen: boolean
  saveState: SaveState
  banner: string | null
  confirmDelete: ConfirmDelete | null
  collapsed: Record<string, boolean>
  recent: RecentProject | null
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // The preference just is not persisted.
  }
}

function createInitial(): StudioState {
  return {
    dir: null,
    project: null,
    docs: {},
    selectedId: null,
    mode: 'write',
    focus: false,
    theme: readLocal<Theme>('gather.theme', 'light') === 'dark' ? 'dark' : 'light',
    typewriter: readLocal<boolean>('gather.typewriter', false),
    inspector: readLocal<boolean>('gather.inspector', true),
    commentsOpen: false,
    historyOpen: false,
    commentDraft: null,
    author: readLocal<string>('gather.author', ''),
    comments: [],
    update: { state: 'idle' },
    searchOpen: false,
    statsOpen: false,
    pinnedId: null,
    compileOpen: false,
    settingsOpen: false,
    saveState: 'idle',
    banner: null,
    confirmDelete: null,
    collapsed: {},
    recent: readLocal<RecentProject | null>('gather.recent', null),
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
  openDir: (dir: string) => Promise<void>
  openRecent: () => Promise<void>
  importManuscriptFile: () => Promise<void>
  backupNow: () => Promise<void>
  researchAddFile: () => Promise<void>
  togglePin: (id: string) => void
  select: (id: string, options?: { stay?: boolean }) => void
  setMode: (mode: StudioMode) => void
  toggleFocus: () => void
  toggleTheme: () => void
  toggleTypewriter: () => void
  toggleInspector: () => void
  setCommentsOpen: (open: boolean) => void
  setHistoryOpen: (open: boolean) => void
  setAuthor: (name: string) => void
  beginComment: (docId: string, excerpt: string) => void
  cancelComment: () => void
  addComment: (body: string) => void
  replyTo: (commentId: string, body: string) => void
  toggleResolved: (commentId: string) => void
  deleteComment: (commentId: string) => void
  keepVersionNamed: (message: string) => Promise<VersionInfo[]>
  restoreDocFrom: (version: VersionInfo, docId: string) => Promise<void>
  restoreAllFrom: (version: VersionInfo) => Promise<void>
  setUpdate: (update: UpdateState) => void
  dismissUpdate: () => void
  relaunchUpdate: () => void
  checkDiskState: () => Promise<void>
  patchDoc: (id: string, patch: Partial<Doc>) => void
  add: (parentId: string, kind: Kind) => void
  move: (id: string, direction: -1 | 1) => void
  reorder: (sourceId: string, targetId: string, placement: 'inside' | 'after') => void
  duplicate: (id: string) => void
  askDelete: (id: string) => void
  confirmDelete: () => void
  cancelDelete: () => void
  setMeta: (patch: { title?: string; author?: string; wordGoal?: number; threads?: PlotThread[] }) => void
  setCompileOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setStatsOpen: (open: boolean) => void
  dismissBanner: () => void
  toggleCollapse: (id: string) => void
  clearTimer: () => void
}

function createController(setState: Dispatch<SetStateAction<StudioState>>, initial: StudioState): Controller {
  const stateRef = { current: initial }
  const removedRef = { current: [] as string[] }
  const dirtyRef = { current: false }
  const commentsDirtyRef = { current: false }
  const timerRef = { current: null as number | null }
  const queueRef = { current: Promise.resolve() }
  const busyRef = { current: false }
  const countRef = { current: 0 }
  const fingerprintRef = { current: '' }
  const lastCheckRef = { current: 0 }

  /** Reads the folder's fingerprint; flags sync-service conflict copies once. */
  async function captureStatus(dir: string): Promise<void> {
    if (!window.gather) return
    try {
      const status = await window.gather.projectStatus(dir)
      fingerprintRef.current = status.fingerprint
      if (status.conflicts > 0) {
        commit((state) =>
          state.banner
            ? state
            : {
                ...state,
                banner:
                  status.conflicts === 1
                    ? 'Found a conflicted copy made by a sync service. Gather is using the main file.'
                    : `Found ${status.conflicts} conflicted copies made by a sync service. Gather is using the main files.`,
              },
        )
      }
    } catch {
      // Status is advisory; never block on it.
    }
  }

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

  /** Like commit(save), but only marks comments dirty, not the manuscript. */
  function commitComments(recipe: (state: StudioState) => StudioState): void {
    const next = recipe(stateRef.current)
    if (next === stateRef.current) return
    stateRef.current = next
    setState(next)
    commentsDirtyRef.current = true
    schedule()
  }

  function schedule(): void {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      void persist().catch(() => undefined)
    }, 400)
  }

  function persist(): Promise<void> {
    const run = async (): Promise<void> => {
      const current = stateRef.current
      if (!current.dir || !current.project || !window.gather) return
      const docsDirty = dirtyRef.current || removedRef.current.length > 0
      const commentsChanged = commentsDirtyRef.current
      if (!docsDirty && !commentsChanged) return
      const removeIds = docsDirty ? removedRef.current.splice(0, removedRef.current.length) : []
      if (docsDirty) dirtyRef.current = false
      let project: Project = current.project
      if (docsDirty) {
        const words = manuscriptWordCount(current.project, current.docs)
        const delta = words - countRef.current
        const history =
          delta !== 0 ? bumpHistory(current.project.history, dayKey(), delta) : current.project.history
        if (delta !== 0) countRef.current = words
        project = { ...current.project, history, modified: new Date().toISOString() }
        if (project !== current.project) {
          commit((state) => (state.project ? { ...state, project } : state))
        }
      }
      const documents = Object.values(current.docs).map((doc) => ({
        id: doc.id,
        markdown: serializeDocument(doc),
      }))
      commit((state) => ({ ...state, saveState: 'saving' }))
      try {
        if (docsDirty) {
          await window.gather.saveProject(current.dir, {
            project,
            documents,
            removeIds,
          })
        }
        if (commentsChanged) {
          await window.gather.saveComments(current.dir, current.comments)
          commentsDirtyRef.current = false
        }
        commit((state) => ({ ...state, saveState: state.saveState === 'error' ? state.saveState : 'saved' }))
        void captureStatus(current.dir)
      } catch (error) {
        if (docsDirty) {
          dirtyRef.current = true
          removedRef.current = [...removeIds, ...removedRef.current]
        }
        commit((state) => ({ ...state, saveState: 'error', banner: messageOf(error) }))
        schedule()
        throw error
      }
      if (dirtyRef.current || removedRef.current.length > 0 || commentsDirtyRef.current) schedule()
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
    if (!dirtyRef.current && removedRef.current.length === 0 && !commentsDirtyRef.current) return
    await persist()
  }

  /** Version blobs store the writing state; session stamps are excluded so
   * unchanged opens do not pile up checkpoints. */
  function versionProjectString(project: Project): string {
    return `${JSON.stringify({ ...project, modified: '', history: {} }, null, 2)}\n`
  }

  function checkpoint(message: string): Promise<VersionInfo[]> {
    const current = stateRef.current
    if (!current.dir || !current.project || !window.gather) {
      return Promise.reject(new Error('No project open.'))
    }
    return window.gather.keepVersion(current.dir, {
      message,
      project: versionProjectString(current.project),
      docs: Object.values(current.docs).map((doc) => ({ id: doc.id, markdown: serializeDocument(doc) })),
    })
  }

  async function adopt(dir: string): Promise<void> {
    if (!window.gather) return
    const loaded = await window.gather.loadProject(dir)
    const hydrated = hydrate(loaded.project, loaded.documents)
    removedRef.current = []
    commentsDirtyRef.current = false
    countRef.current = manuscriptWordCount(hydrated.project, hydrated.docs)
    const recent: RecentProject = {
      dir,
      title: displayTitle(loaded.project.title),
      openedAt: new Date().toISOString(),
    }
    writeLocal('gather.recent', recent)
    commit(
      () => ({
        ...createInitial(),
        dir,
        project: hydrated.project,
        docs: hydrated.docs,
        comments: loaded.comments,
        selectedId: initialSelection(hydrated.project),
        saveState: 'saved',
        banner: hydrated.missing
          ? 'Some files were missing. They’ll be written the next time you save.'
          : null,
        recent,
      }),
      hydrated.titlesChanged,
    )
    void captureStatus(dir)
    void checkpoint('')
      .then(() => undefined)
      .catch((error: unknown) => {
        commit((state) => ({ ...state, banner: messageOf(error) }))
      })
  }

  /** Reloads the folder state, keeping your place where the book still has it. */
  async function reloadFromDisk(dir: string): Promise<void> {
    const previous = { mode: stateRef.current.mode, selectedId: stateRef.current.selectedId }
    await adopt(dir)
    commit((state) => {
      if (!state.project) return state
      const stillThere = previous.selectedId ? findNode(state.project.binder, previous.selectedId) : null
      return {
        ...state,
        mode: previous.mode,
        selectedId: stillThere ? (previous.selectedId as string) : state.selectedId,
        banner: 'The folder changed on disk; Gather reloaded the latest state.',
      }
    })
  }

  /** On focus: if the folder changed behind Gather, pick it up — or warn. */
  async function checkDiskState(): Promise<void> {
    const current = stateRef.current
    if (!current.dir || !current.project || !window.gather) return
    if (busyRef.current) return
    const now = Date.now()
    if (now - lastCheckRef.current < 250) return
    lastCheckRef.current = now
    try {
      const status = await window.gather.projectStatus(current.dir)
      if (status.fingerprint === fingerprintRef.current) return
      fingerprintRef.current = status.fingerprint
      const unsaved = dirtyRef.current || commentsDirtyRef.current || removedRef.current.length > 0
      if (unsaved) {
        commit((state) => ({
          ...state,
          banner: 'The folder changed on disk. Save with Ctrl+S, then reopen the project to see it.',
        }))
        return
      }
      await reloadFromDisk(current.dir)
    } catch {
      // Advisory only.
    }
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
            banner: 'This folder already has a Gather project. Open that instead.',
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
            banner: 'This folder already has a Gather project. Pick another folder for the sample.',
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
    openDir: (dir: string) =>
      guard(async () => {
        if (!window.gather || !dir) return
        if (!(await window.gather.projectExists(dir))) {
          commit((state) => ({ ...state, banner: 'That folder is not a Gather project.' }))
          return
        }
        await adopt(dir)
      }),
    openRecent: () =>
      guard(async () => {
        const recent = stateRef.current.recent
        if (!recent || !window.gather) return
        if (!(await window.gather.projectExists(recent.dir))) {
          commit((state) => ({ ...state, recent: null, banner: 'The last project folder is gone.' }))
          writeLocal('gather.recent', null)
          return
        }
        await adopt(recent.dir)
      }),
    importManuscriptFile: () =>
      guard(async () => {
        const current = stateRef.current
        if (!current.project || !window.gather) return
        const manuscript = manuscriptOf(current.project)
        if (!manuscript) return
        const file = await window.gather.pickImportFile()
        if (!file) return
        const imported = importManuscript(file.text)
        if (imported.chapters.length === 0) {
          commit((state) => ({ ...state, banner: 'That file had no text to import.' }))
          return
        }
        let binder = current.project.binder
        const docs = { ...current.docs }
        let firstSceneId: string | null = null
        let firstChapterId: string | null = null
        let scenes = 0
        for (const chapter of imported.chapters) {
          const chapterId = crypto.randomUUID()
          const children: BinderNode[] = []
          for (const scene of chapter.scenes) {
            const sceneId = crypto.randomUUID()
            children.push({ id: sceneId, kind: 'scene', title: scene.title })
            docs[sceneId] = { ...blankDoc(sceneId, 'scene', scene.title), body: scene.body }
            firstSceneId = firstSceneId ?? sceneId
            scenes += 1
          }
          const chapterNode: BinderNode = { id: chapterId, kind: 'chapter', title: chapter.title, children }
          docs[chapterId] = { ...blankDoc(chapterId, 'chapter', chapter.title), body: chapter.body }
          firstChapterId = firstChapterId ?? chapterId
          binder = insertChild(binder, manuscript.id, chapterNode)
        }
        const selected = firstSceneId ?? firstChapterId
        const chapterWord =
          imported.chapters.length === 1 ? '1 chapter' : `${imported.chapters.length} chapters`
        const sceneWord = scenes === 1 ? '1 scene' : `${scenes} scenes`
        commit((state) => ({
          ...state,
          mode: 'write' as const,
          selectedId: selected,
          collapsed: { ...state.collapsed, [manuscript.id]: false },
          docs,
          project: state.project ? { ...state.project, binder } : state.project,
          banner: `Imported ${chapterWord}${scenes ? ` and ${sceneWord}` : ''} from “${file.name}”.`,
        }), true)
      }),
    backupNow: () =>
      guard(async () => {
        const current = stateRef.current
        if (!current.dir || !window.gather) return
        const target = await window.gather.backupProject(current.dir)
        if (target) {
          commit((state) => ({ ...state, banner: `Backup saved to ${target}.` }))
        }
      }),
    researchAddFile: () =>
      guard(async () => {
        const current = stateRef.current
        if (!current.project || !current.dir || !window.gather) return
        const shelf = current.project.binder.find((node) => node.kind === 'research')
        if (!shelf) return
        const name = await window.gather.researchAdd(current.dir)
        if (!name) return
        const node: BinderNode = { id: crypto.randomUUID(), kind: 'file', title: name }
        commit((state) => ({
          ...state,
          collapsed: { ...state.collapsed, [shelf.id]: false },
          project: state.project
            ? { ...state.project, binder: insertChild(state.project.binder, shelf.id, node) }
            : state.project,
          banner: `Added “${name}” to Research.`,
        }), true)
      }),
    togglePin: (id: string) =>
      commit((state) => ({ ...state, pinnedId: state.pinnedId === id ? null : id })),
    select: (id: string, options?: { stay?: boolean }) => {
      commit((state) => {
        if (!state.project) return state
        const node = findNode(state.project.binder, id)
        if (!node) return state
        const writing =
          node.kind === 'scene' ||
          node.kind === 'character' ||
          node.kind === 'place' ||
          node.kind === 'note' ||
          node.kind === 'file'
        return {
          ...state,
          selectedId: id,
          mode: options?.stay ? state.mode : writing ? 'write' : state.mode,
        }
      })
    },
    setMode: (mode: StudioMode) => commit((state) => ({ ...state, mode })),
    toggleFocus: () => commit((state) => ({ ...state, focus: !state.focus })),
    toggleTheme: () => commit((state) => ({ ...state, theme: state.theme === 'dark' ? 'light' : 'dark' })),
    toggleTypewriter: () => commit((state) => ({ ...state, typewriter: !state.typewriter })),
    toggleInspector: () => commit((state) => ({ ...state, inspector: !state.inspector })),
    setCommentsOpen: (open: boolean) =>
      commit((state) => ({ ...state, commentsOpen: open, inspector: open ? false : state.inspector })),
    setHistoryOpen: (open: boolean) => commit((state) => ({ ...state, historyOpen: open })),
    setAuthor: (name: string) => {
      writeLocal('gather.author', name)
      commit((state) => ({ ...state, author: name }))
    },
    beginComment: (docId: string, excerpt: string) =>
      commit((state) => ({
        ...state,
        commentDraft: { docId, excerpt },
        commentsOpen: true,
        inspector: false,
      })),
    cancelComment: () => commit((state) => ({ ...state, commentDraft: null })),
    addComment: (body: string) => {
      const draft = stateRef.current.commentDraft
      const text = body.trim()
      if (!draft || !text) return
      const comment = blankComment(crypto.randomUUID(), draft.docId, stateRef.current.author, text, draft.excerpt)
      commitComments((state) => ({ ...state, comments: [...state.comments, comment], commentDraft: null }))
    },
    replyTo: (commentId: string, body: string) => {
      const text = body.trim()
      if (!text) return
      const reply = blankReply(crypto.randomUUID(), stateRef.current.author, text)
      commitComments((state) => ({
        ...state,
        comments: state.comments.map((comment) =>
          comment.id === commentId ? { ...comment, replies: [...comment.replies, reply] } : comment,
        ),
      }))
    },
    toggleResolved: (commentId: string) =>
      commitComments((state) => ({
        ...state,
        comments: state.comments.map((comment) =>
          comment.id === commentId ? { ...comment, resolved: !comment.resolved } : comment,
        ),
      })),
    deleteComment: (commentId: string) =>
      commitComments((state) => ({
        ...state,
        comments: state.comments.filter((comment) => comment.id !== commentId),
      })),
    keepVersionNamed: (message: string) => checkpoint(message),
    restoreDocFrom: (version: VersionInfo, docId: string) =>
      guard(async () => {
        const current = stateRef.current
        if (!current.dir || !window.gather) return
        const doc = current.docs[docId]
        if (!doc) return
        const markdown = await window.gather.readVersionDoc(current.dir, version.id, docId)
        await window.gather.keepSnapshot(current.dir, docId, serializeDocument(doc))
        const restored = parseDocument(markdown, doc)
        commit((state) => {
          const target = state.docs[docId]
          if (!target) return state
          return { ...state, docs: { ...state.docs, [docId]: { ...restored, id: docId, kind: target.kind } } }
        }, true)
      }),
    restoreAllFrom: (version: VersionInfo) =>
      guard(async () => {
        const current = stateRef.current
        if (!current.dir || !window.gather) return
        const projectJson = await window.gather.readVersionProject(current.dir, version.id)
        const project = parseProject(JSON.parse(projectJson) as unknown)
        const files: Array<{ id: string; markdown: string }> = []
        for (const [id, hash] of Object.entries(version.docs)) {
          if (!hash) continue
          files.push({ id, markdown: await window.gather.readVersionDoc(current.dir, version.id, id) })
        }
        const hydrated = hydrate(project, files)
        const removed = Object.keys(current.docs).filter((id) => !(id in hydrated.docs))
        removedRef.current.push(...removed)
        commit(
          (state) => ({
            ...state,
            project: {
              ...hydrated.project,
              modified: new Date().toISOString(),
              history: state.project?.history ?? {},
            },
            docs: hydrated.docs,
            selectedId: initialSelection(hydrated.project),
            confirmDelete: null,
            banner: `Restored the version from ${new Date(version.savedAt).toLocaleString()}.`,
          }),
          true,
        )
      }),
    setUpdate: (update: UpdateState) => commit((state) => ({ ...state, update })),
    dismissUpdate: () => commit((state) => ({ ...state, update: { state: 'idle' } })),
    relaunchUpdate: () => {
      void window.gather?.relaunchUpdate()
    },
    checkDiskState: () => checkDiskState(),
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
    reorder: (sourceId: string, targetId: string, placement: 'inside' | 'after') => {
      commit((state) => {
        if (!state.project) return state
        const binder = moveNode(state.project.binder, sourceId, targetId, placement)
        if (binder === state.project.binder) return state
        return { ...state, project: { ...state.project, binder } }
      }, true)
    },
    duplicate: (id: string) => {
      const state = stateRef.current
      if (!state.project) return
      const loc = locate(state.project.binder, id)
      if (!loc?.parent) return
      if (loc.node.kind === 'file') return
      const copy = duplicateSubtree(loc.node, state.docs)
      commit((state) => {
        if (!state.project) return state
        const docs = { ...state.docs }
        for (const doc of copy.docs) docs[doc.id] = doc
        return {
          ...state,
          mode: 'write' as const,
          selectedId: copy.node.id,
          docs,
          project: { ...state.project, binder: insertAfter(state.project.binder, id, copy.node) },
        }
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
      // Research files also live on disk; remove the file itself.
      if (loc.node.kind === 'file') {
        const parent = loc.parent
        if (stateRef.current.dir && window.gather) {
          void window.gather
            .researchRemove(stateRef.current.dir, loc.node.title)
            .catch((error: unknown) => {
              commit((state) => ({ ...state, banner: messageOf(error) }))
            })
        }
        commit((state) => {
          if (!state.project) return state
          return {
            ...state,
            confirmDelete: null,
            selectedId:
              state.selectedId === pending.id
                ? ((parent?.children ?? []).find((child) => child.id !== pending.id)?.id ?? parent?.id ?? state.selectedId)
                : state.selectedId,
            project: { ...state.project, binder: deleteBinderNode(state.project.binder, pending.id) },
          }
        }, true)
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
    setMeta: (patch: { title?: string; author?: string; wordGoal?: number; threads?: PlotThread[] }) => {
      commit((state) => {
        if (!state.project) return state
        return { ...state, project: { ...state.project, ...patch } }
      }, true)
    },
    setCompileOpen: (open: boolean) => commit((state) => ({ ...state, compileOpen: open })),
    setSettingsOpen: (open: boolean) => commit((state) => ({ ...state, settingsOpen: open })),
    setSearchOpen: (open: boolean) => commit((state) => ({ ...state, searchOpen: open })),
    setStatsOpen: (open: boolean) => commit((state) => ({ ...state, statsOpen: open })),
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
      if (action === 'search') controller.setSearchOpen(true)
      if (action === 'theme') controller.toggleTheme()
      if (action === 'import') void controller.importManuscriptFile()
      if (action === 'backup') void controller.backupNow()
    })
  }, [controller])

  useEffect(() => {
    const gather = window.gather
    if (!gather) return
    let alive = true
    void gather.launchDir().then((dir) => {
      if (alive && dir) void controller.openDir(dir)
    })
    return () => {
      alive = false
    }
  }, [controller])

  useEffect(() => {
    const onFocus = (): void => {
      void controller.checkDiskState()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
    }
  }, [controller])

  useEffect(() => {
    if (!window.gather) return
    return window.gather.onUpdateState((update) => controller.setUpdate(update))
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

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    writeLocal('gather.theme', state.theme)
  }, [state.theme])

  useEffect(() => {
    writeLocal('gather.typewriter', state.typewriter)
  }, [state.typewriter])

  useEffect(() => {
    writeLocal('gather.inspector', state.inspector)
  }, [state.inspector])

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
