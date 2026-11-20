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
      ? 'Chapters and scenes, in the order they export.'
      : node.kind === 'characters'
        ? 'People in the book.'
        : node.kind === 'places'
          ? 'Places in the book.'
          : node.kind === 'research'
            ? 'Reference files kept in the project folder: PDFs, images, clippings. They open in the app your system uses for them.'
            : 'Notes for yourself.'

  return (
    <article className="sheet folder-view">
      <h2>{displayTitle(node.title)}</h2>
      <p className="lede">{intro}</p>
      {words ? <p className="word-count">{words}</p> : null}
      {node.kind === 'research' ? (
        <div className="folder-tools">
          <button className="btn small" type="button" onClick={() => void controller.researchAddFile()}>
            Add a research file…
          </button>
        </div>
      ) : null}
      {children.length === 0 ? (
        <p className="empty-copy">Nothing here yet.</p>
      ) : (
        <ul className="index-list">
          {children.map((child) => {
            const doc = state.docs[child.id]
            const detail =
              child.kind === 'character'
                ? doc?.role
                : child.kind === 'place'
                  ? doc?.placeType
                  : child.kind === 'file'
                    ? 'Opens in its own app.'
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
