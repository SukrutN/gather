import { proseToHtml } from '@shared/compile'
import { displayTitle } from '@shared/model'
import { useStudio } from '../store'

/** A pinned page shown under the editor for quick reference. */
export function QuickRef(): JSX.Element | null {
  const { state, controller } = useStudio()
  const doc = state.pinnedId ? state.docs[state.pinnedId] : null
  if (!doc) return null
  return (
    <section className="quickref" aria-label="Reference">
      <header className="quickref-head">
        <strong>{displayTitle(doc.title)}</strong>
        <span className="quickref-note">pinned reference</span>
        <button type="button" onClick={() => controller.togglePin(doc.id)}>
          Close
        </button>
      </header>
      <div className="quickref-body" dangerouslySetInnerHTML={{ __html: proseToHtml(doc.body) }} />
    </section>
  )
}
