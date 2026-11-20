import { THREAD_COLORS } from '@shared/model'
import { useEffect, useState } from 'react'
import { useStudio } from '../store'

interface ThreadDraft {
  id: string
  name: string
  color: string
}

export function SettingsDialog(): JSX.Element | null {
  const { state, controller } = useStudio()
  const project = state.project
  const [title, setTitle] = useState(project?.title ?? '')
  const [author, setAuthor] = useState(project?.author ?? '')
  const [goal, setGoal] = useState(project?.wordGoal ? String(project.wordGoal) : '')
  const [threads, setThreads] = useState<ThreadDraft[]>([])

  useEffect(() => {
    if (!state.settingsOpen || !project) return
    setTitle(project.title)
    setAuthor(project.author)
    setGoal(project.wordGoal ? String(project.wordGoal) : '')
    setThreads(project.threads.map((thread) => ({ ...thread })))
  }, [state.settingsOpen, project])

  useEffect(() => {
    if (!state.settingsOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.settingsOpen, controller])

  if (!state.settingsOpen || !project) return null

  const addThread = (): void => {
    setThreads((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: 'New thread',
        color: THREAD_COLORS[current.length % THREAD_COLORS.length],
      },
    ])
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const wordGoal = Number(goal)
    controller.setMeta({
      title,
      author,
      wordGoal: Number.isFinite(wordGoal) && wordGoal > 0 ? Math.round(wordGoal) : 0,
      threads: threads.filter((thread) => thread.name.trim() || thread.color),
    })
    controller.setSettingsOpen(false)
  }

  return (
    <div className="scrim" onClick={() => controller.setSettingsOpen(false)}>
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id="settings-title">Project settings</h2>
        <p>The title and author go on the title page when you export.</p>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Author</span>
          <input value={author} onChange={(event) => setAuthor(event.target.value)} />
        </label>
        <label className="field">
          <span>Manuscript word goal</span>
          <input
            type="number"
            min={0}
            value={goal}
            placeholder="No goal"
            onChange={(event) => setGoal(event.target.value)}
          />
        </label>
        <div className="inspector-section">
          <div className="inspector-label">Plot threads</div>
          {threads.length === 0 ? <p className="hint">Color-coded threads you can tag scenes with.</p> : null}
          {threads.map((thread, index) => (
            <div className="thread-row" key={thread.id}>
              <select
                aria-label="Thread color"
                value={thread.color}
                onChange={(event) => {
                  const next = [...threads]
                  next[index] = { ...thread, color: event.target.value }
                  setThreads(next)
                }}
              >
                {THREAD_COLORS.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <input
                aria-label="Thread name"
                value={thread.name}
                onChange={(event) => {
                  const next = [...threads]
                  next[index] = { ...thread, name: event.target.value }
                  setThreads(next)
                }}
              />
              <button
                type="button"
                className="btn small danger"
                aria-label="Remove thread"
                onClick={() => setThreads(threads.filter((_, at) => at !== index))}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn small quiet" onClick={addThread}>
            Add a thread
          </button>
        </div>
        <footer className="dialog-actions">
          <button type="button" className="btn quiet" onClick={() => controller.setSettingsOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Save
          </button>
        </footer>
      </form>
    </div>
  )
}
