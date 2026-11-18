import { useEffect, useState } from 'react'
import { useStudio } from '../store'

export function SettingsDialog(): JSX.Element | null {
  const { state, controller } = useStudio()
  const project = state.project
  const [title, setTitle] = useState(project?.title ?? '')
  const [author, setAuthor] = useState(project?.author ?? '')

  useEffect(() => {
    if (!state.settingsOpen || !project) return
    setTitle(project.title)
    setAuthor(project.author)
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

  return (
    <div className="scrim">
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onSubmit={(event) => {
          event.preventDefault()
          controller.setMeta({ title, author })
          controller.setSettingsOpen(false)
        }}
      >
        <p className="eyebrow">Project</p>
        <h2 id="settings-title">Title page</h2>
        <p>Compile uses these on the title page of Markdown, HTML, EPUB, and PDF.</p>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Author</span>
          <input value={author} onChange={(event) => setAuthor(event.target.value)} />
        </label>
        <footer className="dialog-actions">
          <button type="button" className="btn quiet" onClick={() => controller.setSettingsOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="btn">
            Save settings
          </button>
        </footer>
      </form>
    </div>
  )
}
