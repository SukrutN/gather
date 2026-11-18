import { countWords, formatWords } from '@shared/model'
import type { Doc, Status } from '@shared/types'
import { STATUSES } from '@shared/types'
import { statusLabel } from './Editor'
import { useStudio } from '../store'

export function Sheet({ doc }: { doc: Doc }): JSX.Element {
  const { controller } = useStudio()
  const place = doc.kind === 'place'
  return (
    <article className="sheet character-sheet">
      <p className="eyebrow">{place ? 'Place' : 'Character'}</p>
      <label className="field">
        <span>Name</span>
        <input value={doc.title} onChange={(event) => controller.patchDoc(doc.id, { title: event.target.value })} />
      </label>
      <label className="field">
        <span>{place ? 'Type' : 'Role'}</span>
        <input
          value={place ? doc.placeType : doc.role}
          placeholder={place ? 'Civic building, street, room' : 'Protagonist, patron, rival'}
          onChange={(event) =>
            controller.patchDoc(doc.id, place ? { placeType: event.target.value } : { role: event.target.value })
          }
        />
      </label>
      <label className="field">
        <span>Summary</span>
        <textarea
          rows={3}
          value={doc.summary}
          placeholder="A line you could find again later."
          onChange={(event) => controller.patchDoc(doc.id, { summary: event.target.value })}
        />
      </label>
      <label className="field">
        <span>Notes</span>
        <textarea
          className="notes"
          rows={10}
          value={doc.body}
          placeholder="Anything you don’t want to lose."
          onChange={(event) => controller.patchDoc(doc.id, { body: event.target.value })}
        />
      </label>
      <div className="doc-meta">
        <label className="status-field">
          <span>Status</span>
          <select value={doc.status} onChange={(event) => controller.patchDoc(doc.id, { status: event.target.value as Status })}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <span className="word-count">{formatWords(countWords(doc.body))}</span>
      </div>
    </article>
  )
}
