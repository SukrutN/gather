import { findNode, isRootKind } from '@shared/model'
import { Binder } from './components/Binder'
import { CompileDialog } from './components/CompileDialog'
import { ConfirmDialog } from './components/ConfirmDialog'
import { Corkboard } from './components/Corkboard'
import { Editor } from './components/Editor'
import { FolderView } from './components/FolderView'
import { SettingsDialog } from './components/SettingsDialog'
import { Sheet } from './components/Sheet'
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
  } else if (state.mode === 'cork') {
    stage = <Corkboard />
  } else if (!node) {
    stage = <p className="empty-copy stage-empty">Select something in the binder.</p>
  } else if (isRootKind(node.kind)) {
    stage = <FolderView node={node} />
  } else if ((node.kind === 'character' || node.kind === 'place') && doc) {
    stage = <Sheet key={doc.id} doc={doc} />
  } else if (doc) {
    stage = <Editor key={doc.id} doc={doc} />
  } else {
    stage = <p className="empty-copy stage-empty">This item has no page yet.</p>
  }

  return (
    <div className={state.focus ? 'app focus' : 'app'}>
      <TopBar />
      {state.banner && project ? (
        <p className="banner bar" role="alert">
          {state.banner}
          <button type="button" onClick={controller.dismissBanner}>
            Dismiss
          </button>
        </p>
      ) : null}
      {project ? (
        <div className="workspace">
          <Binder />
          <main className="stage">{stage}</main>
        </div>
      ) : (
        <main className="stage welcome-stage">{stage}</main>
      )}
      <CompileDialog />
      <SettingsDialog />
      <ConfirmDialog />
    </div>
  )
}
