import { displayTitle, formatWords, manuscriptWordCount } from '@shared/model'
import { useStudio } from '../store'

export function TopBar(): JSX.Element {
  const { state, controller } = useStudio()
  const project = state.project
  const words = project ? manuscriptWordCount(project, state.docs) : 0
  const saveLabel =
    state.saveState === 'saving' ? 'Saving' : state.saveState === 'error' ? 'Not saved' : state.saveState === 'saved' ? 'Saved' : ''
  const goal = project?.wordGoal ?? 0
  const goalLabel =
    goal > 0 ? `${formatWords(words)} · ${Math.min(100, Math.round((words / goal) * 100))}% of goal` : formatWords(words)
  const unresolved = state.comments.filter((comment) => !comment.resolved).length
  const commentsLabel = unresolved ? `Comments (${unresolved})` : 'Comments'

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
              className={state.mode === 'outline' ? 'on' : ''}
              onClick={() => controller.setMode('outline')}
            >
              Outline
            </button>
            <button
              type="button"
              className={state.mode === 'cork' ? 'on' : ''}
              onClick={() => controller.setMode('cork')}
            >
              Corkboard
            </button>
          </div>
          <button type="button" className="btn small quiet" onClick={() => controller.setSearchOpen(true)}>
            Search
          </button>
          <button type="button" className="btn small quiet" onClick={() => controller.setHistoryOpen(true)}>
            History
          </button>
          <button
            type="button"
            className={state.commentsOpen ? 'btn small' : 'btn small quiet'}
            onClick={() => controller.setCommentsOpen(!state.commentsOpen)}
          >
            {commentsLabel}
          </button>
          <button type="button" className="btn small quiet" onClick={controller.toggleTheme}>
            {state.theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          <button type="button" className="btn small quiet" onClick={() => controller.setStatsOpen(true)}>
            Stats
          </button>
          <button
            type="button"
            className={state.inspector ? 'btn small' : 'btn small quiet'}
            aria-pressed={state.inspector}
            onClick={controller.toggleInspector}
            disabled={state.mode !== 'write'}
            title="Show the details panel"
          >
            Details
          </button>
          <button type="button" className={state.focus ? 'btn small' : 'btn small quiet'} onClick={controller.toggleFocus}>
            {state.focus ? 'Show binder' : 'Focus'}
          </button>
          <button type="button" className="btn small quiet" onClick={() => controller.setCompileOpen(true)}>
            Compile
          </button>
          <div className="top-status">
            <span>{goalLabel}</span>
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
