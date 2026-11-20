import { parseDocument, serializeDocument } from '@shared/markdown'
import { countWords, formatWords } from '@shared/model'
import type { Doc, SnapshotInfo, Status } from '@shared/types'
import { STATUSES } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { useStudio } from '../store'

const STATUS_LABEL: Record<Status, string> = {
  idea: 'Idea',
  draft: 'Draft',
  revised: 'Revised',
  done: 'Done',
}

export function Editor({ doc }: { doc: Doc }): JSX.Element {
  const { state, controller } = useStudio()
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<{ start: number; end: number } | null>(null)

  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    if (pendingSelection.current) {
      el.setSelectionRange(pendingSelection.current.start, pendingSelection.current.end)
      pendingSelection.current = null
    }
  }, [doc.body, doc.id])

  /** Wraps (or unwraps) the selection in Markdown emphasis markers. */
  const wrapSelection = (marker: string): void => {
    const el = bodyRef.current
    if (!el) return
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const value = el.value
    const before = value.slice(0, start)
    const selected = value.slice(start, end)
    const after = value.slice(end)
    if (before.endsWith(marker) && after.startsWith(marker)) {
      controller.patchDoc(doc.id, {
        body: `${before.slice(0, -marker.length)}${selected}${after.slice(marker.length)}`,
      })
      pendingSelection.current = { start: start - marker.length, end: end - marker.length }
    } else {
      controller.patchDoc(doc.id, { body: `${before}${marker}${selected}${marker}${after}` })
      pendingSelection.current = { start: start + marker.length, end: end + marker.length }
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!(event.metaKey || event.ctrlKey)) return
    const key = event.key.toLowerCase()
    if (key === 'b') {
      event.preventDefault()
      wrapSelection('**')
    } else if (key === 'i') {
      event.preventDefault()
      wrapSelection('*')
    }
  }

  useEffect(() => {
    if (!state.typewriter) return
    const el = bodyRef.current
    const stage = el?.closest('.stage')
    if (!el || !(stage instanceof HTMLElement)) return
    const center = (): void => {
      const caret = el.selectionStart ?? 0
      const line = el.value.slice(0, caret).split('\n').length - 1
      const style = window.getComputedStyle(el)
      const lineHeight = Number.parseFloat(style.lineHeight) || 30
      const top = el.offsetTop + line * lineHeight
      stage.scrollTo({ top: Math.max(0, top - stage.clientHeight * 0.38) })
    }
    el.addEventListener('input', center)
    el.addEventListener('keyup', center)
    el.addEventListener('click', center)
    center()
    return () => {
      el.removeEventListener('input', center)
      el.removeEventListener('keyup', center)
      el.removeEventListener('click', center)
    }
  }, [state.typewriter, doc.id])

  const placeholder =
    doc.kind === 'chapter'
      ? 'Text before the scenes, if you want any.'
      : doc.kind === 'part'
        ? 'Text for this part, if you want any.'
        : doc.kind === 'note'
          ? 'Write the note.'
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
        placeholder="A short reminder of what happens."
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
        <div className="doc-meta-tools">
          <button
            type="button"
            className={state.pinnedId === doc.id ? 'btn small' : 'btn small quiet'}
            aria-pressed={state.pinnedId === doc.id}
            title="Show this page below the editor while you write elsewhere"
            onClick={() => controller.togglePin(doc.id)}
          >
            {state.pinnedId === doc.id ? 'Pinned' : 'Pin as reference'}
          </button>
          <button
            type="button"
            className="btn small quiet"
            title="Comment on the selected text"
            onClick={() => {
              const el = bodyRef.current
              if (!el) return
              const start = el.selectionStart ?? 0
              const end = el.selectionEnd ?? 0
              const excerpt =
                end > start ? el.value.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 120) : ''
              controller.beginComment(doc.id, excerpt)
            }}
          >
            Comment
          </button>
          <button
            type="button"
            className={state.typewriter ? 'btn small' : 'btn small quiet'}
            aria-pressed={state.typewriter}
            onClick={controller.toggleTypewriter}
          >
            Typewriter
          </button>
          <Snapshots doc={doc} />
        </div>
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
        onKeyDown={onKeyDown}
      />
      <p className="sheet-note">
        This title is the name in the binder. Ctrl+B and Ctrl+I wrap the selection in bold and italic.
      </p>
    </article>
  )
}

export function statusLabel(status: Status): string {
  return STATUS_LABEL[status]
}

function Snapshots({ doc }: { doc: Doc }): JSX.Element {
  const { state, controller } = useStudio()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<SnapshotInfo[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const dir = state.dir

  useEffect(() => {
    if (!open || !dir || !window.gather) return
    const gather = window.gather
    let alive = true
    void (async () => {
      try {
        const found = await gather.listSnapshots(dir, doc.id)
        if (alive) setList(found)
      } catch {
        if (alive) setList([])
      }
    })()
    return () => {
      alive = false
    }
  }, [open, dir, doc.id, version])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const keep = async (): Promise<void> => {
    if (!dir || !window.gather) return
    await window.gather.keepSnapshot(dir, doc.id, serializeDocument(doc))
    setVersion((value) => value + 1)
  }

  const restore = async (name: string): Promise<void> => {
    if (!dir || !window.gather) return
    try {
      const markdown = await window.gather.readSnapshot(dir, doc.id, name)
      await window.gather.keepSnapshot(dir, doc.id, serializeDocument(doc))
      const restored = parseDocument(markdown, doc)
      controller.patchDoc(doc.id, restored)
      setPending(null)
      setOpen(false)
    } catch {
      setPending(null)
    }
  }

  return (
    <div className="snapshots">
      <button type="button" className="btn small quiet" onClick={() => setOpen(!open)}>
        Copies{list.length ? ` (${list.length})` : ''}
      </button>
      {open ? (
        <div className="popover" role="dialog" aria-label="Copies of this page">
          <button type="button" className="btn small" onClick={() => void keep()}>
            Keep a copy now
          </button>
          {list.length === 0 ? (
            <p className="hint">No copies yet.</p>
          ) : (
            <ul className="snapshot-list">
              {list.map((item) => (
                <li key={item.name}>
                  <span>{item.savedAt}</span>
                  {pending === item.name ? (
                    <>
                      <button type="button" className="btn small danger" onClick={() => void restore(item.name)}>
                        Restore it
                      </button>
                      <button type="button" className="btn small quiet" onClick={() => setPending(null)}>
                        Don’t
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn small quiet" onClick={() => setPending(item.name)}>
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="hint">Restoring first keeps a copy of what is here now.</p>
        </div>
      ) : null}
    </div>
  )
}
