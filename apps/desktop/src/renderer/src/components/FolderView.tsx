import { countWords, displayTitle, formatWords, kindLabel, manuscriptWordCount } from '@shared/model'
import type { BinderNode } from '@shared/types'
import { useStudio } from '../store'

export function FolderView({ node }: { node: BinderNode }): JSX.Element {
  const { state, controller } = useStudio()
  const children = node.children ?? []
  const words =
    state.project && node.kind === 'manuscript' ? formatWords(manuscriptWordCount(state.project, state.docs)) : null
  const intro =
    node.kind === 'manuscript'
      ? 'Parts, chapters, and scenes live here, in the order the book will compile.'
      : node.kind === 'characters'
        ? 'A shelf for the people in the book. Open a name to edit the sheet.'
        : node.kind === 'places'
          ? 'Rooms, streets, and the other places the draft has to remember.'
          : 'Research, rules, and the notes that should stay beside the manuscript.'

  return (
    <article className="sheet folder-view">
      <p className="eyebrow">{kindLabel(node.kind)}</p>
      <h2>{displayTitle(node.title)}</h2>
      <p className="lede">{intro}</p>
      {words ? <p className="word-count">{words}</p> : null}
      {children.length === 0 ? (
        <p className="empty-copy">Nothing on this shelf yet. Use the buttons at the bottom of the binder.</p>
      ) : (
        <ul className="index-list">
          {children.map((child) => {
            const doc = state.docs[child.id]
            const detail =
              child.kind === 'character'
                ? doc?.role
                : child.kind === 'place'
                  ? doc?.placeType
                  : doc?.synopsis
            return (
              <li key={child.id}>
                <button type="button" onClick={() => controller.select(child.id)}>
                  <strong>{displayTitle(doc?.title ?? child.title)}</strong>
                  <span>{detail?.trim() || kindLabel(child.kind)}</span>
                  {doc ? <em>{formatWords(countWords(doc.body))}</em> : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}
