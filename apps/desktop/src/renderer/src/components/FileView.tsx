import { displayTitle } from '@shared/model'
import type { BinderNode } from '@shared/types'
import { useStudio } from '../store'

export function FileView({ node }: { node: BinderNode }): JSX.Element {
  const { state, controller } = useStudio()
  const dir = state.dir
  return (
    <article className="sheet folder-view">
      <h2>{displayTitle(node.title)}</h2>
      <p className="lede">
        A research file kept in this project folder. It opens in whatever app your system uses for it, and it stays
        with the project when you move or share the folder.
      </p>
      <div className="welcome-actions">
        <button
          className="btn"
          type="button"
          onClick={() => {
            if (dir && window.gather) void window.gather.researchOpen(dir, node.title)
          }}
        >
          Open
        </button>
        <button
          className="btn quiet"
          type="button"
          onClick={() => {
            if (dir && window.gather) void window.gather.researchReveal(dir, node.title)
          }}
        >
          Show in folder
        </button>
        <button className="btn danger" type="button" onClick={() => controller.askDelete(node.id)}>
          Remove…
        </button>
      </div>
    </article>
  )
}
