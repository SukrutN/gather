import { countWords, displayTitle, formatWords } from '@shared/model'
import type { Doc, Status } from '@shared/types'
import { STATUSES } from '@shared/types'
import { useEffect, useRef } from 'react'
import { useStudio } from '../store'

const STATUS_LABEL: Record<Status, string> = {
  idea: 'Idea',
  draft: 'Draft',
  revised: 'Revised',
  done: 'Done',
}

export function Editor({ doc }: { doc: Doc }): JSX.Element {
  const { controller } = useStudio()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [doc.body, doc.id])

  const placeholder =
    doc.kind === 'chapter'
      ? 'Optional text before the scenes.'
      : doc.kind === 'part'
        ? 'Optional text for this part.'
        : doc.kind === 'note'
          ? 'Keep the thought here.'
          : 'Write the scene.'

  return (
    <article className="sheet">
      <input
        className="doc-title"
        aria-label="Title"
        value={doc.title}
        placeholder="Untitled"
        onChange={(event) => controller.patchDoc(doc.id, { title: event.target.value })}
      />
      <textarea
        className="synopsis"
        aria-label="Synopsis"
        rows={2}
        value={doc.synopsis}
        placeholder="What happens, in a sentence or two."
        onChange={(event) => controller.patchDoc(doc.id, { synopsis: event.target.value })}
      />
      <div className="doc-meta">
        <label className="status-field">
          <span>Status</span>
          <select
            value={doc.status}
            onChange={(event) => controller.patchDoc(doc.id, { status: event.target.value as Status })}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </label>
        <span className="word-count">{formatWords(countWords(doc.body))}</span>
      </div>
      <textarea
        ref={bodyRef}
        className="manuscript"
        aria-label="Body"
        value={doc.body}
        placeholder={placeholder}
        spellCheck
        onChange={(event) => controller.patchDoc(doc.id, { body: event.target.value })}
      />
      <p className="sheet-note">The binder name follows this title. {displayTitle(doc.title)} is saved with the project.</p>
    </article>
  )
}

export function statusLabel(status: Status): string {
  return STATUS_LABEL[status]
}
