import { collectScenes, countWords, displayTitle, findNode, formatWords, locate } from '@shared/model'
import type { BinderNode } from '@shared/types'
import { statusLabel } from './Editor'
import { useStudio } from '../store'

export function Corkboard(): JSX.Element {
  const { state, controller } = useStudio()
  const project = state.project
  if (!project) return <></>
  const board = boardFor(project.binder, state.selectedId)

  return (
    <div className="board">
      <header className="board-head">
        <div>
          <p className="eyebrow">Corkboard</p>
          <h2>{board.title}</h2>
        </div>
        <p>{board.scenes.length === 1 ? '1 scene' : `${board.scenes.length} scenes`}</p>
      </header>
      {board.scenes.length === 0 ? (
        <p className="empty-copy">This part of the binder has no scenes yet. Add a chapter, then a scene.</p>
      ) : (
        <div className="cards">
          {board.scenes.map((scene) => {
            const doc = state.docs[scene.id]
            const synopsis = doc?.synopsis.trim()
            const status = doc?.status ?? 'idea'
            return (
              <button key={scene.id} className="card" type="button" onClick={() => controller.select(scene.id)}>
                <span className={`stamp ${status}`}>{statusLabel(status)}</span>
                <h3>{displayTitle(doc?.title ?? scene.title)}</h3>
                <p>{synopsis || 'No synopsis yet.'}</p>
                <span className="card-words">{formatWords(countWords(doc?.body ?? ''))}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function boardFor(binder: BinderNode[], selectedId: string | null): { title: string; scenes: BinderNode[] } {
  const manuscript = binder.find((node) => node.kind === 'manuscript')
  if (!manuscript) return { title: 'Scenes', scenes: [] }
  if (!selectedId) return { title: 'Manuscript', scenes: collectScenes(manuscript) }
  const node = findNode(binder, selectedId)
  if (!node) return { title: 'Manuscript', scenes: collectScenes(manuscript) }
  if (node.kind === 'chapter' || node.kind === 'part' || node.kind === 'manuscript') {
    return { title: displayTitle(node.title), scenes: collectScenes(node) }
  }
  if (node.kind === 'scene') {
    const parent = locate(binder, node.id)?.parent
    const source = parent ?? node
    return { title: displayTitle(source.title), scenes: collectScenes(source) }
  }
  return { title: 'All scenes', scenes: collectScenes(manuscript) }
}
