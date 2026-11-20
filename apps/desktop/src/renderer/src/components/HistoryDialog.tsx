import { collapseContext, isUnchanged, lineDiff, type DiffRow } from '@shared/diff'
import { displayTitle, findNode } from '@shared/model'
import type { VersionInfo } from '@shared/types'
import { useEffect, useState } from 'react'
import { useStudio } from '../store'

interface ChangedDoc {
  id: string
  change: 'added' | 'edited' | 'deleted'
}

function changesBetween(prev: VersionInfo | undefined, current: VersionInfo): ChangedDoc[] {
  const before = prev?.docs ?? {}
  const out: ChangedDoc[] = []
  for (const [id, hash] of Object.entries(current.docs)) {
    const was = before[id]
    if (was === undefined) {
      if (hash) out.push({ id, change: 'added' })
      continue
    }
    if (was !== hash) out.push({ id, change: hash ? 'edited' : 'deleted' })
  }
  for (const [id, was] of Object.entries(before)) {
    if (was && !(id in current.docs)) out.push({ id, change: 'deleted' })
  }
  return out
}

function formatStamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoryDialog(): JSX.Element | null {
  const { state, controller } = useStudio()
  const dir = state.dir
  const open = state.historyOpen && Boolean(dir)
  const [versions, setVersions] = useState<VersionInfo[]>([])
  const [versionId, setVersionId] = useState<string | null>(null)
  const [docId, setDocId] = useState<string | null>(null)
  const [diff, setDiff] = useState<DiffRow[]>([])
  const [diffBusy, setDiffBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !dir || !window.gather) return
    let alive = true
    void window.gather
      .listVersions(dir)
      .then((list) => {
        if (!alive) return
        setVersions(list)
        setVersionId((current) => current ?? list[list.length - 1]?.id ?? null)
        setError(null)
      })
      .catch((caught: unknown) => {
        if (alive) setError(caught instanceof Error ? caught.message : 'The history could not be read.')
      })
    return () => {
      alive = false
    }
  }, [open, dir])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.setHistoryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, controller])

  const versionIndex = versions.findIndex((item) => item.id === versionId)
  const version = versionIndex >= 0 ? (versions[versionIndex] as VersionInfo) : null
  const previous = versionIndex > 0 ? (versions[versionIndex - 1] as VersionInfo) : undefined
  const changed = version ? changesBetween(previous, version) : []

  useEffect(() => {
    if (!open || !dir || !versionId || !docId || !window.gather) return
    const gather = window.gather
    const current = versions.find((item) => item.id === versionId)
    let alive = true
    setDiffBusy(true)
    const afterPromise = current?.docs[docId]
      ? gather.readVersionDoc(dir, versionId, docId)
      : Promise.resolve('')
    const beforePromise = previous?.docs[docId]
      ? gather.readVersionDoc(dir, previous.id, docId)
      : Promise.resolve('')
    void Promise.all([beforePromise, afterPromise])
      .then(([before, after]) => {
        if (!alive) return
        setDiff(collapseContext(lineDiff(before, after)))
        setDiffBusy(false)
      })
      .catch(() => {
        if (!alive) return
        setDiff([])
        setDiffBusy(false)
      })
    return () => {
      alive = false
    }
  }, [open, dir, versionId, docId, previous, versions])

  if (!open || !dir) return null

  const pageName = (id: string, change: ChangedDoc['change']): string => {
    const node = findNode(state.project?.binder ?? [], id)
    const title = displayTitle(node?.title ?? state.docs[id]?.title ?? '')
    return change === 'deleted' && !node ? `${title} (deleted)` : title
  }

  const keep = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const list = await controller.keepVersionNamed(message.trim())
      setVersions(list)
      setMessage('')
      setVersionId(list[list.length - 1]?.id ?? null)
      setDocId(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The version could not be kept.')
    } finally {
      setBusy(false)
    }
  }

  const newest = [...versions].reverse()

  return (
    <div className="scrim" onClick={() => controller.setHistoryOpen(false)}>
      <div
        className="dialog history-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="history-title">History</h2>
          <p>Every time the project changes between opens, Gather keeps an automatic checkpoint.</p>
        </header>

        <div className="history-keep">
          <input
            value={message}
            placeholder="Name this version (optional)"
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void keep()
            }}
          />
          <button className="btn small" type="button" disabled={busy} onClick={() => void keep()}>
            {busy ? 'Keeping…' : 'Keep a version now'}
          </button>
        </div>

        {error ? (
          <p className="banner" role="alert">
            {error}
          </p>
        ) : null}

        <div className="history-grid">
          <div className="version-list" role="list" aria-label="Versions">
            {newest.length === 0 ? (
              <p className="hint">No versions yet. Keep one, or just reopen the project.</p>
            ) : (
              newest.map((item) => {
                const index = versions.findIndex((entry) => entry.id === item.id)
                const prev = index > 0 ? (versions[index - 1] as VersionInfo) : undefined
                const count = changesBetween(prev, item).length
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={item.id === versionId ? 'version-row selected' : 'version-row'}
                    onClick={() => {
                      setVersionId(item.id)
                      setDocId(null)
                    }}
                  >
                    <span className="version-stamp">{formatStamp(item.savedAt)}</span>
                    <span className="version-message">{item.message || 'Automatic'}</span>
                    <span className="version-count">
                      {count === 1 ? '1 page changed' : `${count} pages changed`}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          <div className="version-detail">
            {version ? (
              <>
                <div className="version-detail-head">
                  <strong>{version.message || 'Automatic checkpoint'}</strong>
                  <span>{formatStamp(version.savedAt)}</span>
                </div>
                {confirmAll === version.id ? (
                  <p className="banner" role="alert">
                    Restore the whole project as it was here?
                    <button
                      className="btn small danger"
                      type="button"
                      onClick={() => {
                        setConfirmAll(null)
                        void controller.restoreAllFrom(version)
                      }}
                    >
                      Restore everything
                    </button>
                    <button className="btn small quiet" type="button" onClick={() => setConfirmAll(null)}>
                      Don’t
                    </button>
                  </p>
                ) : (
                  <div className="comment-actions">
                    <button className="btn small quiet" type="button" onClick={() => setConfirmAll(version.id)}>
                      Restore everything…
                    </button>
                  </div>
                )}
                {changed.length === 0 ? (
                  <p className="hint">Nothing changed in this version.</p>
                ) : (
                  <ul className="changed-list">
                    {changed.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={item.id === docId ? 'selected' : ''}
                          onClick={() => setDocId(item.id)}
                        >
                          <span className={`changed-kind ${item.change}`}>{item.change}</span>
                          <span>{pageName(item.id, item.change)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {docId ? (
                  <div className="diff-box">
                    <div className="diff-toolbar">
                      <strong>{pageName(docId, 'edited')}</strong>
                      {state.docs[docId] ? (
                        <button
                          className="btn small"
                          type="button"
                          onClick={() => void controller.restoreDocFrom(version, docId)}
                        >
                          Restore this page
                        </button>
                      ) : null}
                    </div>
                    {diffBusy ? (
                      <p className="hint">Loading…</p>
                    ) : diff.length === 0 || isUnchanged(diff) ? (
                      <p className="hint">No visible line changes.</p>
                    ) : (
                      <div className="diff-view" aria-label="Changes">
                        {diff.map((row, index) => (
                          <p key={index} className={`diff-${row.type}`}>
                            {row.type === 'gap' ? '⋯' : row.text || '\u00a0'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="hint">Pick a version to see what changed.</p>
            )}
          </div>
        </div>

        <footer className="dialog-actions">
          <button type="button" className="btn quiet" onClick={() => controller.setHistoryOpen(false)}>
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}
