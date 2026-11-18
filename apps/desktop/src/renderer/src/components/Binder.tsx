import { canDelete, canMove, displayTitle, isContainer, kindLabel } from '@shared/model'
import type { BinderNode } from '@shared/types'
import { useStudio } from '../store'

export function Binder(): JSX.Element | null {
  const { state, controller, choices } = useStudio()
  if (!state.project) return null
  const selected = state.selectedId
  const removable = selected ? canDelete(state.project.binder, selected) : false
  const up = selected ? canMove(state.project.binder, selected, -1) : false
  const down = selected ? canMove(state.project.binder, selected, 1) : false

  return (
    <aside className="binder">
      <div className="binder-label">Binder</div>
      <div className="binder-scroll" role="tree" aria-label="Binder">
        {state.project.binder.map((node) => (
          <TreeRow key={node.id} node={node} depth={0} />
        ))}
      </div>
      <div className="binder-actions">
        {choices.map((choice) => (
          <button
            key={`${choice.parentId}-${choice.kind}`}
            className="btn small"
            type="button"
            onClick={() => controller.add(choice.parentId, choice.kind)}
          >
            {choice.label}
          </button>
        ))}
        <button className="btn small quiet" type="button" disabled={!up} onClick={() => selected && controller.move(selected, -1)}>
          Up
        </button>
        <button className="btn small quiet" type="button" disabled={!down} onClick={() => selected && controller.move(selected, 1)}>
          Down
        </button>
        <button className="btn small danger" type="button" disabled={!removable} onClick={() => selected && controller.askDelete(selected)}>
          Remove
        </button>
      </div>
    </aside>
  )
}

function TreeRow({ node, depth }: { node: BinderNode; depth: number }): JSX.Element {
  const { state, controller } = useStudio()
  const selected = state.selectedId === node.id
  const container = isContainer(node.kind)
  const collapsed = Boolean(state.collapsed[node.id])
  return (
    <div className="tree-branch">
      <div className={selected ? 'row selected' : 'row'} style={{ paddingLeft: 8 + depth * 14 }} data-kind={node.kind}>
        {container ? (
          <button
            className="twist"
            type="button"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${displayTitle(node.title)}` : `Collapse ${displayTitle(node.title)}`}
            onClick={() => controller.toggleCollapse(node.id)}
          >
            {collapsed ? '▸' : '▾'}
          </button>
        ) : (
          <span className="twist spacer" aria-hidden="true" />
        )}
        <button
          className="row-name"
          type="button"
          aria-current={selected ? 'true' : undefined}
          onClick={() => controller.select(node.id)}
        >
          <span className="row-title">{displayTitle(node.title)}</span>
          <span className="row-kind">{kindLabel(node.kind)}</span>
        </button>
      </div>
      {container && !collapsed
        ? (node.children ?? []).map((child) => <TreeRow key={child.id} node={child} depth={depth + 1} />)
        : null}
    </div>
  )
}
