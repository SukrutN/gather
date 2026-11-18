import { displayTitle, formatWords, manuscriptWordCount } from '@shared/model'
import { useStudio } from '../store'

export function TopBar(): JSX.Element {
  const { state, controller } = useStudio()
  const project = state.project
  const words = project ? manuscriptWordCount(project, state.docs) : 0
  const saveLabel =
    state.saveState === 'saving' ? 'Saving' : state.saveState === 'error' ? 'Not saved' : state.saveState === 'saved' ? 'Saved' : ''

  return (
    <header className="topbar">
      <div className="brand">Gather</div>
      {project ? (
        <>
          <button className="project-name" type="button" onClick={() => controller.setSettingsOpen(true)}>
            {displayTitle(project.title)}
          </button>
          <div className="segmented" role="group" aria-label="View">
            <button
              type="button"
              className={state.mode === 'write' ? 'on' : ''}
              onClick={() => controller.setMode('write')}
            >
              Editor
            </button>
            <button
              type="button"
              className={state.mode === 'cork' ? 'on' : ''}
              onClick={() => controller.setMode('cork')}
            >
              Corkboard
            </button>
          </div>
          <button type="button" className={state.focus ? 'btn small' : 'btn small quiet'} onClick={controller.toggleFocus}>
            {state.focus ? 'Show binder' : 'Focus'}
          </button>
          <button type="button" className="btn small quiet" onClick={() => controller.setCompileOpen(true)}>
            Compile
          </button>
          <div className="top-status">
            <span>{formatWords(words)}</span>
            <span className="save-state" aria-live="polite">
              {saveLabel}
            </span>
          </div>
        </>
      ) : (
        <div className="top-status">
          <span>No project open</span>
        </div>
      )}
    </header>
  )
}
