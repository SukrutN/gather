import { useEffect, useRef, useState } from 'react'
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
          <button
            type="button"
            className={state.commentsOpen ? 'btn small' : 'btn small quiet'}
            onClick={() => controller.setCommentsOpen(!state.commentsOpen)}
          >
            {commentsLabel}
          </button>
          <ViewMenu />
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

/** The rare controls, grouped behind one menu instead of crowding the bar. */
function ViewMenu(): JSX.Element {
  const { state, controller } = useStudio()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (label: string, checked: boolean, onClick: () => void): JSX.Element => (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => {
        onClick()
        setOpen(false)
      }}
    >
      <span>{label}</span>
      <span className="menu-check">{checked ? '✓' : ''}</span>
    </button>
  )

  return (
    <div className="topbar-menu" ref={boxRef}>
      <button
        type="button"
        className="btn small quiet"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        View ▾
      </button>
      {open ? (
        <div className="menu-popover" role="menu" aria-label="View options">
          {toggle('Focus mode', state.focus, controller.toggleFocus)}
          {toggle('Dark mode', state.theme === 'dark', controller.toggleTheme)}
          {toggle('Details panel', state.inspector, controller.toggleInspector)}
          <div className="menu-separator" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              controller.setStatsOpen(true)
              setOpen(false)
            }}
          >
            <span>Writing stats…</span>
            <span className="menu-check" />
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              controller.setHistoryOpen(true)
              setOpen(false)
            }}
          >
            <span>Project history…</span>
            <span className="menu-check" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
