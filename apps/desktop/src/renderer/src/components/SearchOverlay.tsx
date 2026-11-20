import { kindLabel, searchProject } from '@shared/model'
import type { SearchHit } from '@shared/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStudio } from '../store'

export function SearchOverlay(): JSX.Element | null {
  const { state, controller } = useStudio()
  const project = state.project
  const open = state.searchOpen && Boolean(project)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, controller])

  const hits = useMemo<SearchHit[]>(() => {
    if (!project || !open) return []
    return searchProject(project, state.docs, query)
  }, [project, state.docs, query, open])

  if (!open || !project) return null

  const jump = (id: string): void => {
    controller.select(id)
    controller.setSearchOpen(false)
  }

  return (
    <div className="scrim search-scrim" onClick={() => controller.setSearchOpen(false)}>
      <div
        className="dialog search-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Find in project"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="search-input"
          value={query}
          placeholder="Find in project…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && hits[0]) jump(hits[0].id)
          }}
        />
        {query.trim().length < 2 ? (
          <p className="hint search-hint">Two letters or more. It looks in titles, synopses, bodies, and notes.</p>
        ) : hits.length === 0 ? (
          <p className="hint search-hint">Nothing found.</p>
        ) : (
          <ul className="search-results">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button type="button" onClick={() => jump(hit.id)}>
                  <span className="search-result-head">
                    <strong>{hit.title}</strong>
                    <em>{kindLabel(hit.kind)}</em>
                  </span>
                  <span className="search-snippet">{hit.snippet}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
