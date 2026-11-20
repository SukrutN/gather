import { outlineRows, timelineRows } from '@shared/model'
import type { Doc } from '@shared/types'
import { useMemo, useState } from 'react'
import { statusLabel } from './Editor'
import { useStudio } from '../store'

type Sort = 'binder' | 'day'

export function Outliner(): JSX.Element {
  const { state, controller } = useStudio()
  const project = state.project
  const [sort, setSort] = useState<Sort>('binder')

  const binderRows = useMemo(() => {
    if (!project) return []
    return outlineRows(project, state.docs)
  }, [project, state.docs])

  const dayRows = useMemo(() => {
    if (!project) return []
    return timelineRows(project, state.docs)
  }, [project, state.docs])

  const nameOf = (id: string): string => {
    const doc: Doc | undefined = state.docs[id]
    return doc?.title?.trim() ?? ''
  }

  if (!project) return <></>

  return (
    <div className="outliner">
      <header className="board-head">
        <div>
          <p className="eyebrow">Outliner</p>
          <h2>{sort === 'binder' ? 'In binder order' : 'By story day'}</h2>
        </div>
        <div className="segmented" role="group" aria-label="Outline order">
          <button type="button" className={sort === 'binder' ? 'on' : ''} onClick={() => setSort('binder')}>
            Binder
          </button>
          <button type="button" className={sort === 'day' ? 'on' : ''} onClick={() => setSort('day')}>
            Timeline
          </button>
        </div>
      </header>

      {(sort === 'binder' ? binderRows : dayRows).length === 0 ? (
        <p className="empty-copy">Nothing to outline yet.</p>
      ) : sort === 'binder' ? (
        <div className="outline-table" role="table">
          <div className="outline-head" role="row">
            <span>Title</span>
            <span>Synopsis</span>
            <span>Status</span>
            <span>POV</span>
            <span>Day</span>
            <span>Words</span>
          </div>
          {binderRows.map((row) => (
            <button
              key={row.id}
              type="button"
              role="row"
              className={`outline-row kind-${row.kind}${state.selectedId === row.id ? ' selected' : ''}`}
              style={{ paddingLeft: 10 + row.depth * 18 }}
              onClick={() => controller.select(row.id, { stay: true })}
              onDoubleClick={() => {
                controller.select(row.id)
                controller.setMode('write')
              }}
            >
              <span className="outline-title">{row.title}</span>
              <span className="outline-synopsis">{row.synopsis || '—'}</span>
              <span className={`stamp ${row.status}`}>{statusLabel(row.status)}</span>
              <span>{row.pov ? nameOf(row.pov) || '—' : '—'}</span>
              <span>{row.day || '—'}</span>
              <span className="outline-words">{row.words.toLocaleString('en-US')}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="outline-table timeline" role="table">
          <div className="outline-head" role="row">
            <span>Day</span>
            <span>Scene</span>
            <span>Chapter</span>
            <span>POV</span>
            <span>Location</span>
            <span>Status</span>
            <span>Words</span>
          </div>
          {dayRows.map((row) => (
            <button
              key={row.id}
              type="button"
              role="row"
              className={`outline-row${state.selectedId === row.id ? ' selected' : ''}`}
              onClick={() => controller.select(row.id, { stay: true })}
              onDoubleClick={() => {
                controller.select(row.id)
                controller.setMode('write')
              }}
            >
              <span className="outline-day">{row.day || '—'}</span>
              <span className="outline-title">{row.title}</span>
              <span className="outline-synopsis">{row.chapter || '—'}</span>
              <span>{row.pov ? nameOf(row.pov) || '—' : '—'}</span>
              <span>{row.location ? nameOf(row.location) || '—' : '—'}</span>
              <span className={`stamp ${row.status}`}>{statusLabel(row.status)}</span>
              <span className="outline-words">{row.words.toLocaleString('en-US')}</span>
            </button>
          ))}
        </div>
      )}
      <p className="sheet-note">Click a row to select it. Double-click to open it.</p>
    </div>
  )
}
