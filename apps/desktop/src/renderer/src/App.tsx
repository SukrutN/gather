import { findNode, isRootKind } from '@shared/model'
import { Binder } from './components/Binder'
import { CommentsPanel } from './components/CommentsPanel'
import { CompileDialog } from './components/CompileDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Corkboard } from './components/Corkboard'
import { Editor } from './components/Editor'
import { FileView } from './components/FileView'
import { FolderView } from './components/FolderView'
import { hasInspector, Inspector } from './components/Inspector'
import { HistoryDialog } from './components/HistoryDialog'
import { Outliner } from './components/Outliner'
import { QuickRef } from './components/QuickRef'
import { SearchOverlay } from './components/SearchOverlay'
import { SettingsDialog } from './components/SettingsDialog'
import { Sheet } from './components/Sheet'
import { StatsDialog } from './components/StatsDialog'
import { TopBar } from './components/TopBar'
import { Welcome } from './components/Welcome'
import { useStudio } from './store'

export function App(): JSX.Element {
  const { state, controller } = useStudio()
  const project = state.project
  const node = project && state.selectedId ? findNode(project.binder, state.selectedId) : null
  const doc = node ? state.docs[node.id] : undefined

  let stage: JSX.Element
  if (!project) {
    stage = <Welcome />
  } else if (state.mode === 'outline') {
    stage = <Outliner />
  } else if (state.mode === 'cork') {
    stage = <Corkboard />
  } else if (!node) {
    stage = <p className="empty-copy stage-empty">Select something in the binder.</p>
  } else if (isRootKind(node.kind)) {
    stage = <FolderView node={node} />
  } else if (node.kind === 'file') {
    stage = <FileView node={node} />
  } else if ((node.kind === 'character' || node.kind === 'place') && doc) {
    stage = <Sheet key={doc.id} doc={doc} />
  } else if (doc) {
    stage = <Editor key={doc.id} doc={doc} />
  } else {
    stage = <p className="empty-copy stage-empty">This item has no page yet.</p>
  }

  const showComments = Boolean(project && state.commentsOpen)
  const showInspector = Boolean(
    project && !state.commentsOpen && state.inspector && state.mode === 'write' && node && doc && hasInspector(node.kind),
  )

  return (
    <div className={state.focus ? 'app focus' : 'app'}>
      <TopBar />
      {state.update.state === 'downloaded' ? (
        <p className="update-bar bar" role="status">
          Gather {state.update.version} is ready.
          <span className="bar-actions">
            <button type="button" onClick={controller.relaunchUpdate}>
              Restart to update
            </button>
            <button type="button" onClick={controller.dismissUpdate}>
              Later
            </button>
          </span>
        </p>
      ) : null}
      {state.banner && project ? (
        <p className="banner bar" role="alert">
          {state.banner}
          <button type="button" onClick={controller.dismissBanner}>
            Dismiss
          </button>
        </p>
      ) : null}
      {project ? (
        <div className={showComments || showInspector ? 'workspace with-inspector' : 'workspace'}>
          <Binder />
          <main className="stage">
            {stage}
            {state.mode === 'write' && state.pinnedId ? <QuickRef /> : null}
          </main>
          {showComments ? <CommentsPanel /> : showInspector ? <Inspector /> : null}
        </div>
      ) : (
        <main className="stage welcome-stage">{stage}</main>
      )}
      <CompileDialog />
      <SettingsDialog />
      <ConfirmDialog />
      <SearchOverlay />
      <StatsDialog />
      <HistoryDialog />
    </div>
  )
}
