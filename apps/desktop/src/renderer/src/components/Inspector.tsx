import { parseDocument, serializeDocument } from '@shared/markdown'
import { THREAD_COLORS, displayTitle, findNode } from '@shared/model'
import type { BinderNode, Doc, Kind, PlotThread, SnapshotInfo } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'
import { useStudio } from '../store'

export function hasInspector(kind: Kind): boolean {
  return (
    kind === 'scene' ||
    kind === 'chapter' ||
    kind === 'part' ||
    kind === 'character' ||
    kind === 'place' ||
    kind === 'note'
  )
}

function charactersOf(binder: BinderNode[]): BinderNode[] {
  const shelf = binder.find((node) => node.kind === 'characters')
  return (shelf?.children ?? []).filter((child) => child.kind === 'character')
}

function placesOf(binder: BinderNode[]): BinderNode[] {
  const shelf = binder.find((node) => node.kind === 'places')
  return (shelf?.children ?? []).filter((child) => child.kind === 'place')
}

function docTitle(state: { docs: Record<string, Doc> }, id: string, fallback: string): string {
  return displayTitle(state.docs[id]?.title ?? fallback)
}

export function Inspector(): JSX.Element | null {
  const { state, controller } = useStudio()
  const project = state.project
  if (!project || !state.selectedId) return null
  const node = findNode(project.binder, state.selectedId)
  if (!node) return null
  const doc = state.docs[node.id]
  if (!doc || !hasInspector(node.kind)) return null
  const characters = charactersOf(project.binder)
  const places = placesOf(project.binder)
  const threads: PlotThread[] = project.threads

  const setName = (id: string): string => docTitle(state, id, '')

  return (
    <aside className="inspector" aria-label="Details">
      <div className="inspector-label">Details</div>
      <div className="inspector-scroll">
        <div className="inspector-section">
          <div className="inspector-label">Page</div>
          <div className="page-actions">
            <button
              type="button"
              className={state.pinnedId === doc.id ? 'btn small' : 'btn small quiet'}
              aria-pressed={state.pinnedId === doc.id}
              onClick={() => controller.togglePin(doc.id)}
            >
              {state.pinnedId === doc.id ? 'Pinned ✓' : 'Pin as reference'}
            </button>
            {node.kind === 'character' || node.kind === 'place' ? null : (
              <button
                type="button"
                className={state.typewriter ? 'btn small' : 'btn small quiet'}
                aria-pressed={state.typewriter}
                onClick={controller.toggleTypewriter}
              >
                Typewriter
              </button>
            )}
          </div>
          <Snapshots doc={doc} />
        </div>
        {node.kind === 'scene' ? (
          <>
            <Field label="POV">
              <select value={doc.pov} onChange={(event) => controller.patchDoc(doc.id, { pov: event.target.value })}>
                <option value="">—</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {setName(character.id) || character.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <select
                value={doc.location}
                onChange={(event) => controller.patchDoc(doc.id, { location: event.target.value })}
              >
                <option value="">—</option>
                {places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {setName(place.id) || place.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Thread">
              <select value={doc.thread} onChange={(event) => controller.patchDoc(doc.id, { thread: event.target.value })}>
                <option value="">—</option>
                {threads.map((thread) => (
                  <option key={thread.id} value={thread.id}>
                    {thread.name}
                  </option>
                ))}
              </select>
              {doc.thread ? <span className="thread-dot" style={{ background: threadColor(threads, doc.thread) }} /> : null}
            </Field>
            <Field label="Story day">
              <input
                value={doc.storyDay}
                placeholder="1, 2.5, evening…"
                onChange={(event) => controller.patchDoc(doc.id, { storyDay: event.target.value })}
              />
            </Field>
          </>
        ) : null}

        {node.kind === 'chapter' ? (
          <Field label="Chapter word goal">
            <input
              type="number"
              min={0}
              value={doc.wordGoal === 0 ? '' : doc.wordGoal}
              placeholder="None"
              onChange={(event) => {
                const value = Number(event.target.value)
                controller.patchDoc(doc.id, { wordGoal: Number.isFinite(value) && value > 0 ? Math.round(value) : 0 })
              }}
            />
          </Field>
        ) : null}

        {node.kind === 'character' ? (
          <>
            <Field label="Goal">
              <textarea
                rows={2}
                value={doc.goal}
                placeholder="What they want."
                onChange={(event) => controller.patchDoc(doc.id, { goal: event.target.value })}
              />
            </Field>
            <Field label="Fear">
              <textarea
                rows={2}
                value={doc.fear}
                placeholder="What they avoid."
                onChange={(event) => controller.patchDoc(doc.id, { fear: event.target.value })}
              />
            </Field>
            <Field label="Secret">
              <textarea
                rows={2}
                value={doc.secret}
                placeholder="What they hide."
                onChange={(event) => controller.patchDoc(doc.id, { secret: event.target.value })}
              />
            </Field>
            <div className="inspector-section">
              <div className="inspector-label">Relationships</div>
              {doc.relationships.map((link, index) => (
                <div className="link-row" key={`${link.characterId}-${index}`}>
                  <select
                    aria-label="Character"
                    value={link.characterId}
                    onChange={(event) => {
                      const relationships = [...doc.relationships]
                      const next: typeof link = { ...link, characterId: event.target.value }
                      relationships[index] = next
                      controller.patchDoc(doc.id, { relationships })
                    }}
                  >
                    {characters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {setName(character.id) || character.title}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Note"
                    value={link.note}
                    placeholder="How they know each other."
                    onChange={(event) => {
                      const relationships = [...doc.relationships]
                      relationships[index] = { ...link, note: event.target.value }
                      controller.patchDoc(doc.id, { relationships })
                    }}
                  />
                  <button
                    className="btn small danger"
                    type="button"
                    aria-label="Remove relationship"
                    onClick={() => {
                      const relationships = doc.relationships.filter((_, at) => at !== index)
                      controller.patchDoc(doc.id, { relationships })
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {doc.relationships.length === 0 ? <p className="hint">No links yet.</p> : null}
              <button
                className="btn small quiet"
                type="button"
                disabled={characters.length === 0}
                onClick={() => {
                  const used = new Set(doc.relationships.map((link) => link.characterId))
                  const free = characters.find((character) => !used.has(character.id))
                  const id = free?.id ?? characters[0]?.id
                  if (!id) return
                  const relationships = [...doc.relationships, { characterId: id, note: '' }]
                  controller.patchDoc(doc.id, { relationships })
                }}
              >
                Link a character
              </button>
            </div>
          </>
        ) : null}

        {node.kind === 'place' ? (
          <>
            <Field label="Sights, sounds, smells">
              <textarea
                rows={3}
                value={doc.sense}
                placeholder="What the senses get here."
                onChange={(event) => controller.patchDoc(doc.id, { sense: event.target.value })}
              />
            </Field>
            <Field label="Who controls it">
              <textarea
                rows={2}
                value={doc.control}
                placeholder="Who holds the keys."
                onChange={(event) => controller.patchDoc(doc.id, { control: event.target.value })}
              />
            </Field>
          </>
        ) : null}

        <Keywords doc={doc} />
        <CustomFields doc={doc} />
      </div>
    </aside>
  )
}

function Keywords({ doc }: { doc: Doc }): JSX.Element {
  const { state, controller } = useStudio()
  const [draft, setDraft] = useState('')
  const suggestions = useMemo(() => {
    const all = new Set<string>()
    for (const other of Object.values(state.docs)) {
      for (const word of other.keywords) {
        const clean = word.trim()
        if (clean) all.add(clean)
      }
    }
    return [...all].sort()
  }, [state.docs])

  const add = (): void => {
    const word = draft.trim()
    setDraft('')
    if (!word || doc.keywords.includes(word)) return
    controller.patchDoc(doc.id, { keywords: [...doc.keywords, word] })
  }

  return (
    <div className="inspector-section">
      <div className="inspector-label">Keywords</div>
      <div className="keyword-list">
        {doc.keywords.map((word) => (
          <span className="keyword-chip" key={word}>
            {word}
            <button
              type="button"
              aria-label={`Remove ${word}`}
              onClick={() =>
                controller.patchDoc(doc.id, { keywords: doc.keywords.filter((item) => item !== word) })
              }
            >
              ×
            </button>
          </span>
        ))}
        {doc.keywords.length === 0 ? <p className="hint">Tags like “night” or “rewrite-2”.</p> : null}
      </div>
      <input
        list="keyword-suggestions"
        value={draft}
        placeholder="Add a keyword, press Enter"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
      />
      <datalist id="keyword-suggestions">
        {suggestions.map((word) => (
          <option key={word} value={word} />
        ))}
      </datalist>
    </div>
  )
}

function sanitizeKey(raw: string): string {
  let key = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)
  while (key.length > 0 && !/^[A-Za-z]/.test(key)) key = key.slice(1)
  return key
}

function CustomFields({ doc }: { doc: Doc }): JSX.Element {
  const { controller } = useStudio()
  const fields = doc.extra
  const patch = (extra: typeof fields): void => controller.patchDoc(doc.id, { extra })

  return (
    <div className="inspector-section">
      <div className="inspector-label">Custom fields</div>
      {fields.map((field, index) => (
        <div className="pair-row" key={index}>
          <input
            aria-label="Field name"
            value={field.key}
            placeholder="name"
            onChange={(event) => {
              const extra = [...fields]
              extra[index] = { ...field, key: sanitizeKey(event.target.value) }
              patch(extra)
            }}
          />
          <input
            aria-label="Field value"
            value={field.value}
            placeholder="value"
            onChange={(event) => {
              const extra = [...fields]
              extra[index] = { ...field, value: event.target.value }
              patch(extra)
            }}
          />
          <button
            className="btn small danger"
            type="button"
            aria-label="Remove field"
            onClick={() => patch(fields.filter((_, at) => at !== index))}
          >
            ×
          </button>
        </div>
      ))}
      {fields.length === 0 ? (
        <p className="hint">Your own name and value, saved in the page header.</p>
      ) : null}
      <button
        className="btn small quiet"
        type="button"
        onClick={() => patch([...fields, { key: '', value: '' }])}
      >
        Add a field
      </button>
    </div>
  )
}

function threadColor(threads: PlotThread[], id: string): string {
  return threads.find((thread) => thread.id === id)?.color ?? THREAD_COLORS[0]
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="inspector-field">
      <span>{label}</span>
      {children}
    </label>
  )
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
