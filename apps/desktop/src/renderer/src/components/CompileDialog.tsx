import {
  PRINT_PRESETS,
  compileEpubFiles,
  compileHtml,
  compileMarkdown,
  presetMicrons,
  type PrintPresetId,
} from '@shared/compile'
import { compilableIds, displayTitle, manuscriptOf, safeFileBase, subtreeCompilableIds } from '@shared/model'
import type { BinderNode } from '@shared/types'
import { useEffect, useRef, useState } from 'react'
import { useStudio } from '../store'

const FORMATS = [
  { id: 'markdown', label: 'Markdown' },
  { id: 'html', label: 'HTML' },
  { id: 'epub', label: 'EPUB' },
  { id: 'pdf', label: 'PDF' },
] as const

type FormatId = (typeof FORMATS)[number]['id']

export function CompileDialog(): JSX.Element | null {
  const { state, controller } = useStudio()
  const project = state.project
  const open = state.compileOpen && project
  const wasOpen = useRef(false)
  const [included, setIncluded] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<FormatId>('pdf')
  const [preset, setPreset] = useState<PrintPresetId>('6x9')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (state.compileOpen && !wasOpen.current && project) {
      setIncluded(new Set(compilableIds(project)))
      setError(null)
    }
    wasOpen.current = state.compileOpen
  }, [state.compileOpen, project])

  useEffect(() => {
    if (!state.compileOpen) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') controller.setCompileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.compileOpen, controller])

  if (!open || !project) return null
  const manuscript = manuscriptOf(project)
  if (!manuscript) return null

  const toggle = (ids: string[]): void => {
    setIncluded((current) => {
      const next = new Set(current)
      const allOn = ids.length > 0 && ids.every((id) => next.has(id))
      for (const id of ids) {
        if (allOn) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const exportBook = async (): Promise<void> => {
    if (!window.gather || included.size === 0) return
    setBusy(true)
    setError(null)
    try {
      await controller.saveNow()
      const base = safeFileBase(project.title)
      const docs = state.docs
      if (format === 'markdown') {
        const path = await window.gather.saveText({
          defaultName: `${base}.md`,
          extension: 'md',
          filterName: 'Markdown',
          data: compileMarkdown(project, docs, included),
        })
        if (path) controller.setCompileOpen(false)
      } else if (format === 'html') {
        const path = await window.gather.saveText({
          defaultName: `${base}.html`,
          extension: 'html',
          filterName: 'HTML',
          data: compileHtml(project, docs, included, preset),
        })
        if (path) controller.setCompileOpen(false)
      } else if (format === 'epub') {
        const path = await window.gather.saveEpub({
          defaultName: `${base}.epub`,
          files: compileEpubFiles(project, docs, included),
        })
        if (path) controller.setCompileOpen(false)
      } else {
        const size = presetMicrons(preset)
        const path = await window.gather.savePdf({
          defaultName: `${base}.pdf`,
          html: compileHtml(project, docs, included, preset),
          widthMicrons: size.width,
          heightMicrons: size.height,
        })
        if (path) controller.setCompileOpen(false)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The export did not finish.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scrim">
      <div className="dialog compile-dialog" role="dialog" aria-modal="true" aria-labelledby="compile-title">
        <header>
          <h2 id="compile-title">Export</h2>
          <p>Checked items export in binder order. In HTML and PDF, each chapter starts on a new page.</p>
        </header>
        <div className="compile-grid">
          <fieldset>
            <legend>Format</legend>
            {FORMATS.map((item) => (
              <label key={item.id}>
                <input
                  type="radio"
                  name="format"
                  checked={format === item.id}
                  onChange={() => setFormat(item.id)}
                />
                {item.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Print preset</legend>
            {(Object.keys(PRINT_PRESETS) as PrintPresetId[]).map((id) => (
              <label key={id}>
                <input type="radio" name="preset" checked={preset === id} onChange={() => setPreset(id)} />
                <span>
                  {PRINT_PRESETS[id].label}
                  <small>{PRINT_PRESETS[id].detail}</small>
                </span>
              </label>
            ))}
            <p className="hint">Page size is for PDF and HTML. EPUB reflows.</p>
          </fieldset>
        </div>
        <div className="compile-tree">
          <div className="compile-tree-tools">
            <button type="button" className="btn small quiet" onClick={() => setIncluded(new Set(compilableIds(project)))}>
              All
            </button>
            <button type="button" className="btn small quiet" onClick={() => setIncluded(new Set())}>
              None
            </button>
          </div>
          <CheckNode node={manuscript} included={included} onToggle={toggle} depth={0} />
        </div>
        {error ? (
          <p className="banner" role="alert">
            {error}
          </p>
        ) : null}
        <footer className="dialog-actions">
          <button type="button" className="btn quiet" onClick={() => controller.setCompileOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn" disabled={busy || included.size === 0} onClick={() => void exportBook()}>
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function CheckNode({
  node,
  included,
  onToggle,
  depth,
}: {
  node: BinderNode
  included: Set<string>
  onToggle: (ids: string[]) => void
  depth: number
}): JSX.Element | null {
  const box = useRef<HTMLInputElement>(null)
  const ids = subtreeCompilableIds(node)
  const relevant = node.kind === 'manuscript' ? ids : ids
  const checkedCount = relevant.filter((id) => included.has(id)).length
  const all = relevant.length > 0 && checkedCount === relevant.length
  const some = checkedCount > 0 && !all
  useEffect(() => {
    if (box.current) box.current.indeterminate = some
  }, [some])
  if (node.kind !== 'manuscript' && node.kind !== 'part' && node.kind !== 'chapter' && node.kind !== 'scene') {
    return null
  }
  const showBox = node.kind !== 'manuscript'
  return (
    <div className="check-node" style={{ marginLeft: depth ? 16 : 0 }}>
      <label>
        {showBox ? (
          <input
            ref={box}
            type="checkbox"
            checked={all}
            onChange={() => onToggle(ids.length ? ids : [node.id])}
          />
        ) : (
          <input ref={box} type="checkbox" checked={all} onChange={() => onToggle(ids)} />
        )}
        <span>{displayTitle(node.title)}</span>
      </label>
      {(node.children ?? []).map((child) => (
        <CheckNode key={child.id} node={child} included={included} onToggle={onToggle} depth={depth + 1} />
      ))}
    </div>
  )
}
