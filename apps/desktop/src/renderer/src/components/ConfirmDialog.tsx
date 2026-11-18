import { useEffect } from 'react'
import { useStudio } from '../store'

export function ConfirmDialog(): JSX.Element | null {
  const { state, controller } = useStudio()
  const pending = state.confirmDelete
  useEffect(() => {
    if (!pending) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.cancelDelete()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, controller])
  if (!pending) return null
  return (
    <div className="scrim">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{pending.title}</h2>
        <p>{pending.detail}</p>
        <footer className="dialog-actions">
          <button type="button" className="btn quiet" onClick={controller.cancelDelete}>
            Keep it
          </button>
          <button type="button" className="btn danger" onClick={controller.confirmDelete}>
            Remove
          </button>
        </footer>
      </div>
    </div>
  )
}
